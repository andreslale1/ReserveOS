CREATE OR REPLACE FUNCTION public.kpi_finanzas_serie_mensual(p_meses integer DEFAULT 12)
 RETURNS TABLE(mes date, ingresos numeric, gastos numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_desde date := date_trunc('month', ((now() - interval '6 hours')::date))::date - ((p_meses - 1) * interval '1 month');
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol in ('duena', 'contadora')) then
    return;
  end if;

  return query
  with meses as (
    select generate_series(v_desde, date_trunc('month', ((now() - interval '6 hours')::date))::date, interval '1 month')::date as mes
  ),
  ing_membresias as (
    select date_trunc('month', m.confirmado_at)::date as mes, sum(coalesce(m.precio_final, pq.precio, 0)) as total
    from membresias m
    left join paquetes pq on pq.id = m.paquete_id
    where m.pagada = true and m.estado <> 'anulada' and m.confirmado_at >= v_desde
    group by 1
  ),
  ing_productos as (
    select date_trunc('month', pd.pagado_at)::date as mes, sum(pi.cantidad * pi.precio_unitario) as total
    from pedido_items pi
    join pedidos pd on pd.id = pi.pedido_id
    where pi.tipo = 'producto' and pd.estado in ('pagado', 'entregado') and pd.pagado_at >= v_desde
    group by 1
  ),
  gas as (
    select date_trunc('month', g.fecha)::date as mes, sum(g.monto) as total
    from gastos g
    where g.fecha >= v_desde and g.tipo in ('fijo_operativo', 'variable_operativo')
    group by 1
  )
  select meses.mes, coalesce(ing_membresias.total, 0) + coalesce(ing_productos.total, 0), coalesce(gas.total, 0)
  from meses
  left join ing_membresias on ing_membresias.mes = meses.mes
  left join ing_productos on ing_productos.mes = meses.mes
  left join gas on gas.mes = meses.mes
  order by meses.mes;
end;
$function$
