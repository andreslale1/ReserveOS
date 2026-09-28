CREATE OR REPLACE FUNCTION public.kpi_finanzas_inversion()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_capital_invertido numeric := 0;
  v_primera_fecha date;
  v_utilidad_acumulada numeric := 0;
  v_flujos json;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol in ('duena', 'contadora')) then
    return null;
  end if;

  select coalesce(sum(monto), 0) into v_capital_invertido from (
    select monto, fecha from activos
    union all
    select monto, fecha from gastos where tipo in ('fijo_preoperativo', 'variable_preoperativo')
  ) t;

  select min(fecha) into v_primera_fecha from (
    select fecha from activos
    union all
    select fecha from gastos where tipo in ('fijo_preoperativo', 'variable_preoperativo')
  ) t;

  with ing_membresias as (
    select date_trunc('month', m.confirmado_at)::date as mes, sum(coalesce(m.precio_final, pq.precio, 0)) as total
    from membresias m
    left join paquetes pq on pq.id = m.paquete_id
    where m.pagada = true
    group by 1
  ),
  ing_productos as (
    select date_trunc('month', pd.pagado_at)::date as mes, sum(pi.cantidad * pi.precio_unitario) as total
    from pedido_items pi
    join pedidos pd on pd.id = pi.pedido_id
    where pi.tipo = 'producto' and pd.estado in ('pagado', 'entregado')
    group by 1
  ),
  gas as (
    select date_trunc('month', g.fecha)::date as mes, sum(g.monto) as total
    from gastos g
    where g.tipo in ('fijo_operativo', 'variable_operativo')
    group by 1
  ),
  meses as (
    select coalesce(ing_membresias.mes, coalesce(ing_productos.mes, gas.mes)) as mes,
           coalesce(ing_membresias.total, 0) + coalesce(ing_productos.total, 0) as ingresos,
           coalesce(gas.total, 0) as gastos
    from ing_membresias
    full outer join ing_productos on ing_productos.mes = ing_membresias.mes
    full outer join gas on gas.mes = coalesce(ing_membresias.mes, ing_productos.mes)
  )
  select coalesce(sum(ingresos - gastos), 0), coalesce(json_agg(json_build_object('mes', mes, 'margen', ingresos - gastos) order by mes), '[]'::json)
    into v_utilidad_acumulada, v_flujos
    from meses;

  return json_build_object(
    'capital_invertido', round(v_capital_invertido, 2),
    'primera_fecha_inversion', v_primera_fecha,
    'utilidad_operativa_acumulada', round(v_utilidad_acumulada, 2),
    'roi_pct', case when v_capital_invertido > 0 then round(v_utilidad_acumulada / v_capital_invertido, 4) else null end,
    'flujos_mensuales', v_flujos
  );
end;
$function$
