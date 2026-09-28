-- Hito C — RPCs de negocio, dominio reservas + lista de espera.
-- Portadas leyendo el cuerpo real de Forma (auditoria/raw/rpc_bodies/*.sql), no reinventadas.
--
-- Patrón de seguridad aplicado en TODAS: el tenant nunca se recibe como parámetro del cliente.
-- Se deriva siempre del recurso (horario/reserva/cliente) y se verifica contra tenant_memberships
-- del usuario que llama antes de tocar cualquier fila — regla 1 del maestro (RLS/security definer
-- no protege solo; cada función valida a mano).
--
-- Simplificaciones deliberadas frente a Forma (documentadas, no silenciosas):
--   - Sin códigos de descuento ni bono de referido: esas tablas/funciones son módulo "resto"
--     (Crecimiento), no núcleo. Se conectan cuando se porte ese módulo.
--   - Guatemala UTC-6 hardcodeado se reemplaza por `ahora_en_sede(sede_id)` / `hoy_en_sede(sede_id)`,
--     que leen `sedes.timezone` — ya no asume una sola zona horaria.

create or replace function public.ahora_en_sede(p_sede_id uuid)
returns timestamp
language sql stable
as $$
  select now() at time zone coalesce((select timezone from public.sedes where id = p_sede_id), 'America/Guatemala');
$$;

create or replace function public.hoy_en_sede(p_sede_id uuid)
returns date
language sql stable
as $$
  select (public.ahora_en_sede(p_sede_id))::date;
$$;

-- ¿El usuario que llama es staff de p_tenant_id con alguno de p_roles, y (si el rol es de alcance
-- de sede) está asignado a p_sede_id? dueña/gerente_general siempre pasan sin necesitar staff_sedes
-- (alcance G de la matriz de permisos, sección 12 del maestro).
create or replace function public.staff_puede_en_sede(p_tenant_id uuid, p_sede_id uuid, p_roles text[])
returns boolean
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_membership record;
begin
  select id, role into v_membership from public.tenant_memberships
    where user_id = auth.uid() and tenant_id = p_tenant_id and role = any(p_roles);

  if v_membership is null then
    return false;
  end if;

  if v_membership.role in ('duena', 'gerente_general') then
    return true;
  end if;

  if p_sede_id is null then
    return false;
  end if;

  return exists (
    select 1 from public.staff_sedes
      where tenant_membership_id = v_membership.id and sede_id = p_sede_id
  );
end;
$$;
revoke all on function public.staff_puede_en_sede(uuid, uuid, text[]) from public;
grant execute on function public.staff_puede_en_sede(uuid, uuid, text[]) to authenticated;

-- ¿Cuál es la fila de `clientes` del usuario que llama, DENTRO de este tenant? Un mismo auth.users
-- puede ser clienta de varios tenants con filas distintas — nunca se resuelve globalmente.
create or replace function public.mi_cliente_id(p_tenant_id uuid)
returns uuid
language sql stable security definer
set search_path to 'public'
as $$
  select id from public.clientes where user_id = auth.uid() and tenant_id = p_tenant_id;
$$;
revoke all on function public.mi_cliente_id(uuid) from public;
grant execute on function public.mi_cliente_id(uuid) to authenticated;

create or replace function public.devolver_clase_a_membresia(p_cliente_id uuid)
returns void
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_membresia_id uuid;
  v_tutor_familia_id uuid;
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.clientes where id = p_cliente_id;

  select id into v_membresia_id from public.membresias
    where cliente_id = p_cliente_id and estado = 'activa' and clases_usadas > 0
    order by fecha_vencimiento asc limit 1;

  if v_membresia_id is null then
    select coalesce(tutor_id, id) into v_tutor_familia_id from public.clientes where id = p_cliente_id;
    select m.id into v_membresia_id
      from public.membresias m
      join public.paquetes pq on pq.id = m.paquete_id
      where m.cliente_id = v_tutor_familia_id and m.tenant_id = v_tenant_id and pq.compartido_familiar = true
        and m.estado = 'activa' and m.clases_usadas > 0
      order by m.fecha_vencimiento asc limit 1;
  end if;

  if v_membresia_id is not null then
    update public.membresias set clases_usadas = greatest(clases_usadas - 1, 0) where id = v_membresia_id;
  end if;
end;
$$;
revoke all on function public.devolver_clase_a_membresia(uuid) from public;
grant execute on function public.devolver_clase_a_membresia(uuid) to authenticated;

create or replace function public.cancelar_mi_reserva(p_reserva_id uuid)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_reserva record;
  v_tenant_id uuid;
  v_propio_id uuid;
  v_horas_minimas int;
  v_horas_faltantes numeric;
  v_es_tardia boolean;
begin
  select r.*, h.hora_inicio into v_reserva
    from public.reservas r join public.horarios h on h.id = r.horario_id
    where r.id = p_reserva_id and r.estado = 'confirmada';

  if v_reserva is null then
    raise exception 'Reserva no encontrada';
  end if;

  v_tenant_id := v_reserva.tenant_id;
  v_propio_id := public.mi_cliente_id(v_tenant_id);

  if v_propio_id is null or (v_reserva.cliente_id <> v_propio_id
      and v_reserva.cliente_id not in (select id from public.clientes where tutor_id = v_propio_id and tenant_id = v_tenant_id)) then
    raise exception 'Reserva no encontrada';
  end if;

  select horas_minimas_cancelacion into v_horas_minimas from public.configuracion_reservas where tenant_id = v_tenant_id;
  v_horas_minimas := coalesce(v_horas_minimas, 2);

  v_horas_faltantes := extract(epoch from ((v_reserva.fecha + v_reserva.hora_inicio) - public.ahora_en_sede(v_reserva.sede_id))) / 3600;
  v_es_tardia := v_horas_faltantes < v_horas_minimas;

  update public.reservas set estado = 'cancelada', penalizada = v_es_tardia where id = p_reserva_id;

  if v_reserva.tipo = 'regular' and not v_es_tardia then
    perform public.devolver_clase_a_membresia(v_reserva.cliente_id);
  end if;

  return json_build_object('ok', true, 'penalizada', v_es_tardia, 'horas_minimas', v_horas_minimas);
end;
$$;
revoke all on function public.cancelar_mi_reserva(uuid) from public;
grant execute on function public.cancelar_mi_reserva(uuid) to authenticated;

create or replace function public.confirmar_mi_reserva(p_reserva_id uuid)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid;
  v_propio_id uuid;
begin
  select tenant_id into v_tenant_id from public.reservas where id = p_reserva_id;
  if v_tenant_id is null then
    raise exception 'Reserva no encontrada';
  end if;
  v_propio_id := public.mi_cliente_id(v_tenant_id);

  update public.reservas set confirmada_por_clienta_at = now()
    where id = p_reserva_id
      and (cliente_id = v_propio_id or cliente_id in (select id from public.clientes where tutor_id = v_propio_id and tenant_id = v_tenant_id))
      and estado = 'confirmada';

  if not found then
    raise exception 'Reserva no encontrada';
  end if;

  return json_build_object('ok', true);
end;
$$;
revoke all on function public.confirmar_mi_reserva(uuid) from public;
grant execute on function public.confirmar_mi_reserva(uuid) to authenticated;

-- hacer_checkin: no recibe tenant — un usuario puede tener check-in pendiente en varios tenants a la
-- vez en teoría (múltiples estudios), así que se busca la reserva propia más próxima EN CUALQUIER
-- tenant donde el usuario sea clienta, no solo uno. La fuga entre tenants no existe porque cada
-- `clientes` fila ya está scoped a su tenant vía la propia tabla.
create or replace function public.hacer_checkin()
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_reserva_id uuid;
  v_nombre_clase text;
  v_hora_inicio time;
begin
  select r.id, h.nombre_clase, h.hora_inicio
    into v_reserva_id, v_nombre_clase, v_hora_inicio
    from public.reservas r
    join public.horarios h on h.id = r.horario_id
    join public.clientes c on c.id = r.cliente_id
    where c.user_id = auth.uid()
      and r.fecha = public.hoy_en_sede(r.sede_id)
      and r.estado = 'confirmada'
      and r.asistio is null
      and public.ahora_en_sede(r.sede_id) between (r.fecha + h.hora_inicio - interval '30 minutes') and (r.fecha + h.hora_fin + interval '30 minutes')
    order by
      case
        when public.ahora_en_sede(r.sede_id) between (r.fecha + h.hora_inicio) and (r.fecha + h.hora_fin) then 0
        when public.ahora_en_sede(r.sede_id) < (r.fecha + h.hora_inicio) then 1
        else 2
      end,
      abs(extract(epoch from ((r.fecha + h.hora_inicio) - public.ahora_en_sede(r.sede_id))))
    limit 1;

  if v_reserva_id is null then
    raise exception 'No encontramos ninguna clase tuya para marcar en este momento. Si crees que es un error, avísale al estudio.';
  end if;

  update public.reservas set asistio = true where id = v_reserva_id;

  return json_build_object('ok', true, 'clase', v_nombre_clase, 'hora', v_hora_inicio);
end;
$$;
revoke all on function public.hacer_checkin() from public;
grant execute on function public.hacer_checkin() to authenticated;

create or replace function public.hacer_checkin_multiple(p_cliente_ids uuid[])
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_cliente_id uuid;
  v_reserva_id uuid;
  v_nombre_clase text;
  v_hora_inicio time;
  v_nombre_cliente text;
  v_marcados jsonb := '[]'::jsonb;
  v_es_propio_o_dependiente boolean;
begin
  foreach v_cliente_id in array p_cliente_ids loop
    select exists (
      select 1 from public.clientes c
        where c.id = v_cliente_id
          and (c.user_id = auth.uid()
               or c.tutor_id in (select id from public.clientes where user_id = auth.uid() and tenant_id = c.tenant_id))
    ) into v_es_propio_o_dependiente;

    if not v_es_propio_o_dependiente then
      continue;
    end if;

    select r.id, h.nombre_clase, h.hora_inicio, c.nombre
      into v_reserva_id, v_nombre_clase, v_hora_inicio, v_nombre_cliente
      from public.reservas r
      join public.horarios h on h.id = r.horario_id
      join public.clientes c on c.id = r.cliente_id
      where r.cliente_id = v_cliente_id
        and r.fecha = public.hoy_en_sede(r.sede_id)
        and r.estado = 'confirmada'
        and r.asistio is null
        and h.hora_inicio between ((public.ahora_en_sede(r.sede_id))::time - interval '15 minutes') and ((public.ahora_en_sede(r.sede_id))::time + interval '20 minutes')
      order by abs(extract(epoch from (h.hora_inicio - (public.ahora_en_sede(r.sede_id))::time)))
      limit 1;

    if v_reserva_id is not null then
      update public.reservas set asistio = true where id = v_reserva_id;
      v_marcados := v_marcados || jsonb_build_object('nombre', v_nombre_cliente, 'clase', v_nombre_clase, 'hora', v_hora_inicio);
    end if;
  end loop;

  if jsonb_array_length(v_marcados) = 0 then
    raise exception 'No encontramos ninguna clase para marcar en este momento. Si crees que es un error, avísale al estudio.';
  end if;

  return json_build_object('ok', true, 'marcados', v_marcados);
end;
$$;
revoke all on function public.hacer_checkin_multiple(uuid[]) from public;
grant execute on function public.hacer_checkin_multiple(uuid[]) to authenticated;

create or replace function public.admin_agregar_reserva(p_cliente_id uuid, p_horario_id uuid, p_fecha date, p_tipo text default 'regular')
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid;
  v_sede_id uuid;
  v_cupo int;
  v_ocupadas int;
  v_reserva_id uuid;
  v_estado_actual text;
  v_membresia_id uuid;
  v_clases_totales int;
  v_tutor_familia_id uuid;
begin
  select tenant_id, sede_id, cupo_maximo into v_tenant_id, v_sede_id, v_cupo from public.horarios where id = p_horario_id;
  if v_tenant_id is null then raise exception 'Horario no válido'; end if;

  if not exists (select 1 from public.clientes where id = p_cliente_id and tenant_id = v_tenant_id) then
    raise exception 'Clienta no encontrada en este tenant';
  end if;

  if not public.staff_puede_en_sede(v_tenant_id, v_sede_id, array['duena','gerente_general','admin_sede','recepcion']) then
    raise exception 'No autorizado para asignar reservas en esa sede';
  end if;

  if p_tipo not in ('regular', 'prueba') then
    raise exception 'Tipo de reserva inválido';
  end if;

  if not exists (
    select 1 from public.horarios where id = p_horario_id
      and ((fecha_especifica is null and dia_semana = extract(dow from p_fecha)::int)
           or fecha_especifica = p_fecha)
  ) then
    raise exception 'Esa fecha no corresponde a ese horario — revisa que el día de la semana de la fecha coincida con el de la clase.';
  end if;
  if exists (select 1 from public.horario_cancelaciones where horario_id = p_horario_id and fecha = p_fecha) then
    raise exception 'Esa fecha está cancelada para ese horario.';
  end if;
  if exists (select 1 from public.horario_fechas_privadas where horario_id = p_horario_id and fecha = p_fecha) then
    raise exception 'Esa fecha está privatizada — agrégala desde Horarios, no desde aquí.';
  end if;

  select id, estado into v_reserva_id, v_estado_actual from public.reservas
    where cliente_id = p_cliente_id and horario_id = p_horario_id and fecha = p_fecha;
  if v_reserva_id is not null and v_estado_actual = 'confirmada' then
    raise exception 'Esta clienta ya tiene una reserva confirmada en esa clase';
  end if;

  select count(*) into v_ocupadas from public.reservas
    where horario_id = p_horario_id and fecha = p_fecha and estado = 'confirmada';
  if v_ocupadas >= v_cupo then raise exception 'Ese horario ya no tiene cupo disponible'; end if;

  if p_tipo = 'regular' then
    select id, clases_totales into v_membresia_id, v_clases_totales from public.membresias
      where cliente_id = p_cliente_id and estado = 'activa'
        and congelada_desde is null
        and fecha_vencimiento >= p_fecha
        and (clases_totales is null or clases_usadas < clases_totales)
      order by fecha_vencimiento asc limit 1;

    if v_membresia_id is null then
      select coalesce(tutor_id, id) into v_tutor_familia_id from public.clientes where id = p_cliente_id;
      select m.id, m.clases_totales into v_membresia_id, v_clases_totales
        from public.membresias m join public.paquetes pq on pq.id = m.paquete_id
        where m.cliente_id = v_tutor_familia_id and pq.compartido_familiar = true
          and m.estado = 'activa' and m.congelada_desde is null and m.fecha_vencimiento >= p_fecha
          and (m.clases_totales is null or m.clases_usadas < m.clases_totales)
        order by m.fecha_vencimiento asc limit 1;
    end if;

    if v_membresia_id is null then
      raise exception 'Esta clienta no tiene un paquete activo con cupo disponible — asígnale un paquete primero, o márcala como clase de prueba.';
    end if;

    -- Cobertura de sede (nuevo en multi-tenant, no existía en Forma de una sola sede): el paquete de
    -- la membresía debe cubrir la sede de este horario.
    if not exists (
      select 1 from public.membresias m join public.paquetes pq on pq.id = m.paquete_id
        where m.id = v_membresia_id and (
          pq.cobertura = 'todas'
          or (pq.cobertura = 'sede' and m.sede_venta_id = v_sede_id)
          or (pq.cobertura = 'sedes' and exists (select 1 from public.membresia_sedes ms where ms.membresia_id = m.id and ms.sede_id = v_sede_id))
        )
    ) then
      raise exception 'El paquete de esta clienta no cubre esta sede.';
    end if;
  end if;

  if v_reserva_id is not null then
    update public.reservas set estado = 'confirmada', tipo = p_tipo where id = v_reserva_id;
  else
    insert into public.reservas (tenant_id, sede_id, horario_id, cliente_id, fecha, tipo, estado)
      values (v_tenant_id, v_sede_id, p_horario_id, p_cliente_id, p_fecha, p_tipo, 'confirmada')
      returning id into v_reserva_id;
  end if;

  if p_tipo = 'regular' and v_clases_totales is not null then
    update public.membresias set clases_usadas = clases_usadas + 1 where id = v_membresia_id;
  end if;

  return json_build_object('ok', true, 'reserva_id', v_reserva_id);
end;
$$;
revoke all on function public.admin_agregar_reserva(uuid, uuid, date, text) from public;
grant execute on function public.admin_agregar_reserva(uuid, uuid, date, text) to authenticated;

create or replace function public.admin_cancelar_reserva(p_reserva_id uuid)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_reserva record;
begin
  select * into v_reserva from public.reservas where id = p_reserva_id and estado = 'confirmada';
  if v_reserva is null then
    raise exception 'Reserva no encontrada';
  end if;

  if not public.staff_puede_en_sede(v_reserva.tenant_id, v_reserva.sede_id, array['duena','gerente_general','admin_sede','recepcion']) then
    raise exception 'No autorizado';
  end if;

  update public.reservas set estado = 'cancelada' where id = p_reserva_id;

  if v_reserva.tipo = 'regular' then
    perform public.devolver_clase_a_membresia(v_reserva.cliente_id);
  end if;

  return json_build_object('ok', true);
end;
$$;
revoke all on function public.admin_cancelar_reserva(uuid) from public;
grant execute on function public.admin_cancelar_reserva(uuid) to authenticated;

create or replace function public.admin_editar_tipo_reserva(p_reserva_id uuid, p_tipo text)
returns void
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_reserva record;
begin
  select * into v_reserva from public.reservas where id = p_reserva_id;
  if v_reserva is null then raise exception 'Reserva no encontrada'; end if;

  if not public.staff_puede_en_sede(v_reserva.tenant_id, v_reserva.sede_id, array['duena','gerente_general']) then
    raise exception 'Solo la dueña o gerente general puede editar el tipo de una reserva';
  end if;

  if p_tipo not in ('regular', 'prueba') then
    raise exception 'Tipo de reserva inválido';
  end if;

  update public.reservas set tipo = p_tipo where id = p_reserva_id;
end;
$$;
revoke all on function public.admin_editar_tipo_reserva(uuid, text) from public;
grant execute on function public.admin_editar_tipo_reserva(uuid, text) to authenticated;

create or replace function public.cancelar_fecha_horario(p_horario_id uuid, p_fecha date)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid;
  v_sede_id uuid;
  v_reserva record;
  v_afectados jsonb := '[]'::jsonb;
begin
  select tenant_id, sede_id into v_tenant_id, v_sede_id from public.horarios where id = p_horario_id;
  if v_tenant_id is null then raise exception 'Horario no válido'; end if;

  if not public.staff_puede_en_sede(v_tenant_id, v_sede_id, array['duena','gerente_general','admin_sede']) then
    raise exception 'No autorizado';
  end if;

  if exists (select 1 from public.horario_cancelaciones where horario_id = p_horario_id and fecha = p_fecha) then
    raise exception 'Esa fecha ya está cancelada.';
  end if;
  if exists (select 1 from public.horario_fechas_privadas where horario_id = p_horario_id and fecha = p_fecha) then
    raise exception 'Esa fecha está privatizada — quita la privatización primero si quieres cancelarla.';
  end if;

  insert into public.horario_cancelaciones (tenant_id, horario_id, fecha) values (v_tenant_id, p_horario_id, p_fecha);

  for v_reserva in
    select id, cliente_id, tipo from public.reservas
      where horario_id = p_horario_id and fecha = p_fecha and estado = 'confirmada'
  loop
    update public.reservas set estado = 'cancelada' where id = v_reserva.id;

    if v_reserva.tipo = 'regular' then
      perform public.devolver_clase_a_membresia(v_reserva.cliente_id);
    end if;

    v_afectados := v_afectados || jsonb_build_object('cliente_id', v_reserva.cliente_id, 'tipo', v_reserva.tipo);
  end loop;

  delete from public.lista_espera where horario_id = p_horario_id and fecha = p_fecha;

  return json_build_object('ok', true, 'afectados', v_afectados);
end;
$$;
revoke all on function public.cancelar_fecha_horario(uuid, date) from public;
grant execute on function public.cancelar_fecha_horario(uuid, date) to authenticated;

-- Trigger: bloquea confirmar una reserva de una clase que ya empezó, salvo staff.
create or replace function public.bloquear_reserva_clase_empezada()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_hora time;
begin
  if new.estado <> 'confirmada' or (tg_op = 'UPDATE' and old.estado = 'confirmada') then
    return new;
  end if;
  if auth.uid() is null
     or exists (select 1 from public.tenant_memberships where user_id = auth.uid() and tenant_id = new.tenant_id and role in ('duena','gerente_general','admin_sede','recepcion')) then
    return new;
  end if;
  select hora_inicio into v_hora from public.horarios where id = new.horario_id;
  if v_hora is not null and (new.fecha + v_hora) <= public.ahora_en_sede(new.sede_id) then
    raise exception 'Esa clase ya empezó — elige otro horario.';
  end if;
  return new;
end;
$$;
create trigger reservas_bloquear_clase_empezada before insert or update on public.reservas
  for each row execute function public.bloquear_reserva_clase_empezada();

-- Trigger: al cancelarse una reserva, promueve al primero de la lista de espera si hay cupo.
create or replace function public.promover_lista_espera()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_cupo int;
  v_hora_inicio time;
  v_ocupadas int;
  v_espera record;
  v_reserva_existente uuid;
  v_nueva_reserva_id uuid;
  v_membresia_id uuid;
  v_tutor_familia_id uuid;
begin
  if new.estado <> 'cancelada' or old.estado = 'cancelada' then
    return new;
  end if;

  if exists (select 1 from public.horario_cancelaciones where horario_id = new.horario_id and fecha = new.fecha)
     or exists (select 1 from public.horario_fechas_privadas where horario_id = new.horario_id and fecha = new.fecha) then
    return new;
  end if;

  select cupo_maximo, hora_inicio into v_cupo, v_hora_inicio from public.horarios where id = new.horario_id;

  if v_hora_inicio is null or (new.fecha + v_hora_inicio) <= public.ahora_en_sede(new.sede_id) then
    return new;
  end if;

  select count(*) into v_ocupadas from public.reservas
    where horario_id = new.horario_id and fecha = new.fecha and estado = 'confirmada';

  if v_cupo is null or v_ocupadas >= v_cupo then
    return new;
  end if;

  for v_espera in
    select * from public.lista_espera
      where horario_id = new.horario_id and fecha = new.fecha
      order by created_at asc
  loop
    select id into v_membresia_id from public.membresias
      where cliente_id = v_espera.cliente_id
        and estado = 'activa'
        and congelada_desde is null
        and fecha_vencimiento >= new.fecha
        and (clases_totales is null or clases_usadas < clases_totales)
      order by fecha_vencimiento asc
      limit 1;

    if v_membresia_id is null then
      select coalesce(tutor_id, id) into v_tutor_familia_id from public.clientes where id = v_espera.cliente_id;
      select m.id into v_membresia_id
        from public.membresias m join public.paquetes pq on pq.id = m.paquete_id
        where m.cliente_id = v_tutor_familia_id and pq.compartido_familiar = true
          and m.estado = 'activa' and m.congelada_desde is null and m.fecha_vencimiento >= new.fecha
          and (m.clases_totales is null or m.clases_usadas < m.clases_totales)
        order by m.fecha_vencimiento asc limit 1;
    end if;

    if v_membresia_id is null then
      continue;
    end if;

    select id into v_reserva_existente from public.reservas
      where horario_id = new.horario_id and cliente_id = v_espera.cliente_id and fecha = new.fecha;

    if v_reserva_existente is not null then
      update public.reservas set estado = 'confirmada', tipo = 'regular' where id = v_reserva_existente;
      v_nueva_reserva_id := v_reserva_existente;
    else
      insert into public.reservas (tenant_id, sede_id, horario_id, cliente_id, fecha, tipo, estado)
        values (new.tenant_id, new.sede_id, new.horario_id, v_espera.cliente_id, new.fecha, 'regular', 'confirmada')
        returning id into v_nueva_reserva_id;
    end if;

    update public.membresias set clases_usadas = clases_usadas + 1 where id = v_membresia_id;

    delete from public.lista_espera where id = v_espera.id;

    insert into public.lista_espera_notificaciones (tenant_id, reserva_id, cliente_id)
      values (new.tenant_id, v_nueva_reserva_id, v_espera.cliente_id);

    exit;
  end loop;

  return new;
end;
$$;
create trigger reservas_promover_lista_espera after update on public.reservas
  for each row execute function public.promover_lista_espera();

create or replace function public.unirse_lista_espera(p_horario_id uuid, p_fecha date, p_cliente_id uuid default null)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid;
  v_sede_id uuid;
  v_propio_id uuid;
  v_cliente_id uuid;
  v_cupo int;
  v_ocupadas int;
begin
  select tenant_id, sede_id, cupo_maximo into v_tenant_id, v_sede_id, v_cupo
    from public.horarios where id = p_horario_id and activo = true and categoria = 'regular';
  if v_tenant_id is null then
    raise exception 'Horario no válido';
  end if;

  v_propio_id := public.mi_cliente_id(v_tenant_id);
  if v_propio_id is null then
    raise exception 'Completa tu perfil antes de reservar';
  end if;

  v_cliente_id := v_propio_id;
  if p_cliente_id is not null and p_cliente_id <> v_propio_id then
    if not exists (select 1 from public.clientes where id = p_cliente_id and tutor_id = v_propio_id and tenant_id = v_tenant_id) then
      raise exception 'No tienes permiso para reservar por esa persona.';
    end if;
    v_cliente_id := p_cliente_id;
  end if;

  if not public._fecha_coincide_horario(p_horario_id, p_fecha) then
    raise exception 'Esa fecha no corresponde a ese horario.';
  end if;
  if exists (select 1 from public.horario_fechas_privadas where horario_id = p_horario_id and fecha = p_fecha) then
    raise exception 'Ese horario no tiene cupo disponible en esa fecha';
  end if;
  if exists (select 1 from public.horario_cancelaciones where horario_id = p_horario_id and fecha = p_fecha) then
    raise exception 'Ese horario no tiene clase en esa fecha.';
  end if;

  select count(*) into v_ocupadas from public.reservas
    where horario_id = p_horario_id and fecha = p_fecha and estado = 'confirmada';
  if v_ocupadas < v_cupo then
    raise exception 'Esta clase todavía tiene cupo — resérvala directo.';
  end if;

  if exists (select 1 from public.reservas where cliente_id = v_cliente_id and horario_id = p_horario_id and fecha = p_fecha and estado = 'confirmada') then
    raise exception 'Ya tiene una reserva confirmada en esa clase.';
  end if;

  insert into public.lista_espera (tenant_id, horario_id, cliente_id, fecha)
    values (v_tenant_id, p_horario_id, v_cliente_id, p_fecha)
    on conflict do nothing;

  return json_build_object('ok', true);
end;
$$;
revoke all on function public.unirse_lista_espera(uuid, date, uuid) from public;
grant execute on function public.unirse_lista_espera(uuid, date, uuid) to authenticated;

create or replace function public.salir_lista_espera(p_id uuid)
returns void
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid;
  v_propio_id uuid;
begin
  select tenant_id into v_tenant_id from public.lista_espera where id = p_id;
  if v_tenant_id is null then return; end if;
  v_propio_id := public.mi_cliente_id(v_tenant_id);

  delete from public.lista_espera
    where id = p_id
      and (cliente_id = v_propio_id or cliente_id in (select id from public.clientes where tutor_id = v_propio_id and tenant_id = v_tenant_id));
end;
$$;
revoke all on function public.salir_lista_espera(uuid) from public;
grant execute on function public.salir_lista_espera(uuid) to authenticated;

create or replace function public.mi_lista_espera()
returns table(id uuid, fecha date, hora_inicio time, nombre_clase text, cliente_id uuid, cliente_nombre text, es_propia boolean)
language sql stable security definer
set search_path to 'public'
as $$
  select le.id, le.fecha, h.hora_inicio, h.nombre_clase, c.id, c.nombre,
    (c.user_id = auth.uid())
  from public.lista_espera le
  join public.horarios h on h.id = le.horario_id
  join public.clientes c on c.id = le.cliente_id
  where c.user_id = auth.uid() or c.tutor_id in (select id from public.clientes where user_id = auth.uid() and tenant_id = c.tenant_id)
  order by le.fecha, h.hora_inicio;
$$;
revoke all on function public.mi_lista_espera() from public;
grant execute on function public.mi_lista_espera() to authenticated;

-- Función de cron/plataforma: recorre TODOS los tenants (no hay usuario llamando, la ejecuta
-- service_role) — devuelve tenant_id para que el job de notificaciones sepa a quién enviarle qué.
create or replace function public.lista_espera_vencida()
returns table(tenant_id uuid, lista_espera_id uuid, cliente_id uuid, nombre text, email text, user_id uuid, nombre_clase text, hora_inicio time, fecha date)
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_reg record;
begin
  for v_reg in
    select le.tenant_id as t_id, le.id as le_id, c.id as c_id, c.nombre as c_nombre, c.email as c_email, c.user_id as c_user_id,
           h.nombre_clase as h_nombre, h.hora_inicio as h_hora, le.fecha as le_fecha, le.horario_id as h_id
    from public.lista_espera le
    join public.horarios h on h.id = le.horario_id
    join public.clientes c on c.id = le.cliente_id
    where (le.fecha + h.hora_inicio) <= public.ahora_en_sede(h.sede_id)
  loop
    delete from public.lista_espera where id = v_reg.le_id;
    tenant_id := v_reg.t_id;
    lista_espera_id := v_reg.le_id;
    cliente_id := v_reg.c_id;
    nombre := v_reg.c_nombre;
    email := v_reg.c_email;
    user_id := v_reg.c_user_id;
    nombre_clase := v_reg.h_nombre;
    hora_inicio := v_reg.h_hora;
    fecha := v_reg.le_fecha;
    return next;
  end loop;
end;
$$;
revoke all on function public.lista_espera_vencida() from public;
grant execute on function public.lista_espera_vencida() to service_role;

create or replace function public._fecha_coincide_horario(p_horario_id uuid, p_fecha date)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.horarios where id = p_horario_id
      and ((fecha_especifica is null and dia_semana = extract(dow from p_fecha)::int)
           or fecha_especifica = p_fecha)
  );
$$;
revoke all on function public._fecha_coincide_horario(uuid, date) from public;
grant execute on function public._fecha_coincide_horario(uuid, date) to authenticated;

create or replace function public._cancelar_reservas_de_membresia_rechazada(p_membresia_id uuid, p_cliente_id uuid, p_clases_usadas integer, p_membresia_created_at timestamptz)
returns table(reserva_id uuid, fecha date, hora_inicio time, nombre_clase text)
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_reserva record;
begin
  if p_clases_usadas <= 0 then
    return;
  end if;

  for v_reserva in
    select r.id, r.fecha, h.hora_inicio, h.nombre_clase
      from public.reservas r join public.horarios h on h.id = r.horario_id
      where r.cliente_id = p_cliente_id
        and r.tipo = 'regular'
        and r.estado = 'confirmada'
        and r.created_at >= p_membresia_created_at
      order by r.created_at desc
      limit p_clases_usadas
  loop
    update public.reservas set estado = 'cancelada' where id = v_reserva.id;
    reserva_id := v_reserva.id;
    fecha := v_reserva.fecha;
    hora_inicio := v_reserva.hora_inicio;
    nombre_clase := v_reserva.nombre_clase;
    return next;
  end loop;
end;
$$;
revoke all on function public._cancelar_reservas_de_membresia_rechazada(uuid, uuid, integer, timestamptz) from public;
grant execute on function public._cancelar_reservas_de_membresia_rechazada(uuid, uuid, integer, timestamptz) to authenticated;
