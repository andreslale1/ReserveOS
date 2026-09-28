-- Hito C — RPCs de negocio: reportes/dashboards de staff, funciones de cron/notificación, y cierre de
-- las dos que quedaban pendientes de pagos (anular_cobro_membresia, eliminar_cobro_pendiente).
--
-- Diferidas a propósito (dependen de tablas del módulo "resto" — no núcleo, se conectan cuando se
-- porte ese módulo): agregar_cobro_personalizado (cobros_personalizados), codigos_activos_por_paquete
-- y _decrementar_uso_codigo_al_borrar_membresia (codigos_descuento*), horarios_por_comenzar y
-- horarios_por_terminar (avisos_operativos_enviados). historial_cobros_paquetes y
-- pagos_recurrente_historial se portan SIN la parte de códigos de descuento / tienda que tenían en Forma.

-- Rol en el tenant sin restricción de sede (para reportes/dashboards tenant-wide: dueña, gerente
-- general, contadora). Distinto de staff_puede_en_sede, que sí exige sede para roles locales.
create or replace function public.tengo_rol_en_tenant(p_tenant_id uuid, p_roles text[])
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.tenant_memberships
      where user_id = auth.uid() and tenant_id = p_tenant_id and role = any(p_roles)
  );
$$;
revoke all on function public.tengo_rol_en_tenant(uuid, text[]) from public;
grant execute on function public.tengo_rol_en_tenant(uuid, text[]) to authenticated;

create or replace function public.anular_cobro_membresia(p_membresia_id uuid, p_motivo text default null)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_membresia record;
  v_destino_id uuid;
  v_destino_totales int;
  v_destino_usadas int;
  v_movidas int := 0;
  v_otro_activo uuid;
  v_reservas_canceladas int := 0;
begin
  select * into v_membresia from public.membresias where id = p_membresia_id;
  if v_membresia is null then raise exception 'Cobro no encontrado'; end if;

  if not public.staff_puede_en_sede(v_membresia.tenant_id, v_membresia.sede_venta_id, array['duena','gerente_general']) then
    raise exception 'No autorizado para anular un cobro';
  end if;
  if v_membresia.estado = 'anulada' then
    raise exception 'Este cobro ya estaba anulado';
  end if;
  if not v_membresia.pagada then
    raise exception 'Esto todavía no es un cobro confirmado — usa "Eliminar" en pendientes en vez de anular';
  end if;

  update public.membresias set
    estado = 'anulada', anulada_at = now(), anulada_por = auth.uid(), anulada_motivo = p_motivo
  where id = p_membresia_id;

  if coalesce(v_membresia.clases_usadas, 0) > 0 then
    select id, clases_totales, clases_usadas into v_destino_id, v_destino_totales, v_destino_usadas from public.membresias
      where cliente_id = v_membresia.cliente_id and estado = 'activa' and id <> p_membresia_id
      order by created_at desc limit 1;

    if v_destino_id is not null then
      v_movidas := case when v_destino_totales is null then v_membresia.clases_usadas
                        else greatest(least(v_membresia.clases_usadas, v_destino_totales - v_destino_usadas), 0) end;
      update public.membresias set clases_usadas = clases_usadas + v_movidas where id = v_destino_id;
    end if;
  end if;

  select id into v_otro_activo from public.membresias
    where cliente_id = v_membresia.cliente_id and estado = 'activa' and id <> p_membresia_id limit 1;

  if v_otro_activo is null then
    with canceladas as (
      update public.reservas set estado = 'cancelada'
      where cliente_id = v_membresia.cliente_id and estado = 'confirmada' and tipo = 'regular'
        and fecha >= public.hoy_en_sede(v_membresia.sede_venta_id)
      returning id
    )
    select count(*) into v_reservas_canceladas from canceladas;
  end if;

  return json_build_object('ok', true, 'clases_usadas', coalesce(v_membresia.clases_usadas, 0),
    'clases_movidas', v_movidas, 'reservas_canceladas', v_reservas_canceladas);
end;
$$;
revoke all on function public.anular_cobro_membresia(uuid, text) from public;
grant execute on function public.anular_cobro_membresia(uuid, text) to authenticated;

create or replace function public.eliminar_cobro_pendiente(p_membresia_id uuid)
returns json
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
    raise exception 'No autorizado';
  end if;

  delete from public.membresias where id = p_membresia_id and pagada = false;
  return json_build_object('ok', true);
end;
$$;
revoke all on function public.eliminar_cobro_pendiente(uuid) from public;
grant execute on function public.eliminar_cobro_pendiente(uuid) to authenticated;

-- Cualquier usuario (autenticado o no) puede reportar un error de la UI — igual que en Forma.
-- tenant_id opcional: si no aplica (ej. error en el sitio público, fuera de cualquier tenant), null.
create or replace function public.registrar_error_cliente(
  p_mensaje text, p_stack text default null, p_url text default null,
  p_contexto jsonb default null, p_nivel text default 'error', p_tenant_id uuid default null
)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_firma text;
  v_existente_id uuid;
  v_estaba_resuelto boolean;
begin
  if coalesce(trim(p_mensaje), '') = '' then
    return json_build_object('ok', true, 'nuevo', false);
  end if;
  v_firma := md5(left(coalesce(p_mensaje, ''), 500) || '|' || left(coalesce(p_stack, ''), 300));

  select id, resuelto into v_existente_id, v_estaba_resuelto from public.error_logs
    where firma = v_firma and ultima_vez > now() - interval '7 days'
    order by ultima_vez desc limit 1;

  if v_existente_id is not null and not v_estaba_resuelto then
    update public.error_logs set veces = veces + 1, ultima_vez = now(), url = coalesce(p_url, url) where id = v_existente_id;
    return json_build_object('ok', true, 'nuevo', false);
  end if;
  if v_existente_id is not null and v_estaba_resuelto then
    update public.error_logs set veces = veces + 1, ultima_vez = now(), url = coalesce(p_url, url),
      resuelto = false, resuelto_por = null, resuelto_at = null where id = v_existente_id;
    return json_build_object('ok', true, 'nuevo', true);
  end if;

  insert into public.error_logs (tenant_id, firma, mensaje, stack, url, contexto, nivel)
    values (p_tenant_id, v_firma, left(p_mensaje, 2000), left(p_stack, 4000), left(p_url, 500), p_contexto, coalesce(p_nivel, 'error'));

  return json_build_object('ok', true, 'nuevo', true);
end;
$$;
revoke all on function public.registrar_error_cliente(text, text, text, jsonb, text, uuid) from public;
grant execute on function public.registrar_error_cliente(text, text, text, jsonb, text, uuid) to authenticated, anon;

create or replace function public.checkins_disponibles()
returns table(cliente_id uuid, nombre text, es_propia boolean, nombre_clase text, hora_inicio time)
language sql stable security definer
set search_path to 'public'
as $$
  select c.id, c.nombre, (c.user_id = auth.uid()), h.nombre_clase, h.hora_inicio
  from public.reservas r
  join public.horarios h on h.id = r.horario_id
  join public.clientes c on c.id = r.cliente_id
  where (c.user_id = auth.uid() or c.tutor_id in (select id from public.clientes where user_id = auth.uid() and tenant_id = c.tenant_id))
    and r.fecha = public.hoy_en_sede(r.sede_id)
    and r.estado = 'confirmada'
    and r.asistio is null
    and h.hora_inicio between ((public.ahora_en_sede(r.sede_id))::time - interval '15 minutes') and ((public.ahora_en_sede(r.sede_id))::time + interval '20 minutes')
  order by h.hora_inicio;
$$;
revoke all on function public.checkins_disponibles() from public;
grant execute on function public.checkins_disponibles() to authenticated;

create or replace function public.clientas_para_cobro(p_tenant_id uuid)
returns table(id uuid, nombre text, telefono text, email text, nombre_tutor text)
language sql stable security definer
set search_path to 'public'
as $$
  select c.id, c.nombre, c.telefono, c.email, t.nombre
  from public.clientes c
  left join public.clientes t on t.id = c.tutor_id
  where c.tenant_id = p_tenant_id and public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','admin_sede','recepcion'])
  order by c.nombre asc;
$$;
revoke all on function public.clientas_para_cobro(uuid) from public;
grant execute on function public.clientas_para_cobro(uuid) to authenticated;

create or replace function public.clientas_frecuentes_para_cobro(p_tenant_id uuid, p_limite integer default 8)
returns table(id uuid, nombre text, telefono text, email text, nombre_tutor text, veces integer)
language sql stable security definer
set search_path to 'public'
as $$
  select c.id, c.nombre, c.telefono, c.email, t.nombre, count(m.id)::int
  from public.membresias m
  join public.clientes c on c.id = m.cliente_id
  left join public.clientes t on t.id = c.tutor_id
  where m.tenant_id = p_tenant_id and m.pagada = true
    and public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','admin_sede','recepcion'])
  group by c.id, c.nombre, c.telefono, c.email, t.nombre
  order by count(m.id) desc, c.nombre asc
  limit p_limite;
$$;
revoke all on function public.clientas_frecuentes_para_cobro(uuid, integer) from public;
grant execute on function public.clientas_frecuentes_para_cobro(uuid, integer) to authenticated;

create or replace function public.cobros_de_hoy(p_tenant_id uuid)
returns table(tipo text, cliente_id uuid, nombre text, telefono text, concepto text, monto numeric,
  hora_clase time, membresia_id uuid, membresia_estado text, horario_id uuid, fecha_privada date,
  metodo_pago text, comprobante_url text, referencia_pago text)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','admin_sede','recepcion']) then
    return;
  end if;

  return query
  select 'paquete'::text, c.id, c.nombre, c.telefono, p.nombre, coalesce(m.precio_final, p.precio),
    (select min(h.hora_inicio) from public.reservas r join public.horarios h on h.id = r.horario_id
      where r.cliente_id = c.id and r.fecha = public.hoy_en_sede(m.sede_venta_id) and r.estado = 'confirmada'),
    m.id, m.estado, null::uuid, null::date, m.metodo_pago, m.comprobante_url, m.referencia_pago
  from public.membresias m
  join public.clientes c on c.id = m.cliente_id
  join public.paquetes p on p.id = m.paquete_id
  where m.tenant_id = p_tenant_id and m.pagada = false and m.estado in ('activa', 'pendiente_pago')

  union all

  select 'privada'::text, c.id, c.nombre, c.telefono, 'Sesión privada — ' || h.nombre_clase, hp.precio,
    case when hfp.fecha = public.hoy_en_sede(h.sede_id) then h.hora_inicio else null end,
    null::uuid, null::text, hfp.horario_id, hfp.fecha, hp.metodo_pago, null::text, hp.referencia_pago
  from public.horario_fechas_privadas_personas hp
  join public.clientes c on c.id = hp.cliente_id
  join public.horario_fechas_privadas hfp on hfp.id = hp.privatizacion_id
  join public.horarios h on h.id = hfp.horario_id
  where hp.tenant_id = p_tenant_id and hp.pagada = false

  order by 7 asc nulls last, 3 asc;
end;
$$;
revoke all on function public.cobros_de_hoy(uuid) from public;
grant execute on function public.cobros_de_hoy(uuid) to authenticated;

create or replace function public.cobros_pendientes_hace_tiempo(p_tenant_id uuid)
returns table(cliente_id uuid, nombre text, telefono text, paquete_nombre text, pedida_el timestamptz, horas_esperando numeric)
language sql stable security definer
set search_path to 'public'
as $$
  select c.id, c.nombre, c.telefono, p.nombre, m.created_at, round(extract(epoch from (now() - m.created_at)) / 3600.0, 1)
  from public.membresias m
  join public.clientes c on c.id = m.cliente_id
  join public.paquetes p on p.id = m.paquete_id
  where m.tenant_id = p_tenant_id and m.pagada = false and m.estado = 'activa'
    and public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','admin_sede','recepcion'])
  order by m.created_at asc;
$$;
revoke all on function public.cobros_pendientes_hace_tiempo(uuid) from public;
grant execute on function public.cobros_pendientes_hace_tiempo(uuid) to authenticated;

create or replace function public.export_resumen_clientes(p_tenant_id uuid)
returns table(cliente_id uuid, nombre text, telefono text, email text, genero text, como_se_entero text,
  fecha_registro timestamptz, dias_como_clienta integer, paquete_actual text, estado_membresia text,
  vencimiento date, total_pagado numeric, total_reservas bigint, clases_asistidas bigint, pct_asistencia numeric)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then
    return;
  end if;

  return query
  with pagos as (
    select m.cliente_id as cid, sum(coalesce(m.precio_final, 0)) as monto
    from public.membresias m where m.tenant_id = p_tenant_id and m.pagada = true group by m.cliente_id
  ),
  actividad as (
    select r.cliente_id as cid,
      count(*) filter (where r.estado = 'confirmada') as reservas_total,
      count(*) filter (where r.estado = 'confirmada' and r.fecha < public.hoy_en_sede(r.sede_id)) as reservas_pasadas,
      count(*) filter (where r.estado = 'confirmada' and r.fecha < public.hoy_en_sede(r.sede_id) and r.asistio is true) as reservas_asistidas
    from public.reservas r where r.tenant_id = p_tenant_id group by r.cliente_id
  ),
  membresia_actual as (
    select distinct on (m.cliente_id) m.cliente_id as cid, p.nombre as paquete_nombre, m.estado as membresia_estado, m.fecha_vencimiento as membresia_vencimiento
    from public.membresias m join public.paquetes p on p.id = m.paquete_id
    where m.tenant_id = p_tenant_id order by m.cliente_id, m.created_at desc
  )
  select c.id, c.nombre, c.telefono, c.email, c.genero, c.como_se_entero, c.created_at,
    (public.hoy_en_sede(c.sede_habitual_id) - c.created_at::date)::int,
    ma.paquete_nombre, ma.membresia_estado, ma.membresia_vencimiento,
    coalesce(pg.monto, 0), coalesce(ac.reservas_total, 0), coalesce(ac.reservas_asistidas, 0),
    case when coalesce(ac.reservas_pasadas, 0) = 0 then null else round(100.0 * ac.reservas_asistidas / ac.reservas_pasadas, 1) end
  from public.clientes c
  left join membresia_actual ma on ma.cid = c.id
  left join pagos pg on pg.cid = c.id
  left join actividad ac on ac.cid = c.id
  where c.tenant_id = p_tenant_id
  order by c.created_at desc;
end;
$$;
revoke all on function public.export_resumen_clientes(uuid) from public;
grant execute on function public.export_resumen_clientes(uuid) to authenticated;

-- Sin el join a códigos de descuento (módulo resto).
create or replace function public.historial_cobros_paquetes(p_tenant_id uuid, p_limite integer default 100)
returns table(membresia_id uuid, paquete_id uuid, cliente_nombre text, paquete_nombre text, monto numeric,
  metodo_pago text, estado text, pagada boolean, comprobante_url text, fecha timestamptz, origen text, clases_totales integer)
language sql stable security definer
set search_path to 'public'
as $$
  select m.id, m.paquete_id, c.nombre, p.nombre, coalesce(m.precio_final, p.precio), m.metodo_pago,
    m.estado, m.pagada, m.comprobante_url, coalesce(m.confirmado_at, m.created_at), m.origen, m.clases_totales
  from public.membresias m
  join public.clientes c on c.id = m.cliente_id
  join public.paquetes p on p.id = m.paquete_id
  where m.tenant_id = p_tenant_id and m.pagada = true
    and public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','contadora'])
  order by coalesce(m.confirmado_at, m.created_at) desc
  limit p_limite;
$$;
revoke all on function public.historial_cobros_paquetes(uuid, integer) from public;
grant execute on function public.historial_cobros_paquetes(uuid, integer) to authenticated;

create or replace function public.membresias_por_vencer(p_tenant_id uuid, p_dias integer default 7)
returns table(cliente_id uuid, nombre text, email text, telefono text, fecha_vencimiento date, paquete_nombre text)
language sql stable security definer
set search_path to 'public'
as $$
  select c.id, c.nombre, c.email, c.telefono, m.fecha_vencimiento, p.nombre
  from public.membresias m
  join public.clientes c on c.id = m.cliente_id
  join public.paquetes p on p.id = m.paquete_id
  where m.tenant_id = p_tenant_id and m.estado = 'activa'
    and m.fecha_vencimiento between public.hoy_en_sede(m.sede_venta_id) and public.hoy_en_sede(m.sede_venta_id) + p_dias
    and public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','admin_sede','recepcion'])
  order by m.fecha_vencimiento asc;
$$;
revoke all on function public.membresias_por_vencer(uuid, integer) from public;
grant execute on function public.membresias_por_vencer(uuid, integer) to authenticated;

create or replace function public.pagos_pasarela_pendientes(p_tenant_id uuid)
returns table(id uuid, cliente_nombre text, cliente_telefono text, paquete_nombre text, monto numeric,
  proveedor text, proveedor_transaccion_id text, created_at timestamptz)
language sql stable security definer
set search_path to 'public'
as $$
  select pt.id, c.nombre, c.telefono, p.nombre, pt.monto, pt.proveedor, pt.proveedor_transaccion_id, pt.created_at
  from public.pago_transacciones pt
  join public.clientes c on c.id = pt.cliente_id
  join public.paquetes p on p.id = pt.paquete_id
  where pt.tenant_id = p_tenant_id and pt.estado = 'iniciado'
    and public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general'])
  order by pt.created_at desc;
$$;
revoke all on function public.pagos_pasarela_pendientes(uuid) from public;
grant execute on function public.pagos_pasarela_pendientes(uuid) to authenticated;

-- Sin la rama de pedidos de tienda (módulo resto) — solo tipo 'paquete'.
create or replace function public.pagos_recurrente_historial(p_tenant_id uuid, p_desde date default null, p_hasta date default null)
returns table(transaccion_id uuid, fecha timestamptz, cliente_nombre text, tipo text, descripcion text,
  monto numeric, comision_estimada numeric, neto_estimado numeric)
language sql stable security definer
set search_path to 'public'
as $$
  select tx.id, tx.actualizado_at, c.nombre, tx.tipo, pq.nombre, tx.monto,
    round(tx.monto * 0.045 + 2, 2), round(tx.monto - (tx.monto * 0.045 + 2), 2)
  from public.pago_transacciones tx
  join public.clientes c on c.id = tx.cliente_id
  left join public.paquetes pq on pq.id = tx.paquete_id
  where tx.tenant_id = p_tenant_id and tx.proveedor = 'recurrente' and tx.estado = 'confirmado'
    and (p_desde is null or tx.actualizado_at::date >= p_desde)
    and (p_hasta is null or tx.actualizado_at::date <= p_hasta)
    and public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','contadora'])
  order by tx.actualizado_at desc;
$$;
revoke all on function public.pagos_recurrente_historial(uuid, date, date) from public;
grant execute on function public.pagos_recurrente_historial(uuid, date, date) to authenticated;

create or replace function public.mis_proximas_reservas_instructora(p_tenant_id uuid)
returns table(id uuid, fecha date, horario_id uuid, cliente_nombre text, cuidados_especiales text)
language sql stable security definer
set search_path to 'public'
as $$
  select r.id, r.fecha, r.horario_id, c.nombre, c.cuidados_especiales
  from public.reservas r
  join public.horarios h on h.id = r.horario_id
  join public.clientes c on c.id = r.cliente_id
  where r.tenant_id = p_tenant_id
    and h.instructor_membership_id in (select id from public.tenant_memberships where user_id = auth.uid() and tenant_id = p_tenant_id and role = 'instructora')
    and r.estado = 'confirmada'
    and r.fecha >= public.hoy_en_sede(r.sede_id)
  order by r.fecha asc;
$$;
revoke all on function public.mis_proximas_reservas_instructora(uuid) from public;
grant execute on function public.mis_proximas_reservas_instructora(uuid) to authenticated;

create or replace function public.kpi_reservas_mensual(p_tenant_id uuid, p_meses integer default 12)
returns table(mes date, reservas_real bigint)
language sql stable security definer
set search_path to 'public'
as $$
  select date_trunc('month', r.fecha)::date, count(*)
  from public.reservas r
  where r.tenant_id = p_tenant_id and r.estado = 'confirmada'
    and public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general'])
  group by 1 order by 1 desc limit p_meses;
$$;
revoke all on function public.kpi_reservas_mensual(uuid, integer) from public;
grant execute on function public.kpi_reservas_mensual(uuid, integer) to authenticated;

create or replace function public.kpi_reservas_lealtad(p_tenant_id uuid)
returns json
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_clientes_unicos int; v_total_reservas int; v_clientes_repiten int;
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then
    return null;
  end if;

  select count(distinct cliente_id), count(*) into v_clientes_unicos, v_total_reservas
    from public.reservas where tenant_id = p_tenant_id and estado = 'confirmada';

  select count(*) into v_clientes_repiten from (
    select cliente_id from public.reservas where tenant_id = p_tenant_id and estado = 'confirmada'
    group by cliente_id having count(*) >= 2
  ) t;

  return json_build_object(
    'clientes_unicos', v_clientes_unicos, 'total_reservas', v_total_reservas,
    'reservas_por_cliente', case when v_clientes_unicos > 0 then round(v_total_reservas::numeric / v_clientes_unicos, 2) else null end,
    'clientes_repiten', v_clientes_repiten,
    'pct_rebooking', case when v_clientes_unicos > 0 then round(100.0 * v_clientes_repiten / v_clientes_unicos, 1) else null end
  );
end;
$$;
revoke all on function public.kpi_reservas_lealtad(uuid) from public;
grant execute on function public.kpi_reservas_lealtad(uuid) to authenticated;

create or replace function public.kpi_afluencia_horarios(p_tenant_id uuid)
returns table(horario_id uuid, nombre_clase text, dia_semana integer, hora_inicio time, cupo_maximo integer,
  total_reservas bigint, sesiones bigint, ocupacion_pct numeric)
language sql stable security definer
set search_path to 'public'
as $$
  select h.id, h.nombre_clase, h.dia_semana, h.hora_inicio, h.cupo_maximo,
    count(r.id), count(distinct r.fecha),
    case when count(distinct r.fecha) = 0 then 0 else round(100.0 * count(r.id) / (count(distinct r.fecha) * h.cupo_maximo), 1) end
  from public.horarios h
  left join public.reservas r on r.horario_id = h.id and r.estado = 'confirmada'
  where h.tenant_id = p_tenant_id and h.activo = true and h.categoria = 'regular' and h.fecha_especifica is null
    and public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general'])
  group by h.id, h.nombre_clase, h.dia_semana, h.hora_inicio, h.cupo_maximo
  order by 8 desc;
$$;
revoke all on function public.kpi_afluencia_horarios(uuid) from public;
grant execute on function public.kpi_afluencia_horarios(uuid) to authenticated;

create or replace function public.kpi_clientas_paquete_activo_mensual(p_tenant_id uuid, p_meses integer default 12)
returns table(mes date, clientas_real bigint)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then
    return;
  end if;
  return query
  select gs.mes_ts::date, count(distinct mb.cliente_id)
  from generate_series(
    date_trunc('month', now()) - ((p_meses - 1) || ' months')::interval,
    date_trunc('month', now()), interval '1 month'
  ) as gs(mes_ts)
  left join public.membresias mb on mb.tenant_id = p_tenant_id and mb.pagada = true
    and mb.estado not in ('rechazada','anulada')
    and mb.fecha_inicio <= (gs.mes_ts + interval '1 month' - interval '1 day')::date
    and mb.fecha_vencimiento >= gs.mes_ts::date
  group by gs.mes_ts order by gs.mes_ts desc;
end;
$$;
revoke all on function public.kpi_clientas_paquete_activo_mensual(uuid, integer) from public;
grant execute on function public.kpi_clientas_paquete_activo_mensual(uuid, integer) to authenticated;

create or replace function public.kpi_tiempo_confirmacion_cobro(p_tenant_id uuid)
returns json
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_avg numeric; v_max numeric; v_evaluadas int;
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then
    return null;
  end if;

  select avg(extract(epoch from (confirmado_at - created_at)) / 3600.0),
         max(extract(epoch from (confirmado_at - created_at)) / 3600.0),
         count(*)
    into v_avg, v_max, v_evaluadas
  from public.membresias
  where tenant_id = p_tenant_id and pagada = true and confirmado_at is not null and origen = 'compra';

  return json_build_object('horas_promedio', round(coalesce(v_avg, 0), 1), 'horas_maximo', round(coalesce(v_max, 0), 1), 'cobros_evaluados', v_evaluadas);
end;
$$;
revoke all on function public.kpi_tiempo_confirmacion_cobro(uuid) from public;
grant execute on function public.kpi_tiempo_confirmacion_cobro(uuid) to authenticated;

-- === Funciones de cron/notificación: las ejecuta el backend con service_role, recorren TODOS los
-- tenants (por eso devuelven tenant_id, para que el job sepa a quién enviarle qué). Nunca se otorgan
-- a `authenticated` — un usuario normal no debe poder listar recordatorios de otros clientes. ===

create or replace function public.membresias_para_recordatorio_vencimiento(p_dias integer default 3)
returns table(tenant_id uuid, membresia_id uuid, cliente_id uuid, user_id uuid, nombre text, email text, fecha_vencimiento date, paquete_nombre text)
language sql security definer
set search_path to 'public'
as $$
  select m.tenant_id, m.id, c.id, c.user_id, c.nombre, c.email, m.fecha_vencimiento, p.nombre
  from public.membresias m
  join public.clientes c on c.id = m.cliente_id
  join public.paquetes p on p.id = m.paquete_id
  where m.estado = 'activa' and m.congelada_desde is null and m.recordatorio_vencimiento_enviado = false
    and m.fecha_vencimiento between public.hoy_en_sede(m.sede_venta_id) and public.hoy_en_sede(m.sede_venta_id) + p_dias
    and (m.clases_totales is null or m.clases_usadas < m.clases_totales);
$$;
revoke all on function public.membresias_para_recordatorio_vencimiento(integer) from public;
grant execute on function public.membresias_para_recordatorio_vencimiento(integer) to service_role;

create or replace function public.membresias_para_recordatorio_inactividad(p_dias integer default 14)
returns table(tenant_id uuid, membresia_id uuid, cliente_id uuid, user_id uuid, nombre text, email text, clases_restantes integer)
language sql security definer
set search_path to 'public'
as $$
  select m.tenant_id, m.id, c.id, c.user_id, c.nombre, c.email,
    case when m.clases_totales is null then null else m.clases_totales - m.clases_usadas end
  from public.membresias m
  join public.clientes c on c.id = m.cliente_id
  where m.estado = 'activa' and m.congelada_desde is null
    and m.fecha_vencimiento >= public.hoy_en_sede(m.sede_venta_id)
    and (m.clases_totales is null or m.clases_usadas < m.clases_totales)
    and m.recordatorio_inactividad_enviado_at is null
    and m.created_at <= now() - (p_dias || ' days')::interval
    and not exists (
      select 1 from public.reservas r
      where r.cliente_id = c.id and r.estado = 'confirmada' and r.fecha >= public.hoy_en_sede(m.sede_venta_id) - p_dias
    );
$$;
revoke all on function public.membresias_para_recordatorio_inactividad(integer) from public;
grant execute on function public.membresias_para_recordatorio_inactividad(integer) to service_role;

create or replace function public.reservas_asistencia_por_notificar()
returns table(tenant_id uuid, reserva_id uuid, user_id uuid, nombre_clase text, fecha date)
language sql security definer
set search_path to 'public'
as $$
  select r.tenant_id, r.id, c.user_id, h.nombre_clase, r.fecha
  from public.reservas r
  join public.horarios h on h.id = r.horario_id
  join public.clientes c on c.id = r.cliente_id
  where r.asistio = true and r.asistencia_notificada = false and c.user_id is not null;
$$;
revoke all on function public.reservas_asistencia_por_notificar() from public;
grant execute on function public.reservas_asistencia_por_notificar() to service_role;

create or replace function public.reservas_liberadas_no_confirmar(p_dias integer default 30)
returns table(tenant_id uuid, reserva_id uuid, nombre text, telefono text, email text, nombre_clase text, fecha date, hora_inicio time)
language sql security definer
set search_path to 'public'
as $$
  select r.tenant_id, r.id, c.nombre, c.telefono, c.email, h.nombre_clase, r.fecha, h.hora_inicio
  from public.reservas r
  join public.clientes c on c.id = r.cliente_id
  join public.horarios h on h.id = r.horario_id
  where r.liberada_por_no_confirmar = true and r.fecha >= public.hoy_en_sede(r.sede_id) - p_dias
  order by r.fecha desc, h.hora_inicio desc;
$$;
revoke all on function public.reservas_liberadas_no_confirmar(integer) from public;
grant execute on function public.reservas_liberadas_no_confirmar(integer) to service_role;

create or replace function public.reservas_para_recordar_confirmacion()
returns table(tenant_id uuid, reserva_id uuid, nombre text, email text, user_id uuid, nombre_clase text, hora_inicio time, fecha date)
language plpgsql security definer
set search_path to 'public'
as $$
begin
  return query
  select r.tenant_id, r.id, c.nombre, c.email, c.user_id, h.nombre_clase, h.hora_inicio, r.fecha
  from public.reservas r
  join public.horarios h on h.id = r.horario_id
  join public.clientes c on c.id = r.cliente_id
  join public.configuracion_reservas cr on cr.tenant_id = r.tenant_id
  where r.estado = 'confirmada' and r.tipo = 'regular'
    and r.confirmada_por_clienta_at is null and r.confirmacion_recordatorio_enviado = false
    and (r.fecha + h.hora_inicio) > public.ahora_en_sede(r.sede_id)
    and (r.fecha + h.hora_inicio) <= public.ahora_en_sede(r.sede_id) + (coalesce(cr.horas_minimas_confirmacion, 1) || ' hours')::interval
    and (select count(*) from public.reservas r2 where r2.horario_id = r.horario_id and r2.fecha = r.fecha and r2.estado = 'confirmada') >= h.cupo_maximo;
end;
$$;
revoke all on function public.reservas_para_recordar_confirmacion() from public;
grant execute on function public.reservas_para_recordar_confirmacion() to service_role;

create or replace function public.reservas_para_recordatorio_agendada()
returns table(tenant_id uuid, reserva_id uuid, cliente_id uuid, user_id uuid, tutor_id uuid, tutor_user_id uuid,
  nombre text, email text, tutor_email text, nombre_clase text, fecha date, hora_inicio time)
language sql security definer
set search_path to 'public'
as $$
  select r.tenant_id, r.id, c.id, c.user_id, tutor.id, tutor.user_id, c.nombre, c.email, tutor.email, h.nombre_clase, r.fecha, h.hora_inicio
  from public.reservas r
  join public.horarios h on h.id = r.horario_id
  join public.clientes c on c.id = r.cliente_id
  left join public.clientes tutor on tutor.id = c.tutor_id
  where r.estado = 'confirmada' and r.recordatorio_agendada_enviado_at is null
    and (r.fecha + h.hora_inicio) > public.ahora_en_sede(r.sede_id)
    and public.ahora_en_sede(r.sede_id) >= (
      case when (r.fecha + h.hora_inicio) - r.created_at > interval '24 hours'
        then r.created_at + interval '24 hours'
        else (r.fecha + h.hora_inicio) - interval '3 hours'
      end
    );
$$;
revoke all on function public.reservas_para_recordatorio_agendada() from public;
grant execute on function public.reservas_para_recordatorio_agendada() to service_role;
