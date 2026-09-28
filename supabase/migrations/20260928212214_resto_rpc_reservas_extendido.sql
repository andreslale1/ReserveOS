-- Módulo resto — reservas extendidas: agendar clase (autoservicio real de la clienta — otra que
-- debió ser núcleo), clases de prueba, clases privadas, disponibilidad, y el resto del ciclo de
-- privatización. Mismo patrón de seguridad que siempre.
--
-- Se eliminan a propósito las fechas de apertura hardcodeadas de Forma (`2026-09-21`,
-- `2026-09-30 23:59:59`) — eran la fecha de lanzamiento de UN estudio, no aplican a un SaaS con
-- muchos tenants abriendo en fechas distintas. Si se necesita una fecha de apertura por tenant, se
-- agrega como columna a `tenants`/`configuracion_reservas` cuando haya un caso real que lo pida.

create or replace function public.agendar_clase(p_horario_id uuid, p_fecha date, p_cliente_id uuid default null)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid; v_sede_id uuid;
  v_propio_id uuid; v_cliente_id uuid; v_tutor_familia_id uuid;
  v_cupo int; v_ocupadas int;
  v_membresia_id uuid; v_clases_totales int;
  v_reserva_id uuid; v_estado_existente text;
  v_pago_pendiente boolean := false;
  v_gracia_agotada boolean; v_ultimo_paquete_id uuid; v_ya_uso_prueba boolean;
begin
  select tenant_id, sede_id, cupo_maximo into v_tenant_id, v_sede_id, v_cupo
    from public.horarios where id = p_horario_id and activo = true and categoria = 'regular';
  if v_tenant_id is null then raise exception 'Horario no válido'; end if;

  v_propio_id := public.mi_cliente_id(v_tenant_id);
  if v_propio_id is null then raise exception 'No tienes un perfil de clienta asociado'; end if;

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

  select count(*) into v_ocupadas from public.reservas where horario_id = p_horario_id and fecha = p_fecha and estado = 'confirmada';
  if v_ocupadas >= v_cupo then raise exception 'Ese horario ya no tiene cupo disponible'; end if;

  select id, estado into v_reserva_id, v_estado_existente from public.reservas
    where horario_id = p_horario_id and cliente_id = v_cliente_id and fecha = p_fecha;
  if v_reserva_id is not null and v_estado_existente = 'confirmada' then
    raise exception 'Ya tiene una reserva confirmada en esa clase.';
  end if;

  select id, clases_totales into v_membresia_id, v_clases_totales from public.membresias
    where cliente_id = v_cliente_id and estado = 'activa' and congelada_desde is null and fecha_vencimiento >= p_fecha
      and (clases_totales is null or clases_usadas < clases_totales)
      and public.membresia_cubre_sede(id, v_sede_id)
    order by fecha_vencimiento asc limit 1;

  if v_membresia_id is null then
    select coalesce(tutor_id, id) into v_tutor_familia_id from public.clientes where id = v_cliente_id;
    select m.id, m.clases_totales into v_membresia_id, v_clases_totales
      from public.membresias m join public.paquetes pq on pq.id = m.paquete_id
      where m.cliente_id = v_tutor_familia_id and pq.compartido_familiar = true
        and m.estado = 'activa' and m.congelada_desde is null and m.fecha_vencimiento >= p_fecha
        and (m.clases_totales is null or m.clases_usadas < m.clases_totales)
        and public.membresia_cubre_sede(m.id, v_sede_id)
      order by m.fecha_vencimiento asc limit 1;
  end if;

  if v_membresia_id is null then
    select id, clases_totales into v_membresia_id, v_clases_totales from public.membresias
      where cliente_id = v_cliente_id and estado = 'activa' and pagada = false and congelada_desde is null
        and clases_usadas < clases_totales and public.membresia_cubre_sede(id, v_sede_id)
      order by created_at desc limit 1;

    if v_membresia_id is not null then
      v_pago_pendiente := true;
    else
      select exists(select 1 from public.membresias where cliente_id = v_cliente_id and pagada = false) into v_gracia_agotada;
      if v_gracia_agotada then
        raise exception 'Tienes un pago pendiente. Contacta al estudio para renovar tu paquete.';
      end if;

      select paquete_id into v_ultimo_paquete_id from public.membresias where cliente_id = v_cliente_id order by created_at desc limit 1;
      if v_ultimo_paquete_id is null then
        select exists(select 1 from public.reservas where cliente_id = v_cliente_id and tipo = 'prueba' and estado <> 'cancelada') into v_ya_uso_prueba;
        if v_ya_uso_prueba then
          raise exception 'No tienes clases disponibles en tu paquete';
        end if;
        if v_reserva_id is not null then
          update public.reservas set estado = 'confirmada', tipo = 'prueba' where id = v_reserva_id;
        else
          insert into public.reservas (tenant_id, sede_id, horario_id, cliente_id, fecha, tipo, estado)
            values (v_tenant_id, v_sede_id, p_horario_id, v_cliente_id, p_fecha, 'prueba', 'confirmada')
            returning id into v_reserva_id;
        end if;
        return json_build_object('ok', true, 'reserva_id', v_reserva_id, 'pago_pendiente', false);
      end if;

      raise exception 'Necesitas comprar un paquete para poder reservar esta clase.';
    end if;
  end if;

  if v_reserva_id is not null then
    update public.reservas set estado = 'confirmada', tipo = 'regular' where id = v_reserva_id;
  else
    insert into public.reservas (tenant_id, sede_id, horario_id, cliente_id, fecha, tipo, estado)
      values (v_tenant_id, v_sede_id, p_horario_id, v_cliente_id, p_fecha, 'regular', 'confirmada')
      returning id into v_reserva_id;
  end if;

  if v_clases_totales is not null then
    update public.membresias set clases_usadas = clases_usadas + 1 where id = v_membresia_id;
  end if;

  return json_build_object('ok', true, 'reserva_id', v_reserva_id, 'pago_pendiente', v_pago_pendiente);
end;
$$;
revoke all on function public.agendar_clase(uuid, date, uuid) from public;
grant execute on function public.agendar_clase(uuid, date, uuid) to authenticated;

-- Alta pública sin sesión (landing de marketing): crea el lead + reserva de prueba. p_tenant_id
-- obligatorio (viene del dominio/portal donde está el formulario).
create or replace function public.agendar_clase_prueba(
  p_tenant_id uuid, p_horario_id uuid, p_fecha date, p_nombre text, p_email text, p_telefono text,
  p_genero text default null, p_como_se_entero text default null
)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_sede_id uuid; v_cupo int; v_ocupadas int;
  v_cliente_id uuid; v_reserva_id uuid; v_estado_existente text;
  v_cliente_nuevo boolean := false; v_email_contacto text; v_telefono text;
begin
  if coalesce(trim(p_email), '') = '' then raise exception 'Ingresa tu correo para crear tu cuenta'; end if;
  v_telefono := public.telefono_normalizado(p_telefono);
  if v_telefono is null then raise exception 'Ingresa un teléfono válido.'; end if;

  select sede_id, cupo_maximo into v_sede_id, v_cupo from public.horarios
    where id = p_horario_id and tenant_id = p_tenant_id and activo = true and categoria = 'regular';
  if v_cupo is null then raise exception 'Horario no válido'; end if;

  if not public._fecha_coincide_horario(p_horario_id, p_fecha) then raise exception 'Esa fecha no corresponde a ese horario.'; end if;
  if exists (select 1 from public.horario_fechas_privadas where horario_id = p_horario_id and fecha = p_fecha) then
    raise exception 'Ese horario no tiene cupo disponible en esa fecha';
  end if;
  if exists (select 1 from public.horario_cancelaciones where horario_id = p_horario_id and fecha = p_fecha) then
    raise exception 'Ese horario no tiene clase en esa fecha.';
  end if;
  select count(*) into v_ocupadas from public.reservas where horario_id = p_horario_id and fecha = p_fecha and estado = 'confirmada';
  if v_ocupadas >= v_cupo then raise exception 'Ese horario ya no tiene cupo disponible'; end if;

  select id into v_cliente_id from public.clientes
    where tenant_id = p_tenant_id and regexp_replace(telefono, '\D', '', 'g') = v_telefono and tutor_id is null limit 1;

  if v_cliente_id is null then
    v_cliente_nuevo := true;
    insert into public.clientes (tenant_id, nombre, email, telefono, genero, como_se_entero)
      values (p_tenant_id, p_nombre, p_email, v_telefono, p_genero, p_como_se_entero)
      returning id, email into v_cliente_id, v_email_contacto;
  else
    update public.clientes set
        nombre = case when coalesce(trim(nombre), '') = '' then p_nombre else nombre end,
        email = coalesce(email, p_email), genero = coalesce(genero, p_genero), como_se_entero = coalesce(como_se_entero, p_como_se_entero)
      where id = v_cliente_id returning email into v_email_contacto;
  end if;

  if exists (select 1 from public.reservas where cliente_id = v_cliente_id and tipo = 'prueba' and estado <> 'cancelada') then
    raise exception 'Ya tienes una clase de prueba registrada. Elige un paquete para reservar tu próxima clase.';
  end if;

  select id, estado into v_reserva_id, v_estado_existente from public.reservas
    where horario_id = p_horario_id and cliente_id = v_cliente_id and fecha = p_fecha;
  if v_reserva_id is not null and v_estado_existente = 'confirmada' then
    raise exception 'Ya tienes una reserva confirmada en esa clase.';
  end if;

  if v_reserva_id is not null then
    update public.reservas set estado = 'confirmada', tipo = 'prueba' where id = v_reserva_id;
  else
    insert into public.reservas (tenant_id, sede_id, horario_id, cliente_id, fecha, tipo, estado)
      values (p_tenant_id, v_sede_id, p_horario_id, v_cliente_id, p_fecha, 'prueba', 'confirmada')
      returning id into v_reserva_id;
  end if;

  return json_build_object('ok', true, 'reserva_id', v_reserva_id, 'cliente_id', v_cliente_id, 'cliente_nuevo', v_cliente_nuevo, 'email_contacto', v_email_contacto);
end;
$$;
revoke all on function public.agendar_clase_prueba(uuid, uuid, date, text, text, text, text, text) from public;
grant execute on function public.agendar_clase_prueba(uuid, uuid, date, text, text, text, text, text) to anon, authenticated;

create or replace function public.agendar_clase_prueba_propia(p_horario_id uuid, p_fecha date, p_cliente_id uuid default null)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid; v_sede_id uuid; v_cupo int; v_ocupadas int;
  v_propio_id uuid; v_cliente_id uuid; v_reserva_id uuid; v_estado_existente text;
begin
  select tenant_id, sede_id, cupo_maximo into v_tenant_id, v_sede_id, v_cupo
    from public.horarios where id = p_horario_id and activo = true and categoria = 'regular';
  if v_tenant_id is null then raise exception 'Horario no válido'; end if;

  v_propio_id := public.mi_cliente_id(v_tenant_id);
  if v_propio_id is null then raise exception 'Completa tu perfil antes de reservar'; end if;

  v_cliente_id := v_propio_id;
  if p_cliente_id is not null and p_cliente_id <> v_propio_id then
    if not exists (select 1 from public.clientes where id = p_cliente_id and tutor_id = v_propio_id and tenant_id = v_tenant_id) then
      raise exception 'No tienes permiso para reservar por esa persona.';
    end if;
    v_cliente_id := p_cliente_id;
  end if;

  if not public._fecha_coincide_horario(p_horario_id, p_fecha) then raise exception 'Esa fecha no corresponde a ese horario.'; end if;
  if exists (select 1 from public.horario_fechas_privadas where horario_id = p_horario_id and fecha = p_fecha) then
    raise exception 'Ese horario no tiene cupo disponible en esa fecha';
  end if;
  if exists (select 1 from public.horario_cancelaciones where horario_id = p_horario_id and fecha = p_fecha) then
    raise exception 'Ese horario no tiene clase en esa fecha.';
  end if;
  select count(*) into v_ocupadas from public.reservas where horario_id = p_horario_id and fecha = p_fecha and estado = 'confirmada';
  if v_ocupadas >= v_cupo then raise exception 'Ese horario ya no tiene cupo disponible'; end if;

  if exists (select 1 from public.reservas where cliente_id = v_cliente_id and tipo = 'prueba' and estado <> 'cancelada') then
    raise exception 'Ya tiene una clase de prueba registrada. Elige un paquete para reservar la próxima clase.';
  end if;

  select id, estado into v_reserva_id, v_estado_existente from public.reservas
    where horario_id = p_horario_id and cliente_id = v_cliente_id and fecha = p_fecha;
  if v_reserva_id is not null and v_estado_existente = 'confirmada' then
    raise exception 'Ya tiene una reserva confirmada en esa clase.';
  end if;

  if v_reserva_id is not null then
    update public.reservas set estado = 'confirmada', tipo = 'prueba' where id = v_reserva_id;
  else
    insert into public.reservas (tenant_id, sede_id, horario_id, cliente_id, fecha, tipo, estado)
      values (v_tenant_id, v_sede_id, p_horario_id, v_cliente_id, p_fecha, 'prueba', 'confirmada')
      returning id into v_reserva_id;
  end if;

  return json_build_object('ok', true, 'reserva_id', v_reserva_id, 'cliente_id', v_cliente_id);
end;
$$;
revoke all on function public.agendar_clase_prueba_propia(uuid, date, uuid) from public;
grant execute on function public.agendar_clase_prueba_propia(uuid, date, uuid) to authenticated;

create or replace function public.agendar_clase_privada(p_horario_id uuid, p_fecha date, p_cliente_id uuid default null)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid; v_sede_id uuid; v_propio_id uuid; v_cliente_id uuid;
  v_cupo int; v_categoria text; v_ocupadas int; v_membresia_id uuid;
  v_reserva_id uuid; v_estado_existente text;
begin
  select tenant_id, sede_id, cupo_maximo, categoria into v_tenant_id, v_sede_id, v_cupo, v_categoria
    from public.horarios where id = p_horario_id and activo = true;
  if v_tenant_id is null or v_categoria <> 'privado' then raise exception 'Horario no válido'; end if;

  v_propio_id := public.mi_cliente_id(v_tenant_id);
  if v_propio_id is null then raise exception 'Completa tu perfil antes de reservar'; end if;
  v_cliente_id := v_propio_id;
  if p_cliente_id is not null and p_cliente_id <> v_propio_id then
    if not exists (select 1 from public.clientes where id = p_cliente_id and tutor_id = v_propio_id and tenant_id = v_tenant_id) then
      raise exception 'No tienes permiso para reservar por esa persona.';
    end if;
    v_cliente_id := p_cliente_id;
  end if;

  if not public._fecha_coincide_horario(p_horario_id, p_fecha) then raise exception 'Esa fecha no corresponde a ese horario.'; end if;

  select count(*) into v_ocupadas from public.reservas where horario_id = p_horario_id and fecha = p_fecha and estado = 'confirmada';
  if v_ocupadas >= v_cupo then raise exception 'Ese horario ya no tiene cupo disponible'; end if;

  select id, estado into v_reserva_id, v_estado_existente from public.reservas
    where horario_id = p_horario_id and cliente_id = v_cliente_id and fecha = p_fecha;
  if v_reserva_id is not null and v_estado_existente = 'confirmada' then raise exception 'Ya tiene una reserva confirmada en esa clase.'; end if;

  select m.id into v_membresia_id from public.membresias m join public.paquetes pq on pq.id = m.paquete_id
    where m.cliente_id = v_cliente_id and pq.categoria = 'privado' and m.estado = 'activa' and m.congelada_desde is null
      and m.fecha_vencimiento >= p_fecha and (m.clases_totales is null or m.clases_usadas < m.clases_totales)
      and public.membresia_cubre_sede(m.id, v_sede_id)
    order by m.fecha_vencimiento asc limit 1;
  if v_membresia_id is null then raise exception 'No tienes un paquete de clase privada activo. Compra uno primero.'; end if;

  if v_reserva_id is not null then
    update public.reservas set estado = 'confirmada', tipo = 'privado' where id = v_reserva_id;
  else
    insert into public.reservas (tenant_id, sede_id, horario_id, cliente_id, fecha, tipo, estado)
      values (v_tenant_id, v_sede_id, p_horario_id, v_cliente_id, p_fecha, 'privado', 'confirmada')
      returning id into v_reserva_id;
  end if;

  update public.membresias set clases_usadas = clases_usadas + 1 where id = v_membresia_id;
  return json_build_object('ok', true, 'reserva_id', v_reserva_id);
end;
$$;
revoke all on function public.agendar_clase_privada(uuid, date, uuid) from public;
grant execute on function public.agendar_clase_privada(uuid, date, uuid) to authenticated;

create or replace function public.asignar_clase_privada_manual(
  p_cliente_id uuid, p_paquete_id uuid, p_horario_id uuid, p_fecha date, p_metodo_pago text default 'efectivo'
)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid; v_sede_id uuid; v_paquete record; v_cupo int; v_categoria_horario text;
  v_ocupadas int; v_membresia_id uuid; v_reserva_id uuid;
begin
  select tenant_id, sede_id, cupo_maximo, categoria into v_tenant_id, v_sede_id, v_cupo, v_categoria_horario
    from public.horarios where id = p_horario_id and activo = true;
  if v_tenant_id is null or v_categoria_horario <> 'privado' then raise exception 'Horario no válido'; end if;

  if not public.staff_puede_en_sede(v_tenant_id, v_sede_id, array['duena','gerente_general','admin_sede','recepcion']) then
    raise exception 'No autorizado';
  end if;
  if p_metodo_pago not in ('transferencia', 'tarjeta_estudio', 'efectivo', 'pasarela') then
    raise exception 'Método de pago no válido';
  end if;

  select * into v_paquete from public.paquetes where id = p_paquete_id and tenant_id = v_tenant_id and activo = true and categoria = 'privado';
  if v_paquete is null then raise exception 'Paquete no válido'; end if;
  if not exists (select 1 from public.clientes where id = p_cliente_id and tenant_id = v_tenant_id) then raise exception 'Clienta no encontrada'; end if;

  select count(*) into v_ocupadas from public.reservas where horario_id = p_horario_id and fecha = p_fecha and estado = 'confirmada';
  if v_ocupadas >= v_cupo then raise exception 'Ese horario ya tiene una reserva — elige otra fecha.'; end if;

  insert into public.membresias (tenant_id, cliente_id, paquete_id, sede_venta_id, cobertura_tipo, metodo_pago, precio_final,
    estado, clases_totales, clases_usadas, fecha_inicio, fecha_vencimiento, pagada, origen, confirmado_at, confirmado_por)
    values (v_tenant_id, p_cliente_id, p_paquete_id, v_sede_id, v_paquete.cobertura, p_metodo_pago, v_paquete.precio,
      'activa', v_paquete.num_clases, 1, public.hoy_en_sede(v_sede_id), public.hoy_en_sede(v_sede_id) + v_paquete.vigencia_dias,
      true, 'compra', now(), auth.uid())
    returning id into v_membresia_id;
  perform public._snapshot_cobertura_membresia(v_membresia_id, p_paquete_id);

  insert into public.reservas (tenant_id, sede_id, horario_id, cliente_id, fecha, tipo, estado)
    values (v_tenant_id, v_sede_id, p_horario_id, p_cliente_id, p_fecha, 'privado', 'confirmada')
    returning id into v_reserva_id;

  return json_build_object('ok', true, 'membresia_id', v_membresia_id, 'reserva_id', v_reserva_id);
end;
$$;
revoke all on function public.asignar_clase_privada_manual(uuid, uuid, uuid, date, text) from public;
grant execute on function public.asignar_clase_privada_manual(uuid, uuid, uuid, date, text) to authenticated;

create or replace function public.disponibilidad(p_tenant_id uuid, p_desde date, p_hasta date)
returns table(horario_id uuid, sede_id uuid, fecha date, hora_inicio time, hora_fin time, nombre_clase text,
  cupo_maximo integer, cupo_disponible integer, instructor_nombre text)
language sql stable security definer
set search_path to 'public'
as $$
  select h.id, h.sede_id, d.fecha, h.hora_inicio, h.hora_fin, h.nombre_clase, h.cupo_maximo,
    case when hp.id is not null then 0 else h.cupo_maximo - coalesce(r.ocupadas, 0) end,
    tm.nombre
  from public.horarios h
  cross join lateral generate_series(p_desde, p_hasta, interval '1 day') as d(fecha)
  left join lateral (
    select count(*) as ocupadas from public.reservas where horario_id = h.id and fecha = d.fecha::date and estado = 'confirmada'
  ) r on true
  left join public.tenant_memberships tm on tm.id = h.instructor_membership_id
  left join public.horario_fechas_privadas hp on hp.horario_id = h.id and hp.fecha = d.fecha::date
  left join public.horario_cancelaciones hc on hc.horario_id = h.id and hc.fecha = d.fecha::date
  where h.tenant_id = p_tenant_id and h.activo = true
    and (d.fecha::date + h.hora_inicio) > public.ahora_en_sede(h.sede_id)
    and h.categoria = 'regular'
    and extract(dow from d.fecha) = h.dia_semana
    and hc.horario_id is null
  order by d.fecha, h.hora_inicio;
$$;
revoke all on function public.disponibilidad(uuid, date, date) from public;
grant execute on function public.disponibilidad(uuid, date, date) to authenticated, anon;

create or replace function public.disponibilidad_privada(p_tenant_id uuid, p_desde date, p_hasta date)
returns table(horario_id uuid, sede_id uuid, fecha date, hora_inicio time, hora_fin time, nombre_clase text,
  cupo_maximo integer, cupo_disponible integer, instructor_nombre text)
language sql stable security definer
set search_path to 'public'
as $$
  select h.id, h.sede_id, d.fecha, h.hora_inicio, h.hora_fin, h.nombre_clase, h.cupo_maximo,
    h.cupo_maximo - coalesce(r.ocupadas, 0), tm.nombre
  from public.horarios h
  cross join lateral generate_series(p_desde, p_hasta, interval '1 day') as d(fecha)
  left join lateral (
    select count(*) as ocupadas from public.reservas where horario_id = h.id and fecha = d.fecha::date and estado = 'confirmada'
  ) r on true
  left join public.tenant_memberships tm on tm.id = h.instructor_membership_id
  where h.tenant_id = p_tenant_id and h.activo = true
    and (d.fecha::date + h.hora_inicio) > public.ahora_en_sede(h.sede_id)
    and h.categoria = 'privado'
    and ((h.fecha_especifica is not null and h.fecha_especifica = d.fecha) or (h.fecha_especifica is null and extract(dow from d.fecha) = h.dia_semana))
  order by d.fecha, h.hora_inicio;
$$;
revoke all on function public.disponibilidad_privada(uuid, date, date) from public;
grant execute on function public.disponibilidad_privada(uuid, date, date) to authenticated;

-- Trigger de lista_espera equivalente a bloquear_reserva_clase_empezada, pero para inserts en
-- lista_espera directamente (unirse_lista_espera ya valida esto, pero el trigger cubre cualquier
-- otro camino de escritura).
create or replace function public.bloquear_espera_clase_empezada()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_hora time; v_sede_id uuid;
begin
  select hora_inicio, sede_id into v_hora, v_sede_id from public.horarios where id = new.horario_id;
  if v_hora is not null and (new.fecha + v_hora) <= public.ahora_en_sede(v_sede_id) then
    raise exception 'Esa clase ya empezó — elige otro horario.';
  end if;
  return new;
end;
$$;
create trigger lista_espera_bloquear_clase_empezada before insert on public.lista_espera
  for each row execute function public.bloquear_espera_clase_empezada();

-- Cron: libera reservas no confirmadas a tiempo (recorre todos los tenants, service_role).
create or replace function public.liberar_cupos_no_confirmados()
returns table(tenant_id uuid, reserva_id uuid, nombre text, email text, user_id uuid, nombre_clase text, hora_inicio time, fecha date)
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_reg record;
begin
  for v_reg in
    select r.tenant_id as t_id, r.id as reserva_id, r.cliente_id, h.hora_inicio, h.cupo_maximo, h.nombre_clase,
      c.nombre as cliente_nombre, c.email as cliente_email, c.user_id as cliente_user_id
    from public.reservas r
    join public.horarios h on h.id = r.horario_id
    join public.clientes c on c.id = r.cliente_id
    join public.configuracion_reservas cr on cr.tenant_id = r.tenant_id
    where r.estado = 'confirmada' and r.tipo = 'regular' and r.confirmada_por_clienta_at is null
      and (r.fecha + h.hora_inicio) > public.ahora_en_sede(r.sede_id)
      and (r.fecha + h.hora_inicio) <= public.ahora_en_sede(r.sede_id) + (coalesce(cr.horas_minimas_confirmacion, 1) || ' hours')::interval
      and (select count(*) from public.reservas r2 where r2.horario_id = r.horario_id and r2.fecha = r.fecha and r2.estado = 'confirmada') >= h.cupo_maximo
  loop
    update public.reservas set estado = 'cancelada', liberada_por_no_confirmar = true, penalizada = true where id = v_reg.reserva_id;
    tenant_id := v_reg.t_id; reserva_id := v_reg.reserva_id; nombre := v_reg.cliente_nombre; email := v_reg.cliente_email;
    user_id := v_reg.cliente_user_id; nombre_clase := v_reg.nombre_clase; hora_inicio := v_reg.hora_inicio; fecha := v_reg.fecha;
    return next;
  end loop;
end;
$$;
revoke all on function public.liberar_cupos_no_confirmados() from public;
grant execute on function public.liberar_cupos_no_confirmados() to service_role;

create or replace function public.liberar_privatizacion_si_cancela()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
begin
  if new.estado = 'cancelada' and old.estado <> 'cancelada' then
    delete from public.horario_fechas_privadas_personas where reserva_id = new.id;
  end if;
  return new;
end;
$$;
create trigger reservas_liberar_privatizacion_si_cancela after update on public.reservas
  for each row execute function public.liberar_privatizacion_si_cancela();

create or replace function public.quitar_privatizacion_fecha(p_horario_id uuid, p_fecha date)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid; v_sede_id uuid; v_privatizacion_id uuid;
begin
  select tenant_id, sede_id into v_tenant_id, v_sede_id from public.horarios where id = p_horario_id;
  if v_tenant_id is null then raise exception 'Horario no válido'; end if;
  if not public.staff_puede_en_sede(v_tenant_id, v_sede_id, array['duena','gerente_general','admin_sede']) then
    raise exception 'No autorizado';
  end if;

  select id into v_privatizacion_id from public.horario_fechas_privadas where horario_id = p_horario_id and fecha = p_fecha;
  if v_privatizacion_id is null then raise exception 'Esa fecha no está privatizada.'; end if;

  update public.reservas set estado = 'cancelada'
    where id in (select reserva_id from public.horario_fechas_privadas_personas where privatizacion_id = v_privatizacion_id and reserva_id is not null)
      and estado <> 'cancelada';
  delete from public.horario_fechas_privadas where id = v_privatizacion_id;
  return json_build_object('ok', true);
end;
$$;
revoke all on function public.quitar_privatizacion_fecha(uuid, date) from public;
grant execute on function public.quitar_privatizacion_fecha(uuid, date) to authenticated;

create or replace function public.quitar_persona_privatizacion(p_horario_id uuid, p_fecha date, p_cliente_id uuid)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid; v_sede_id uuid; v_privatizacion_id uuid; v_reserva_id uuid;
begin
  select tenant_id, sede_id into v_tenant_id, v_sede_id from public.horarios where id = p_horario_id;
  if v_tenant_id is null then raise exception 'Horario no válido'; end if;
  if not public.staff_puede_en_sede(v_tenant_id, v_sede_id, array['duena','gerente_general','admin_sede','recepcion']) then
    raise exception 'No autorizado';
  end if;

  select id into v_privatizacion_id from public.horario_fechas_privadas where horario_id = p_horario_id and fecha = p_fecha;
  if v_privatizacion_id is null then raise exception 'Esa fecha no está privatizada.'; end if;

  select reserva_id into v_reserva_id from public.horario_fechas_privadas_personas where privatizacion_id = v_privatizacion_id and cliente_id = p_cliente_id;
  if v_reserva_id is null then raise exception 'Esa clienta no está agregada a esta fecha privatizada.'; end if;

  update public.reservas set estado = 'cancelada' where id = v_reserva_id and estado <> 'cancelada';
  return json_build_object('ok', true);
end;
$$;
revoke all on function public.quitar_persona_privatizacion(uuid, date, uuid) from public;
grant execute on function public.quitar_persona_privatizacion(uuid, date, uuid) to authenticated;

create or replace function public.agregar_persona_privatizacion(p_horario_id uuid, p_fecha date, p_cliente_id uuid, p_precio numeric, p_metodo_pago text default 'efectivo')
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid; v_sede_id uuid; v_privatizacion_id uuid; v_cupo int;
  v_ocupadas int; v_reserva_id uuid; v_estado_existente text;
begin
  select tenant_id, sede_id into v_tenant_id, v_sede_id from public.horarios where id = p_horario_id;
  if v_tenant_id is null then raise exception 'Horario no válido'; end if;
  if not public.staff_puede_en_sede(v_tenant_id, v_sede_id, array['duena','gerente_general','admin_sede','recepcion']) then
    raise exception 'No autorizado';
  end if;
  if p_precio is null or p_precio <= 0 then raise exception 'Ingresa el precio del evento privado.'; end if;
  if p_metodo_pago not in ('transferencia', 'tarjeta_estudio', 'efectivo', 'pasarela') then raise exception 'Método de pago no válido'; end if;

  select id, cupo into v_privatizacion_id, v_cupo from public.horario_fechas_privadas where horario_id = p_horario_id and fecha = p_fecha;
  if v_privatizacion_id is null then raise exception 'Esa fecha no está privatizada.'; end if;
  if not exists (select 1 from public.clientes where id = p_cliente_id and tenant_id = v_tenant_id) then raise exception 'Clienta no encontrada'; end if;
  if exists (select 1 from public.horario_fechas_privadas_personas where privatizacion_id = v_privatizacion_id and cliente_id = p_cliente_id) then
    raise exception 'Esa clienta ya está agregada a esta fecha privatizada.';
  end if;

  select count(*) into v_ocupadas from public.horario_fechas_privadas_personas where privatizacion_id = v_privatizacion_id;
  if v_ocupadas >= v_cupo then raise exception 'Ya se llenó el cupo (%) de esta fecha privatizada.', v_cupo; end if;

  select id, estado into v_reserva_id, v_estado_existente from public.reservas where horario_id = p_horario_id and cliente_id = p_cliente_id and fecha = p_fecha;
  if v_reserva_id is not null and v_estado_existente = 'confirmada' then raise exception 'Esa clienta ya tiene una reserva confirmada en esa fecha.'; end if;

  if v_reserva_id is not null then
    update public.reservas set estado = 'confirmada', tipo = 'regular' where id = v_reserva_id;
  else
    insert into public.reservas (tenant_id, sede_id, horario_id, cliente_id, fecha, tipo, estado)
      values (v_tenant_id, v_sede_id, p_horario_id, p_cliente_id, p_fecha, 'regular', 'confirmada')
      returning id into v_reserva_id;
  end if;

  insert into public.horario_fechas_privadas_personas (tenant_id, privatizacion_id, cliente_id, reserva_id, precio, metodo_pago)
    values (v_tenant_id, v_privatizacion_id, p_cliente_id, v_reserva_id, p_precio, p_metodo_pago);

  return json_build_object('ok', true, 'reserva_id', v_reserva_id);
end;
$$;
revoke all on function public.agregar_persona_privatizacion(uuid, date, uuid, numeric, text) from public;
grant execute on function public.agregar_persona_privatizacion(uuid, date, uuid, numeric, text) to authenticated;

create or replace function public.mis_clientas_instructora(p_tenant_id uuid)
returns table(id uuid, nombre text, cuidados_especiales text, total_clases bigint, asistidas bigint)
language sql stable security definer
set search_path to 'public'
as $$
  select c.id, c.nombre, c.cuidados_especiales,
    count(*) filter (where r.fecha < public.hoy_en_sede(r.sede_id)),
    count(*) filter (where r.fecha < public.hoy_en_sede(r.sede_id) and r.estado = 'confirmada')
  from public.reservas r
  join public.horarios h on h.id = r.horario_id
  join public.clientes c on c.id = r.cliente_id
  where r.tenant_id = p_tenant_id
    and h.instructor_membership_id in (select id from public.tenant_memberships where user_id = auth.uid() and tenant_id = p_tenant_id and role = 'instructora')
  group by c.id, c.nombre, c.cuidados_especiales
  order by c.nombre;
$$;
revoke all on function public.mis_clientas_instructora(uuid) from public;
grant execute on function public.mis_clientas_instructora(uuid) to authenticated;

create or replace function public.kpi_instructora(p_tenant_id uuid, p_instructor_membership_id uuid)
returns json
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_es_la_misma_instructora boolean;
  v_ocupacion numeric; v_total_clases int; v_top_clientas json;
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','instructora']) then
    raise exception 'No autorizado';
  end if;
  select exists(select 1 from public.tenant_memberships where id = p_instructor_membership_id and user_id = auth.uid())
    into v_es_la_misma_instructora;
  if public.tengo_rol_en_tenant(p_tenant_id, array['instructora']) and not v_es_la_misma_instructora
     and not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then
    raise exception 'No autorizado';
  end if;

  select round(avg(ocupacion), 1), count(*) into v_ocupacion, v_total_clases
  from (
    select r.fecha, r.horario_id, count(*)::numeric / h.cupo_maximo * 100 as ocupacion
    from public.reservas r join public.horarios h on h.id = r.horario_id
    where h.instructor_membership_id = p_instructor_membership_id and r.estado = 'confirmada' and r.fecha < public.hoy_en_sede(r.sede_id)
    group by r.fecha, r.horario_id, h.cupo_maximo
  ) sesiones;

  select json_agg(t) into v_top_clientas from (
    select c.nombre, count(*) as clases
    from public.reservas r join public.horarios h on h.id = r.horario_id join public.clientes c on c.id = r.cliente_id
    where h.instructor_membership_id = p_instructor_membership_id and r.estado = 'confirmada' and r.fecha < public.hoy_en_sede(r.sede_id)
    group by c.nombre order by count(*) desc limit 5
  ) t;

  return json_build_object('ocupacion_promedio', coalesce(v_ocupacion, 0), 'total_clases_dictadas', coalesce(v_total_clases, 0), 'clientas_top', coalesce(v_top_clientas, '[]'::json));
end;
$$;
revoke all on function public.kpi_instructora(uuid, uuid) from public;
grant execute on function public.kpi_instructora(uuid, uuid) to authenticated;

-- Trigger: marca la reserva de prueba original como "convertida" cuando la clienta paga su primera membresía real.
create or replace function public._marcar_lead_convertida()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
begin
  if new.pagada = true and (tg_op = 'INSERT' or old.pagada is distinct from true) then
    update public.reservas set estado_lead = 'convertida'
      where cliente_id = new.cliente_id and tipo = 'prueba' and estado_lead is distinct from 'convertida';
  end if;
  return new;
end;
$$;
create trigger membresias_marcar_lead_convertida after insert or update on public.membresias
  for each row execute function public._marcar_lead_convertida();
