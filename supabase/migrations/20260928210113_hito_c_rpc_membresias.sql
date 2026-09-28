-- Hito C — RPCs de negocio, dominio membresías/pagos/privatización.
-- Mismas reglas que la migración anterior (tenant derivado del recurso, nunca del cliente).
--
-- Diferido a propósito (dependen de tablas del módulo "resto", no núcleo):
--   - agregar_cobro_personalizado (tabla cobros_personalizados — POS/cobros manuales)
--   - soporte de códigos de descuento en solicitar_membresia/agregar_membresia_manual/editar_cobro_membresia
--     (tablas codigos_descuento* — Crecimiento)
--   - bono de referido al confirmar pago (otorgar_bono_referido_si_corresponde — Crecimiento)
-- editar_cobro_membresia se porta solo con override manual de % (sin código), que sí es núcleo.

-- ¿La membresía cubre esta sede? Fuente única de verdad: paquete_sedes (incluye el caso 'sede' con
-- una sola fila) salvo cobertura 'todas', que nunca se enumera (incluye sedes futuras — sección 7 del maestro).
create or replace function public.membresia_cubre_sede(p_membresia_id uuid, p_sede_id uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.membresias m
      where m.id = p_membresia_id and (
        m.cobertura_tipo = 'todas'
        or exists (select 1 from public.membresia_sedes ms where ms.membresia_id = m.id and ms.sede_id = p_sede_id)
      )
  );
$$;
revoke all on function public.membresia_cubre_sede(uuid, uuid) from public;
grant execute on function public.membresia_cubre_sede(uuid, uuid) to authenticated;

-- Corrección: la versión anterior de admin_agregar_reserva revisaba sede_venta_id para cobertura
-- 'sede' en vez de usar paquete_sedes como todo lo demás — se unifica con membresia_cubre_sede.
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

  if not public._fecha_coincide_horario(p_horario_id, p_fecha) then
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
        and congelada_desde is null and fecha_vencimiento >= p_fecha
        and (clases_totales is null or clases_usadas < clases_totales)
        and public.membresia_cubre_sede(id, v_sede_id)
      order by fecha_vencimiento asc limit 1;

    if v_membresia_id is null then
      select coalesce(tutor_id, id) into v_tutor_familia_id from public.clientes where id = p_cliente_id;
      select m.id, m.clases_totales into v_membresia_id, v_clases_totales
        from public.membresias m join public.paquetes pq on pq.id = m.paquete_id
        where m.cliente_id = v_tutor_familia_id and pq.compartido_familiar = true
          and m.estado = 'activa' and m.congelada_desde is null and m.fecha_vencimiento >= p_fecha
          and (m.clases_totales is null or m.clases_usadas < m.clases_totales)
          and public.membresia_cubre_sede(m.id, v_sede_id)
        order by m.fecha_vencimiento asc limit 1;
    end if;

    if v_membresia_id is null then
      raise exception 'Esta clienta no tiene un paquete activo con cupo para esta sede — asígnale uno primero, o márcala como clase de prueba.';
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

-- Snapshot de cobertura al crear una membresía (copia paquete_sedes → membresia_sedes; nada si 'todas').
create or replace function public._snapshot_cobertura_membresia(p_membresia_id uuid, p_paquete_id uuid)
returns void
language plpgsql security definer
set search_path to 'public'
as $$
begin
  insert into public.membresia_sedes (membresia_id, sede_id)
    select p_membresia_id, sede_id from public.paquete_sedes where paquete_id = p_paquete_id
    on conflict do nothing;
end;
$$;
revoke all on function public._snapshot_cobertura_membresia(uuid, uuid) from public;

create or replace function public.solicitar_membresia(
  p_paquete_id uuid, p_referencia_pago text, p_metodo_pago text default 'transferencia',
  p_comprobante_url text default null, p_cliente_id uuid default null
)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid;
  v_propio_id uuid;
  v_cliente_id uuid;
  v_paquete record;
  v_membresia_id uuid;
begin
  select tenant_id into v_tenant_id from public.paquetes where id = p_paquete_id and activo = true;
  if v_tenant_id is null then
    raise exception 'Paquete no válido';
  end if;

  v_propio_id := public.mi_cliente_id(v_tenant_id);
  if v_propio_id is null then
    raise exception 'Primero completa tu registro';
  end if;

  v_cliente_id := v_propio_id;
  if p_cliente_id is not null and p_cliente_id <> v_propio_id then
    if not exists (select 1 from public.clientes where id = p_cliente_id and tutor_id = v_propio_id and tenant_id = v_tenant_id) then
      raise exception 'No tienes permiso para comprar un paquete para esa persona.';
    end if;
    v_cliente_id := p_cliente_id;
  end if;

  select num_clases, vigencia_dias, precio, cobertura into v_paquete from public.paquetes where id = p_paquete_id;

  if p_metodo_pago not in ('transferencia','tarjeta_estudio') then
    raise exception 'Método de pago no válido';
  end if;

  if p_metodo_pago = 'transferencia' then
    p_referencia_pago := trim(p_referencia_pago);
    if coalesce(p_referencia_pago, '') = '' then
      raise exception 'Ingresa el número de referencia de tu transferencia';
    end if;
    if length(regexp_replace(p_referencia_pago, '\s', '', 'g')) < 6 then
      raise exception 'Ese número de referencia se ve incompleto — cópialo tal cual aparece en tu comprobante de transferencia.';
    end if;
    if p_referencia_pago ~ '^(.)\1*$' then
      raise exception 'Ese número de referencia no parece real — cópialo tal cual aparece en tu comprobante de transferencia.';
    end if;
    if exists (
      select 1 from public.membresias
        where tenant_id = v_tenant_id and metodo_pago = 'transferencia' and estado <> 'anulada'
          and referencia_pago = p_referencia_pago
    ) then
      raise exception 'Ese número de referencia ya se usó antes en otra solicitud. Si crees que es un error, contacta al estudio directamente.';
    end if;
  end if;

  insert into public.membresias
    (tenant_id, cliente_id, paquete_id, cobertura_tipo, referencia_pago, metodo_pago, comprobante_url,
     estado, clases_totales, clases_usadas, fecha_inicio, fecha_vencimiento, pagada)
    values
    (v_tenant_id, v_cliente_id, p_paquete_id, v_paquete.cobertura, nullif(trim(p_referencia_pago), ''), p_metodo_pago, p_comprobante_url,
     'activa', 1, 0, public.hoy_en_sede(null), public.hoy_en_sede(null) + v_paquete.vigencia_dias, false)
    returning id into v_membresia_id;

  perform public._snapshot_cobertura_membresia(v_membresia_id, p_paquete_id);

  return json_build_object('ok', true, 'membresia_id', v_membresia_id, 'activa_al_instante', true, 'capada_a_una_clase', true);
end;
$$;
revoke all on function public.solicitar_membresia(uuid, text, text, text, uuid) from public;
grant execute on function public.solicitar_membresia(uuid, text, text, text, uuid) to authenticated;

create or replace function public.agregar_membresia_manual(
  p_cliente_id uuid, p_paquete_id uuid, p_sede_venta_id uuid,
  p_metodo_pago text default 'tarjeta_estudio', p_fecha_cobro date default null
)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_paquete record;
  v_tenant_id uuid;
  v_membresia_id uuid;
  v_origen text := 'compra';
  v_precio_final numeric;
  v_confirmado_at timestamptz := now();
  v_roles_permitidos text[];
begin
  select * into v_paquete from public.paquetes where id = p_paquete_id and activo = true;
  if v_paquete is null then raise exception 'Paquete no válido'; end if;
  v_tenant_id := v_paquete.tenant_id;

  if not exists (select 1 from public.clientes where id = p_cliente_id and tenant_id = v_tenant_id) then
    raise exception 'Clienta no encontrada';
  end if;
  if not exists (select 1 from public.sedes where id = p_sede_venta_id and tenant_id = v_tenant_id) then
    raise exception 'Sede no válida';
  end if;

  if p_metodo_pago not in ('transferencia', 'tarjeta_estudio', 'efectivo', 'cortesia', 'pasarela') then
    raise exception 'Método de pago no válido';
  end if;

  v_roles_permitidos := case when p_metodo_pago = 'cortesia' then array['duena','gerente_general'] else array['duena','gerente_general','admin_sede','recepcion'] end;
  if not public.staff_puede_en_sede(v_tenant_id, p_sede_venta_id, v_roles_permitidos) then
    raise exception 'No autorizado';
  end if;

  if p_fecha_cobro is not null then
    if not public.staff_puede_en_sede(v_tenant_id, p_sede_venta_id, array['duena','gerente_general','admin_sede']) then
      raise exception 'No autorizado a registrar un cobro con fecha atrasada';
    end if;
    if p_fecha_cobro > public.hoy_en_sede(p_sede_venta_id) then
      raise exception 'La fecha del cobro no puede ser a futuro';
    end if;
    if p_fecha_cobro < public.hoy_en_sede(p_sede_venta_id) - 14 then
      raise exception 'Esa fecha es de hace más de 14 días — corrígelo manualmente si el atraso es mayor.';
    end if;
    v_confirmado_at := (p_fecha_cobro::timestamp + interval '12 hours');
  end if;

  if p_metodo_pago = 'cortesia' then
    v_origen := 'cortesia';
    v_precio_final := 0;
  else
    v_precio_final := v_paquete.precio;
  end if;

  insert into public.membresias
    (tenant_id, cliente_id, paquete_id, sede_venta_id, cobertura_tipo, metodo_pago, precio_final, estado,
     clases_totales, clases_usadas, fecha_inicio, fecha_vencimiento, pagada, origen, confirmado_at, confirmado_por)
    values
    (v_tenant_id, p_cliente_id, p_paquete_id, p_sede_venta_id, v_paquete.cobertura,
     p_metodo_pago, v_precio_final, 'activa', v_paquete.num_clases, 0,
     public.hoy_en_sede(p_sede_venta_id), public.hoy_en_sede(p_sede_venta_id) + v_paquete.vigencia_dias,
     true, v_origen, v_confirmado_at, auth.uid())
    returning id into v_membresia_id;

  perform public._snapshot_cobertura_membresia(v_membresia_id, p_paquete_id);

  return json_build_object('ok', true, 'membresia_id', v_membresia_id, 'precio_final', v_precio_final);
end;
$$;
revoke all on function public.agregar_membresia_manual(uuid, uuid, uuid, text, date) from public;
grant execute on function public.agregar_membresia_manual(uuid, uuid, uuid, text, date) to authenticated;

create or replace function public.confirmar_pago_membresia(p_membresia_id uuid)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_membresia record;
  v_paquete record;
begin
  select tenant_id, cliente_id, paquete_id, sede_venta_id into v_membresia from public.membresias where id = p_membresia_id;
  if v_membresia is null then raise exception 'Membresía no encontrada'; end if;

  if not public.staff_puede_en_sede(v_membresia.tenant_id, v_membresia.sede_venta_id, array['duena','gerente_general','admin_sede','recepcion']) then
    raise exception 'No autorizado';
  end if;

  select num_clases, vigencia_dias, precio into v_paquete from public.paquetes where id = v_membresia.paquete_id;

  update public.membresias set
    estado = 'activa',
    clases_totales = v_paquete.num_clases,
    fecha_inicio = public.hoy_en_sede(v_membresia.sede_venta_id),
    fecha_vencimiento = public.hoy_en_sede(v_membresia.sede_venta_id) + v_paquete.vigencia_dias,
    confirmado_at = now(),
    confirmado_por = auth.uid(),
    precio_final = v_paquete.precio,
    pagada = true
  where id = p_membresia_id;

  return json_build_object('ok', true, 'precio_final', v_paquete.precio);
end;
$$;
revoke all on function public.confirmar_pago_membresia(uuid) from public;
grant execute on function public.confirmar_pago_membresia(uuid) to authenticated;

create or replace function public.marcar_membresia_pagada(p_membresia_id uuid)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_membresia record;
  v_num_clases int;
  v_vigencia_dias int;
begin
  select tenant_id, sede_venta_id, cliente_id, paquete_id, origen, clases_totales into v_membresia
    from public.membresias where id = p_membresia_id and pagada = false;
  if v_membresia is null then raise exception 'Membresía no encontrada o ya pagada'; end if;

  if not public.staff_puede_en_sede(v_membresia.tenant_id, v_membresia.sede_venta_id, array['duena','gerente_general','admin_sede','recepcion']) then
    raise exception 'No autorizado';
  end if;

  select num_clases, vigencia_dias into v_num_clases, v_vigencia_dias from public.paquetes where id = v_membresia.paquete_id;

  update public.membresias set
    pagada = true,
    clases_totales = case when v_membresia.origen = 'compra' and v_num_clases is not null then greatest(v_membresia.clases_totales, v_num_clases) else v_membresia.clases_totales end,
    fecha_inicio = public.hoy_en_sede(v_membresia.sede_venta_id),
    fecha_vencimiento = public.hoy_en_sede(v_membresia.sede_venta_id) + coalesce(v_vigencia_dias, 30),
    confirmado_at = now(),
    confirmado_por = auth.uid()
  where id = p_membresia_id;

  return json_build_object('ok', true);
end;
$$;
revoke all on function public.marcar_membresia_pagada(uuid) from public;
grant execute on function public.marcar_membresia_pagada(uuid) to authenticated;

create or replace function public.rechazar_membresia_pendiente(p_membresia_id uuid, p_motivo text default null)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_m record;
  v_canceladas jsonb := '[]'::jsonb;
  v_r record;
begin
  select id, tenant_id, sede_venta_id, cliente_id, clases_usadas, created_at, pagada into v_m from public.membresias where id = p_membresia_id;
  if v_m is null then raise exception 'Membresía no encontrada'; end if;

  if not public.staff_puede_en_sede(v_m.tenant_id, v_m.sede_venta_id, array['duena','gerente_general','admin_sede','recepcion']) then
    raise exception 'No autorizado';
  end if;
  if v_m.pagada then
    raise exception 'Esta membresía ya está pagada — anúlala desde Pagos si hay un error, no la rechaces aquí.';
  end if;

  update public.membresias set estado = 'rechazada' where id = p_membresia_id;

  for v_r in select * from public._cancelar_reservas_de_membresia_rechazada(p_membresia_id, v_m.cliente_id, v_m.clases_usadas, v_m.created_at) loop
    v_canceladas := v_canceladas || jsonb_build_object('reserva_id', v_r.reserva_id, 'fecha', v_r.fecha, 'hora_inicio', v_r.hora_inicio, 'nombre_clase', v_r.nombre_clase);
  end loop;

  return json_build_object('ok', true, 'cliente_id', v_m.cliente_id, 'canceladas', v_canceladas);
end;
$$;
revoke all on function public.rechazar_membresia_pendiente(uuid, text) from public;
grant execute on function public.rechazar_membresia_pendiente(uuid, text) to authenticated;

create or replace function public.eliminar_membresia_pendiente(p_membresia_id uuid)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_m record;
  v_canceladas jsonb := '[]'::jsonb;
  v_r record;
begin
  select id, tenant_id, sede_venta_id, cliente_id, clases_usadas, created_at, pagada into v_m from public.membresias where id = p_membresia_id;
  if v_m is null then raise exception 'Membresía no encontrada'; end if;

  if not public.staff_puede_en_sede(v_m.tenant_id, v_m.sede_venta_id, array['duena','gerente_general','admin_sede','recepcion']) then
    raise exception 'No autorizado';
  end if;
  if v_m.pagada then
    raise exception 'Esta membresía ya está pagada — anúlala desde Pagos si hay un error, no la elimines aquí.';
  end if;

  for v_r in select * from public._cancelar_reservas_de_membresia_rechazada(p_membresia_id, v_m.cliente_id, v_m.clases_usadas, v_m.created_at) loop
    v_canceladas := v_canceladas || jsonb_build_object('reserva_id', v_r.reserva_id, 'fecha', v_r.fecha, 'hora_inicio', v_r.hora_inicio, 'nombre_clase', v_r.nombre_clase);
  end loop;

  delete from public.membresias where id = p_membresia_id;

  return json_build_object('ok', true, 'cliente_id', v_m.cliente_id, 'canceladas', v_canceladas);
end;
$$;
revoke all on function public.eliminar_membresia_pendiente(uuid) from public;
grant execute on function public.eliminar_membresia_pendiente(uuid) to authenticated;

create or replace function public.congelar_membresia(p_membresia_id uuid)
returns void
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid;
  v_sede_venta_id uuid;
begin
  select tenant_id, sede_venta_id into v_tenant_id, v_sede_venta_id from public.membresias where id = p_membresia_id;
  if v_tenant_id is null then raise exception 'Membresía no encontrada'; end if;

  if not public.staff_puede_en_sede(v_tenant_id, v_sede_venta_id, array['duena','gerente_general']) then
    raise exception 'No autorizado para congelar membresías';
  end if;

  update public.membresias
    set congelada_desde = public.hoy_en_sede(v_sede_venta_id)
    where id = p_membresia_id and estado = 'activa' and congelada_desde is null;

  if not found then
    raise exception 'Esta membresía no se puede congelar (no está activa o ya está congelada)';
  end if;
end;
$$;
revoke all on function public.congelar_membresia(uuid) from public;
grant execute on function public.congelar_membresia(uuid) to authenticated;

create or replace function public.descongelar_membresia(p_membresia_id uuid)
returns void
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid;
  v_sede_venta_id uuid;
  v_congelada_desde date;
  v_dias int;
begin
  select tenant_id, sede_venta_id, congelada_desde into v_tenant_id, v_sede_venta_id, v_congelada_desde
    from public.membresias where id = p_membresia_id;
  if v_tenant_id is null then raise exception 'Membresía no encontrada'; end if;

  if not public.staff_puede_en_sede(v_tenant_id, v_sede_venta_id, array['duena','gerente_general']) then
    raise exception 'No autorizado para descongelar membresías';
  end if;
  if v_congelada_desde is null then
    raise exception 'Esta membresía no está congelada';
  end if;

  v_dias := public.hoy_en_sede(v_sede_venta_id) - v_congelada_desde;

  update public.membresias set congelada_desde = null, fecha_vencimiento = fecha_vencimiento + v_dias
    where id = p_membresia_id;
end;
$$;
revoke all on function public.descongelar_membresia(uuid) from public;
grant execute on function public.descongelar_membresia(uuid) to authenticated;

create or replace function public.transferir_membresia(p_membresia_id uuid, p_cliente_destino_id uuid)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_membresia record;
  v_raiz_origen uuid;
  v_raiz_destino uuid;
begin
  select id, tenant_id, sede_venta_id, cliente_id, estado into v_membresia from public.membresias where id = p_membresia_id;
  if v_membresia is null then raise exception 'Paquete no encontrado'; end if;

  if not public.staff_puede_en_sede(v_membresia.tenant_id, v_membresia.sede_venta_id, array['duena','gerente_general']) then
    raise exception 'No autorizado para transferir un paquete';
  end if;
  if v_membresia.estado <> 'activa' then
    raise exception 'Solo se pueden transferir paquetes activos';
  end if;
  if v_membresia.cliente_id = p_cliente_destino_id then
    raise exception 'Ese paquete ya es de esa persona';
  end if;
  if not exists (select 1 from public.clientes where id = p_cliente_destino_id and tenant_id = v_membresia.tenant_id) then
    raise exception 'Persona destino no encontrada';
  end if;

  select coalesce(tutor_id, id) into v_raiz_origen from public.clientes where id = v_membresia.cliente_id;
  select coalesce(tutor_id, id) into v_raiz_destino from public.clientes where id = p_cliente_destino_id;
  if v_raiz_origen is distinct from v_raiz_destino then
    raise exception 'Solo puedes transferir paquetes entre miembros de la misma familia';
  end if;

  update public.membresias set
    transferida_de_id = v_membresia.cliente_id,
    transferida_at = now(),
    transferida_por = auth.uid(),
    cliente_id = p_cliente_destino_id
  where id = p_membresia_id;

  return json_build_object('ok', true);
end;
$$;
revoke all on function public.transferir_membresia(uuid, uuid) from public;
grant execute on function public.transferir_membresia(uuid, uuid) to authenticated;

-- Sin código de descuento (módulo resto) — solo override manual de %, que sí es núcleo (matriz P25).
create or replace function public.editar_cobro_membresia(p_membresia_id uuid, p_descuento_pct_manual numeric default null)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_membresia record;
  v_paquete record;
  v_descuento_pct numeric;
  v_precio_final numeric;
begin
  select id, tenant_id, sede_venta_id, paquete_id into v_membresia from public.membresias where id = p_membresia_id;
  if v_membresia is null then raise exception 'Membresía no encontrada'; end if;

  if not public.staff_puede_en_sede(v_membresia.tenant_id, v_membresia.sede_venta_id, array['duena','gerente_general']) then
    raise exception 'No autorizado para editar un cobro';
  end if;

  select precio into v_paquete from public.paquetes where id = v_membresia.paquete_id;
  if v_paquete is null then raise exception 'Paquete no encontrado'; end if;

  v_descuento_pct := coalesce(p_descuento_pct_manual, 0);
  if v_descuento_pct < 0 or v_descuento_pct > 100 then
    raise exception 'El descuento debe estar entre 0 y 100%%';
  end if;

  v_precio_final := round(v_paquete.precio * (1 - v_descuento_pct / 100.0), 2);

  update public.membresias set descuento_pct = v_descuento_pct, precio_final = v_precio_final where id = p_membresia_id;

  return json_build_object('ok', true, 'precio_final', v_precio_final, 'descuento_pct', v_descuento_pct);
end;
$$;
revoke all on function public.editar_cobro_membresia(uuid, numeric) from public;
grant execute on function public.editar_cobro_membresia(uuid, numeric) to authenticated;

create or replace function public.privatizar_fecha_horario(p_horario_id uuid, p_fecha date, p_cupo integer default 1)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid;
  v_sede_id uuid;
  v_categoria text;
  v_activo boolean;
  v_otras_reservas int;
  v_id uuid;
begin
  select tenant_id, sede_id, categoria, activo into v_tenant_id, v_sede_id, v_categoria, v_activo
    from public.horarios where id = p_horario_id;
  if v_tenant_id is null then raise exception 'Horario no válido'; end if;

  if not public.staff_puede_en_sede(v_tenant_id, v_sede_id, array['duena','gerente_general','admin_sede']) then
    raise exception 'No autorizado';
  end if;

  if p_fecha < public.hoy_en_sede(v_sede_id) then
    raise exception 'No se pueden privatizar fechas pasadas.';
  end if;
  if coalesce(p_cupo, 0) < 1 then
    raise exception 'El cupo debe ser al menos 1.';
  end if;
  if v_categoria <> 'regular' then
    raise exception 'Solo se pueden privatizar fechas de horarios regulares — las clases privadas ya tienen su propio calendario.';
  end if;
  if not v_activo then
    raise exception 'Ese horario está inactivo.';
  end if;
  if exists (select 1 from public.horario_cancelaciones where horario_id = p_horario_id and fecha = p_fecha) then
    raise exception 'Esa fecha está cancelada — quítale la cancelación primero si quieres privatizarla.';
  end if;
  if exists (select 1 from public.horario_fechas_privadas where horario_id = p_horario_id and fecha = p_fecha) then
    raise exception 'Esa fecha ya está privatizada.';
  end if;

  select count(*) into v_otras_reservas from public.reservas
    where horario_id = p_horario_id and fecha = p_fecha and estado = 'confirmada';
  if v_otras_reservas > 0 then
    raise exception 'Ya hay % clienta(s) con reserva confirmada en esa fecha — cancélalas primero o elige otra fecha.', v_otras_reservas;
  end if;

  insert into public.horario_fechas_privadas (tenant_id, horario_id, fecha, cupo)
    values (v_tenant_id, p_horario_id, p_fecha, p_cupo)
    returning id into v_id;

  return json_build_object('ok', true, 'privatizacion_id', v_id);
end;
$$;
revoke all on function public.privatizar_fecha_horario(uuid, date, integer) from public;
grant execute on function public.privatizar_fecha_horario(uuid, date, integer) to authenticated;

create or replace function public.confirmar_pago_privatizacion(p_horario_id uuid, p_fecha date, p_cliente_id uuid)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid;
  v_sede_id uuid;
  v_privatizacion_id uuid;
begin
  select tenant_id, sede_id into v_tenant_id, v_sede_id from public.horarios where id = p_horario_id;
  if v_tenant_id is null then raise exception 'Horario no válido'; end if;

  if not public.staff_puede_en_sede(v_tenant_id, v_sede_id, array['duena','gerente_general','admin_sede','recepcion']) then
    raise exception 'No autorizado';
  end if;

  select id into v_privatizacion_id from public.horario_fechas_privadas where horario_id = p_horario_id and fecha = p_fecha;
  if v_privatizacion_id is null then
    raise exception 'No se encontró esa privatización.';
  end if;

  update public.horario_fechas_privadas_personas
    set pagada = true, confirmado_at = now(), confirmado_por = auth.uid()
    where privatizacion_id = v_privatizacion_id and cliente_id = p_cliente_id;

  if not found then
    raise exception 'Esa clienta no está agregada a esta fecha privatizada.';
  end if;

  return json_build_object('ok', true);
end;
$$;
revoke all on function public.confirmar_pago_privatizacion(uuid, date, uuid) from public;
grant execute on function public.confirmar_pago_privatizacion(uuid, date, uuid) to authenticated;

-- Sin código de descuento ni bono de referido (resto). La ejecuta el backend/webhook de la pasarela
-- (service_role), no un usuario autenticado directamente — el tenant se deriva de la transacción misma.
create or replace function public.confirmar_pago_transaccion(p_transaccion_id uuid)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tx record;
  v_paquete record;
  v_membresia_id uuid;
begin
  select * into v_tx from public.pago_transacciones where id = p_transaccion_id;
  if v_tx is null then raise exception 'Transacción no encontrada'; end if;
  if v_tx.membresia_id is not null then
    return json_build_object('ok', true, 'membresia_id', v_tx.membresia_id, 'ya_procesada', true);
  end if;

  select * into v_paquete from public.paquetes where id = v_tx.paquete_id;
  if v_paquete is null then raise exception 'Paquete no encontrado'; end if;

  insert into public.membresias
    (tenant_id, cliente_id, paquete_id, sede_venta_id, cobertura_tipo, metodo_pago, precio_final, estado,
     clases_totales, clases_usadas, fecha_inicio, fecha_vencimiento, pagada, origen, confirmado_at)
    values
    (v_tx.tenant_id, v_tx.cliente_id, v_tx.paquete_id, v_tx.sede_venta_id, v_paquete.cobertura, 'pasarela', v_tx.monto, 'activa',
     v_paquete.num_clases, 0, public.hoy_en_sede(v_tx.sede_venta_id), public.hoy_en_sede(v_tx.sede_venta_id) + v_paquete.vigencia_dias,
     true, 'compra', now())
    returning id into v_membresia_id;

  perform public._snapshot_cobertura_membresia(v_membresia_id, v_tx.paquete_id);

  update public.pago_transacciones
    set estado = 'confirmado', membresia_id = v_membresia_id, actualizado_at = now()
    where id = p_transaccion_id;

  return json_build_object('ok', true, 'membresia_id', v_membresia_id);
end;
$$;
revoke all on function public.confirmar_pago_transaccion(uuid) from public;
grant execute on function public.confirmar_pago_transaccion(uuid) to service_role;
