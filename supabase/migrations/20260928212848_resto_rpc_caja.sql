-- Módulo resto — caja/POS diario, tenant + sede scoped (cierre_caja ya tiene PK (tenant_id, sede_id, fecha)).

create or replace function public.caja_esperado_del_dia__interno(p_tenant_id uuid, p_sede_id uuid, p_fecha date)
returns table(metodo_pago text, monto numeric)
language sql stable security definer
set search_path to 'public'
as $$
  with membresias_dia as (
    select m.metodo_pago, coalesce(m.precio_final, pq.precio, 0) as monto
    from public.membresias m join public.paquetes pq on pq.id = m.paquete_id
    where m.tenant_id = p_tenant_id and m.sede_venta_id = p_sede_id and m.estado = 'activa' and m.pagada = true
      and m.confirmado_at is not null and m.metodo_pago <> 'pasarela'
      and public.hoy_en_sede(p_sede_id) = p_fecha and m.confirmado_at::date = p_fecha
  ),
  privatizaciones_dia as (
    select metodo_pago, precio as monto from public.horario_fechas_privadas_personas
    where tenant_id = p_tenant_id and pagada = true and confirmado_at is not null and metodo_pago <> 'pasarela'
      and confirmado_at::date = p_fecha
  ),
  pedidos_dia as (
    select metodo_pago, total as monto from public.pedidos
    where tenant_id = p_tenant_id and sede_entrega_id = p_sede_id and estado in ('pagado', 'entregado') and pagado_at is not null
      and metodo_pago <> 'pasarela' and pagado_at::date = p_fecha
  ),
  cobros_personalizados_dia as (
    select metodo_pago, monto from public.cobros_personalizados
    where tenant_id = p_tenant_id and sede_id = p_sede_id and confirmado_at is not null and metodo_pago <> 'pasarela'
      and confirmado_at::date = p_fecha
  ),
  todo as (
    select * from membresias_dia union all select * from privatizaciones_dia
    union all select * from pedidos_dia union all select * from cobros_personalizados_dia
  )
  select metodo_pago, sum(monto) as monto from todo group by metodo_pago;
$$;
revoke all on function public.caja_esperado_del_dia__interno(uuid, uuid, date) from public;

create or replace function public.caja_esperado_del_dia(p_tenant_id uuid, p_sede_id uuid, p_fecha date)
returns table(metodo_pago text, monto numeric)
language plpgsql security definer
set search_path to 'public'
as $$
begin
  if not public.staff_puede_en_sede(p_tenant_id, p_sede_id, array['duena','gerente_general','admin_sede','recepcion']) then
    raise exception 'No autorizado';
  end if;
  return query select * from public.caja_esperado_del_dia__interno(p_tenant_id, p_sede_id, p_fecha);
end;
$$;
revoke all on function public.caja_esperado_del_dia(uuid, uuid, date) from public;
grant execute on function public.caja_esperado_del_dia(uuid, uuid, date) to authenticated;

create or replace function public.cerrar_caja(p_tenant_id uuid, p_sede_id uuid, p_fecha date, p_efectivo_contado numeric, p_tarjeta_contado numeric, p_transferencia_contado numeric, p_notas text default null)
returns public.cierre_caja
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_efectivo numeric := 0; v_tarjeta numeric := 0; v_transferencia numeric := 0; v_row public.cierre_caja;
begin
  if not public.staff_puede_en_sede(p_tenant_id, p_sede_id, array['duena','gerente_general','admin_sede']) then
    raise exception 'No autorizado para cerrar caja';
  end if;

  select coalesce(sum(monto), 0) into v_efectivo from public.caja_esperado_del_dia__interno(p_tenant_id, p_sede_id, p_fecha) where metodo_pago = 'efectivo';
  select coalesce(sum(monto), 0) into v_tarjeta from public.caja_esperado_del_dia__interno(p_tenant_id, p_sede_id, p_fecha) where metodo_pago = 'tarjeta_estudio';
  select coalesce(sum(monto), 0) into v_transferencia from public.caja_esperado_del_dia__interno(p_tenant_id, p_sede_id, p_fecha) where metodo_pago = 'transferencia';

  insert into public.cierre_caja (tenant_id, sede_id, fecha, efectivo_sistema, efectivo_contado, tarjeta_sistema, tarjeta_contado,
    transferencia_sistema, transferencia_contado, notas, cerrado_por, cerrado_at)
  values (p_tenant_id, p_sede_id, p_fecha, v_efectivo, p_efectivo_contado, v_tarjeta, p_tarjeta_contado, v_transferencia, p_transferencia_contado, p_notas, auth.uid(), now())
  on conflict (tenant_id, sede_id, fecha) do update set
    efectivo_sistema = excluded.efectivo_sistema, efectivo_contado = excluded.efectivo_contado,
    tarjeta_sistema = excluded.tarjeta_sistema, tarjeta_contado = excluded.tarjeta_contado,
    transferencia_sistema = excluded.transferencia_sistema, transferencia_contado = excluded.transferencia_contado,
    notas = excluded.notas, cerrado_por = excluded.cerrado_por, cerrado_at = now()
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.cerrar_caja(uuid, uuid, date, numeric, numeric, numeric, text) from public;
grant execute on function public.cerrar_caja(uuid, uuid, date, numeric, numeric, numeric, text) to authenticated;

create or replace function public.historial_cierres_caja(p_tenant_id uuid, p_sede_id uuid, p_limite integer default 60)
returns table(fecha date, efectivo_sistema numeric, efectivo_contado numeric, tarjeta_sistema numeric, tarjeta_contado numeric,
  transferencia_sistema numeric, transferencia_contado numeric, notas text, cerrado_por_nombre text, cerrado_at timestamptz)
language sql stable security definer
set search_path to 'public'
as $$
  select cc.fecha, cc.efectivo_sistema, cc.efectivo_contado, cc.tarjeta_sistema, cc.tarjeta_contado,
    cc.transferencia_sistema, cc.transferencia_contado, cc.notas, tm.nombre, cc.cerrado_at
  from public.cierre_caja cc
  left join public.tenant_memberships tm on tm.user_id = cc.cerrado_por and tm.tenant_id = cc.tenant_id
  where cc.tenant_id = p_tenant_id and cc.sede_id = p_sede_id
    and public.staff_puede_en_sede(p_tenant_id, p_sede_id, array['duena','gerente_general','admin_sede'])
  order by cc.fecha desc limit p_limite;
$$;
revoke all on function public.historial_cierres_caja(uuid, uuid, integer) from public;
grant execute on function public.historial_cierres_caja(uuid, uuid, integer) to authenticated;

create or replace function public.detalle_caja_del_dia(p_tenant_id uuid, p_sede_id uuid, p_fecha date)
returns table(origen text, cliente_nombre text, concepto text, monto numeric, metodo_pago text, hora time)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.staff_puede_en_sede(p_tenant_id, p_sede_id, array['duena','gerente_general','admin_sede','recepcion']) then
    raise exception 'No autorizado';
  end if;
  return query
  select 'Cobro personalizado', c.nombre, cp.concepto, cp.monto, cp.metodo_pago, cp.confirmado_at::time
    from public.cobros_personalizados cp join public.clientes c on c.id = cp.cliente_id
    where cp.tenant_id = p_tenant_id and cp.sede_id = p_sede_id and cp.metodo_pago <> 'pasarela' and cp.confirmado_at::date = p_fecha
  union all
  select 'Tienda', coalesce(c.nombre, 'Venta al público'), pd.total::text, pd.total, pd.metodo_pago, pd.pagado_at::time
    from public.pedidos pd left join public.clientes c on c.id = pd.cliente_id
    where pd.tenant_id = p_tenant_id and pd.sede_entrega_id = p_sede_id and pd.estado in ('pagado', 'entregado')
      and pd.metodo_pago <> 'pasarela' and pd.pagado_at::date = p_fecha
  union all
  select 'Paquete', c.nombre, pq.nombre, coalesce(m.precio_final, pq.precio), m.metodo_pago, m.confirmado_at::time
    from public.membresias m join public.clientes c on c.id = m.cliente_id join public.paquetes pq on pq.id = m.paquete_id
    where m.tenant_id = p_tenant_id and m.sede_venta_id = p_sede_id and m.estado = 'activa' and m.pagada = true
      and m.confirmado_at is not null and m.metodo_pago <> 'pasarela' and m.confirmado_at::date = p_fecha
  union all
  select 'Fecha privatizada', c.nombre, 'Privatización', hfp.precio, hfp.metodo_pago, hfp.confirmado_at::time
    from public.horario_fechas_privadas_personas hfp join public.clientes c on c.id = hfp.cliente_id
    where hfp.tenant_id = p_tenant_id and hfp.pagada = true and hfp.confirmado_at is not null and hfp.metodo_pago <> 'pasarela'
      and hfp.confirmado_at::date = p_fecha
  order by 1, 6;
end;
$$;
revoke all on function public.detalle_caja_del_dia(uuid, uuid, date) from public;
grant execute on function public.detalle_caja_del_dia(uuid, uuid, date) to authenticated;

create or replace function public.total_cobrado_hoy(p_tenant_id uuid, p_sede_id uuid)
returns numeric
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_total numeric := 0;
begin
  if not public.staff_puede_en_sede(p_tenant_id, p_sede_id, array['duena','gerente_general','admin_sede','recepcion']) then
    return 0;
  end if;
  select coalesce(sum(monto), 0) into v_total from public.caja_esperado_del_dia__interno(p_tenant_id, p_sede_id, public.hoy_en_sede(p_sede_id));
  return v_total;
end;
$$;
revoke all on function public.total_cobrado_hoy(uuid, uuid) from public;
grant execute on function public.total_cobrado_hoy(uuid, uuid) to authenticated;
