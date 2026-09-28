-- Módulo resto — KPIs financieros. Todos tenant-scoped, rol dueña/gerente_general/contadora
-- (matriz P33/P36/P37 del maestro: contadora tiene acceso financiero, sin ver CRM).

create or replace function public.kpi_balance_general(p_tenant_id uuid)
returns json
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_total_activos numeric := 0; v_total_pasivos numeric := 0; v_ingresos_totales numeric := 0; v_utilidad_acumulada numeric := 0;
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','contadora']) then return null; end if;

  select coalesce(sum(monto), 0) into v_total_activos from public.activos where tenant_id = p_tenant_id;
  select coalesce(sum(monto), 0) into v_total_pasivos from public.pasivos where tenant_id = p_tenant_id;

  select coalesce(sum(coalesce(m.precio_final, pq.precio, 0)), 0) into v_ingresos_totales
    from public.membresias m left join public.paquetes pq on pq.id = m.paquete_id
    where m.tenant_id = p_tenant_id and m.pagada = true;

  v_ingresos_totales := v_ingresos_totales + coalesce((
    select sum(pi.cantidad * pi.precio_unitario) from public.pedido_items pi join public.pedidos pd on pd.id = pi.pedido_id
    where pd.tenant_id = p_tenant_id and pi.tipo = 'producto' and pd.estado in ('pagado', 'entregado')
  ), 0);

  v_utilidad_acumulada := v_ingresos_totales - coalesce((select sum(monto) from public.gastos where tenant_id = p_tenant_id and tipo in ('fijo','variable')), 0);

  return json_build_object('total_activos', round(v_total_activos, 2), 'total_pasivos', round(v_total_pasivos, 2),
    'utilidad_acumulada', round(v_utilidad_acumulada, 2), 'patrimonio_estimado', round(v_total_activos - v_total_pasivos + v_utilidad_acumulada, 2));
end;
$$;
revoke all on function public.kpi_balance_general(uuid) from public;
grant execute on function public.kpi_balance_general(uuid) to authenticated;

create or replace function public.kpi_cuentas_por_cobrar(p_tenant_id uuid)
returns json
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_resultado json;
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','contadora']) then return null; end if;
  with pendientes as (
    select c.nombre, coalesce(m.precio_final, pq.precio, 0) as monto, m.created_at, public.hoy_en_sede(null) - m.created_at::date as dias
    from public.membresias m join public.clientes c on c.id = m.cliente_id left join public.paquetes pq on pq.id = m.paquete_id
    where m.tenant_id = p_tenant_id and m.pagada = false
    union all
    select c.nombre, pd.total, pd.created_at, public.hoy_en_sede(null) - pd.created_at::date
    from public.pedidos pd join public.clientes c on c.id = pd.cliente_id
    where pd.tenant_id = p_tenant_id and pd.estado = 'pendiente_pago' and pd.metodo_pago = 'efectivo'
  )
  select json_build_object(
    'total', round(coalesce(sum(monto), 0), 2),
    'bucket_0_30', round(coalesce(sum(monto) filter (where dias <= 30), 0), 2),
    'bucket_31_60', round(coalesce(sum(monto) filter (where dias between 31 and 60), 0), 2),
    'bucket_61_90', round(coalesce(sum(monto) filter (where dias between 61 and 90), 0), 2),
    'bucket_90_mas', round(coalesce(sum(monto) filter (where dias > 90), 0), 2),
    'detalle', coalesce(json_agg(json_build_object('nombre', nombre, 'monto', monto, 'dias', dias) order by dias desc), '[]'::json)
  ) into v_resultado from pendientes;
  return v_resultado;
end;
$$;
revoke all on function public.kpi_cuentas_por_cobrar(uuid) from public;
grant execute on function public.kpi_cuentas_por_cobrar(uuid) to authenticated;

create or replace function public.kpi_cuentas_por_pagar(p_tenant_id uuid)
returns json
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_resultado json;
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','contadora']) then return null; end if;
  with deudas as (
    select descripcion, monto, fecha, public.hoy_en_sede(null) - fecha as dias from public.pasivos where tenant_id = p_tenant_id
  )
  select json_build_object(
    'total', round(coalesce(sum(monto), 0), 2),
    'bucket_0_30', round(coalesce(sum(monto) filter (where dias <= 30), 0), 2),
    'bucket_31_60', round(coalesce(sum(monto) filter (where dias between 31 and 60), 0), 2),
    'bucket_61_90', round(coalesce(sum(monto) filter (where dias between 61 and 90), 0), 2),
    'bucket_90_mas', round(coalesce(sum(monto) filter (where dias > 90), 0), 2),
    'detalle', coalesce(json_agg(json_build_object('descripcion', descripcion, 'monto', monto, 'dias', dias) order by dias desc), '[]'::json)
  ) into v_resultado from deudas;
  return v_resultado;
end;
$$;
revoke all on function public.kpi_cuentas_por_pagar(uuid) from public;
grant execute on function public.kpi_cuentas_por_pagar(uuid) to authenticated;

create or replace function public.kpi_finanzas_inversion(p_tenant_id uuid)
returns json
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_capital_invertido numeric := 0; v_primera_fecha date; v_utilidad_acumulada numeric := 0; v_flujos json;
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','contadora']) then return null; end if;

  select coalesce(sum(monto), 0), min(fecha) into v_capital_invertido, v_primera_fecha from public.activos where tenant_id = p_tenant_id;

  with ing_membresias as (
    select date_trunc('month', m.confirmado_at)::date as mes, sum(coalesce(m.precio_final, pq.precio, 0)) as total
    from public.membresias m left join public.paquetes pq on pq.id = m.paquete_id where m.tenant_id = p_tenant_id and m.pagada = true group by 1
  ),
  ing_productos as (
    select date_trunc('month', pd.pagado_at)::date as mes, sum(pi.cantidad * pi.precio_unitario) as total
    from public.pedido_items pi join public.pedidos pd on pd.id = pi.pedido_id
    where pd.tenant_id = p_tenant_id and pi.tipo = 'producto' and pd.estado in ('pagado', 'entregado') group by 1
  ),
  gas as (
    select date_trunc('month', g.fecha)::date as mes, sum(g.monto) as total from public.gastos g where g.tenant_id = p_tenant_id group by 1
  ),
  meses as (
    select coalesce(ing_membresias.mes, coalesce(ing_productos.mes, gas.mes)) as mes,
           coalesce(ing_membresias.total, 0) + coalesce(ing_productos.total, 0) as ingresos, coalesce(gas.total, 0) as gastos
    from ing_membresias full outer join ing_productos on ing_productos.mes = ing_membresias.mes
    full outer join gas on gas.mes = coalesce(ing_membresias.mes, ing_productos.mes)
  )
  select coalesce(sum(ingresos - gastos), 0), coalesce(json_agg(json_build_object('mes', mes, 'margen', ingresos - gastos) order by mes), '[]'::json)
    into v_utilidad_acumulada, v_flujos from meses;

  return json_build_object('capital_invertido', round(v_capital_invertido, 2), 'primera_fecha_inversion', v_primera_fecha,
    'utilidad_operativa_acumulada', round(v_utilidad_acumulada, 2),
    'roi_pct', case when v_capital_invertido > 0 then round(v_utilidad_acumulada / v_capital_invertido, 4) else null end,
    'flujos_mensuales', v_flujos);
end;
$$;
revoke all on function public.kpi_finanzas_inversion(uuid) from public;
grant execute on function public.kpi_finanzas_inversion(uuid) to authenticated;

create or replace function public.kpi_finanzas_resumen(p_tenant_id uuid, p_desde date, p_hasta date)
returns json
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_ingresos numeric := 0; v_ingresos_membresias numeric := 0; v_ingresos_productos numeric := 0;
  v_gastos_fijos numeric := 0; v_gastos_variables numeric := 0; v_costo_variable_clase numeric := 0;
  v_clases_corridas int := 0; v_capacidad_total int := 0; v_reservas_confirmadas int := 0; v_clientas_activas int := 0;
  v_margen_contribucion numeric; v_margen_contribucion_pct numeric; v_margen_operativo numeric; v_margen_operativo_pct numeric;
  v_precio_promedio_clase numeric; v_margen_contribucion_clase numeric; v_punto_equilibrio_clases numeric; v_punto_equilibrio_q numeric;
  v_capacidad_promedio_clase numeric; v_ocupacion_pct numeric; v_ocupacion_breakeven_pct numeric;
  v_ingreso_promedio_clienta numeric; v_margen_promedio_clienta numeric;
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','contadora']) then return null; end if;

  select coalesce(sum(coalesce(m.precio_final, pq.precio, 0)), 0) into v_ingresos_membresias
    from public.membresias m left join public.paquetes pq on pq.id = m.paquete_id
    where m.tenant_id = p_tenant_id and m.pagada = true and m.estado <> 'anulada' and m.confirmado_at::date between p_desde and p_hasta;

  select coalesce(sum(pi.cantidad * pi.precio_unitario), 0) into v_ingresos_productos
    from public.pedido_items pi join public.pedidos pd on pd.id = pi.pedido_id
    where pd.tenant_id = p_tenant_id and pi.tipo = 'producto' and pd.estado in ('pagado', 'entregado') and pd.pagado_at::date between p_desde and p_hasta;

  v_ingresos := v_ingresos_membresias + v_ingresos_productos;

  select coalesce(sum(monto) filter (where tipo = 'fijo'), 0), coalesce(sum(monto) filter (where tipo = 'variable'), 0)
    into v_gastos_fijos, v_gastos_variables from public.gastos where tenant_id = p_tenant_id and fecha between p_desde and p_hasta;

  select costo_variable_por_clase into v_costo_variable_clase from public.configuracion_finanzas where tenant_id = p_tenant_id;
  v_costo_variable_clase := coalesce(v_costo_variable_clase, 0);

  select count(*), coalesce(sum(h.cupo_maximo), 0), coalesce(sum(s.reservas), 0)
    into v_clases_corridas, v_capacidad_total, v_reservas_confirmadas
    from (
      select r.horario_id, r.fecha, count(*) as reservas from public.reservas r
      where r.tenant_id = p_tenant_id and r.estado = 'confirmada' and r.fecha between p_desde and least(p_hasta, public.hoy_en_sede(r.sede_id))
      group by r.horario_id, r.fecha
    ) s join public.horarios h on h.id = s.horario_id;

  select count(distinct cliente_id) into v_clientas_activas from public.reservas
    where tenant_id = p_tenant_id and estado = 'confirmada' and fecha between p_desde and p_hasta;

  v_margen_contribucion := v_ingresos - v_gastos_variables;
  v_margen_contribucion_pct := case when v_ingresos > 0 then v_margen_contribucion / v_ingresos else null end;
  v_margen_operativo := v_ingresos - v_gastos_fijos - v_gastos_variables;
  v_margen_operativo_pct := case when v_ingresos > 0 then v_margen_operativo / v_ingresos else null end;
  v_precio_promedio_clase := case when v_reservas_confirmadas > 0 then v_ingresos_membresias / v_reservas_confirmadas else null end;
  v_margen_contribucion_clase := case when v_precio_promedio_clase is not null then v_precio_promedio_clase - v_costo_variable_clase else null end;
  v_punto_equilibrio_clases := case when v_margen_contribucion_clase is not null and v_margen_contribucion_clase > 0 then v_gastos_fijos / v_margen_contribucion_clase else null end;
  v_punto_equilibrio_q := case when v_precio_promedio_clase is not null and v_precio_promedio_clase > 0 and v_margen_contribucion_clase is not null and v_margen_contribucion_clase > 0
    then v_gastos_fijos / (v_margen_contribucion_clase / v_precio_promedio_clase) else null end;
  v_capacidad_promedio_clase := case when v_clases_corridas > 0 then round(v_capacidad_total::numeric / v_clases_corridas, 1) else null end;
  v_ocupacion_pct := case when v_capacidad_total > 0 then v_reservas_confirmadas::numeric / v_capacidad_total else null end;
  v_ocupacion_breakeven_pct := case when v_punto_equilibrio_clases is not null and v_clases_corridas > 0 then v_punto_equilibrio_clases / v_clases_corridas else null end;
  v_ingreso_promedio_clienta := case when v_clientas_activas > 0 then v_ingresos / v_clientas_activas else null end;
  v_margen_promedio_clienta := case when v_ingreso_promedio_clienta is not null and v_margen_operativo_pct is not null then v_ingreso_promedio_clienta * v_margen_operativo_pct else null end;

  return json_build_object('ingresos', round(v_ingresos, 2), 'ingresos_membresias', round(v_ingresos_membresias, 2),
    'ingresos_productos', round(v_ingresos_productos, 2), 'gastos_fijos', round(v_gastos_fijos, 2), 'gastos_variables', round(v_gastos_variables, 2),
    'gastos_totales', round(v_gastos_fijos + v_gastos_variables, 2), 'margen_contribucion', round(v_margen_contribucion, 2),
    'margen_contribucion_pct', round(v_margen_contribucion_pct, 4), 'margen_operativo', round(v_margen_operativo, 2),
    'margen_operativo_pct', round(v_margen_operativo_pct, 4), 'costo_variable_por_clase', v_costo_variable_clase,
    'precio_promedio_clase', round(v_precio_promedio_clase, 2), 'margen_contribucion_clase', round(v_margen_contribucion_clase, 2),
    'punto_equilibrio_clases', round(v_punto_equilibrio_clases, 1), 'punto_equilibrio_q', round(v_punto_equilibrio_q, 2),
    'clases_corridas', v_clases_corridas, 'capacidad_total', v_capacidad_total, 'capacidad_promedio_clase', v_capacidad_promedio_clase,
    'reservas_confirmadas', v_reservas_confirmadas, 'ocupacion_pct', round(v_ocupacion_pct, 4), 'ocupacion_breakeven_pct', round(v_ocupacion_breakeven_pct, 4),
    'clientas_activas', v_clientas_activas, 'ingreso_promedio_clienta', round(v_ingreso_promedio_clienta, 2), 'margen_promedio_clienta', round(v_margen_promedio_clienta, 2));
end;
$$;
revoke all on function public.kpi_finanzas_resumen(uuid, date, date) from public;
grant execute on function public.kpi_finanzas_resumen(uuid, date, date) to authenticated;

create or replace function public.kpi_finanzas_serie_mensual(p_tenant_id uuid, p_meses integer default 12)
returns table(mes date, ingresos numeric, gastos numeric)
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_desde date := date_trunc('month', public.hoy_en_sede(null))::date - ((p_meses - 1) * interval '1 month');
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','contadora']) then return; end if;
  return query
  with meses as (select generate_series(v_desde, date_trunc('month', public.hoy_en_sede(null))::date, interval '1 month')::date as mes),
  ing_membresias as (
    select date_trunc('month', m.confirmado_at)::date as mes, sum(coalesce(m.precio_final, pq.precio, 0)) as total
    from public.membresias m left join public.paquetes pq on pq.id = m.paquete_id
    where m.tenant_id = p_tenant_id and m.pagada = true and m.estado <> 'anulada' and m.confirmado_at >= v_desde group by 1
  ),
  ing_productos as (
    select date_trunc('month', pd.pagado_at)::date as mes, sum(pi.cantidad * pi.precio_unitario) as total
    from public.pedido_items pi join public.pedidos pd on pd.id = pi.pedido_id
    where pd.tenant_id = p_tenant_id and pi.tipo = 'producto' and pd.estado in ('pagado', 'entregado') and pd.pagado_at >= v_desde group by 1
  ),
  gas as (
    select date_trunc('month', g.fecha)::date as mes, sum(g.monto) as total from public.gastos g where g.tenant_id = p_tenant_id and g.fecha >= v_desde group by 1
  )
  select meses.mes, coalesce(ing_membresias.total, 0) + coalesce(ing_productos.total, 0), coalesce(gas.total, 0)
  from meses left join ing_membresias on ing_membresias.mes = meses.mes left join ing_productos on ing_productos.mes = meses.mes
  left join gas on gas.mes = meses.mes order by meses.mes;
end;
$$;
revoke all on function public.kpi_finanzas_serie_mensual(uuid, integer) from public;
grant execute on function public.kpi_finanzas_serie_mensual(uuid, integer) to authenticated;

create or replace function public.kpi_iva_resumen(p_tenant_id uuid, p_desde date, p_hasta date)
returns json
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_tasa numeric := 0.12; v_ingresos numeric := 0; v_ingresos_membresias numeric := 0; v_ingresos_productos numeric := 0; v_gastos_operativos numeric := 0;
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','contadora']) then return null; end if;

  select coalesce(sum(coalesce(m.precio_final, pq.precio, 0)), 0) into v_ingresos_membresias
    from public.membresias m left join public.paquetes pq on pq.id = m.paquete_id
    where m.tenant_id = p_tenant_id and m.pagada = true and m.confirmado_at::date between p_desde and p_hasta;

  select coalesce(sum(pi.cantidad * pi.precio_unitario), 0) into v_ingresos_productos
    from public.pedido_items pi join public.pedidos pd on pd.id = pi.pedido_id
    where pd.tenant_id = p_tenant_id and pi.tipo = 'producto' and pd.estado in ('pagado', 'entregado') and pd.pagado_at::date between p_desde and p_hasta;

  v_ingresos := v_ingresos_membresias + v_ingresos_productos;
  select coalesce(sum(monto), 0) into v_gastos_operativos from public.gastos where tenant_id = p_tenant_id and fecha between p_desde and p_hasta;

  return json_build_object('tasa', v_tasa, 'ingresos', round(v_ingresos, 2), 'ingresos_membresias', round(v_ingresos_membresias, 2),
    'ingresos_productos', round(v_ingresos_productos, 2), 'gastos_operativos', round(v_gastos_operativos, 2),
    'debito_fiscal_estimado', round(v_ingresos * v_tasa / (1 + v_tasa), 2), 'credito_fiscal_estimado', round(v_gastos_operativos * v_tasa / (1 + v_tasa), 2),
    'iva_por_pagar_estimado', round((v_ingresos - v_gastos_operativos) * v_tasa / (1 + v_tasa), 2));
end;
$$;
revoke all on function public.kpi_iva_resumen(uuid, date, date) from public;
grant execute on function public.kpi_iva_resumen(uuid, date, date) to authenticated;

create or replace function public.kpi_recurrente_resumen(p_tenant_id uuid, p_desde date default null, p_hasta date default null)
returns json
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_total_bruto numeric := 0; v_total_comision numeric := 0; v_cantidad int := 0;
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','contadora']) then return null; end if;
  select coalesce(sum(monto), 0), coalesce(sum(monto * 0.045 + 2), 0), count(*)
    into v_total_bruto, v_total_comision, v_cantidad
    from public.pago_transacciones tx
    where tx.tenant_id = p_tenant_id and tx.proveedor = 'recurrente' and tx.estado = 'confirmado'
      and (p_desde is null or tx.actualizado_at::date >= p_desde) and (p_hasta is null or tx.actualizado_at::date <= p_hasta);
  return json_build_object('total_bruto', round(v_total_bruto, 2), 'total_comision_estimada', round(v_total_comision, 2),
    'total_neto_estimado', round(v_total_bruto - v_total_comision, 2), 'cantidad_transacciones', v_cantidad);
end;
$$;
revoke all on function public.kpi_recurrente_resumen(uuid, date, date) from public;
grant execute on function public.kpi_recurrente_resumen(uuid, date, date) to authenticated;
