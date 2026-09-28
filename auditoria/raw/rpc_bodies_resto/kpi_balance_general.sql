CREATE OR REPLACE FUNCTION public.kpi_balance_general()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_total_activos numeric := 0;
  v_total_pasivos numeric := 0;
  v_ingresos_totales numeric := 0;
  v_utilidad_acumulada numeric := 0;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol in ('duena', 'contadora')) then
    return null;
  end if;

  select coalesce(sum(monto), 0) into v_total_activos from activos;
  select coalesce(sum(monto), 0) into v_total_pasivos from pasivos;

  select coalesce(sum(coalesce(m.precio_final, pq.precio, 0)), 0)
    into v_ingresos_totales
    from membresias m
    left join paquetes pq on pq.id = m.paquete_id
    where m.pagada = true;

  v_ingresos_totales := v_ingresos_totales + coalesce((
    select sum(pi.cantidad * pi.precio_unitario)
    from pedido_items pi
    join pedidos pd on pd.id = pi.pedido_id
    where pi.tipo = 'producto' and pd.estado in ('pagado', 'entregado')
  ), 0);

  v_utilidad_acumulada := v_ingresos_totales - coalesce((select sum(monto) from gastos where tipo in ('fijo_operativo', 'variable_operativo')), 0);

  return json_build_object(
    'total_activos', round(v_total_activos, 2),
    'total_pasivos', round(v_total_pasivos, 2),
    'utilidad_acumulada', round(v_utilidad_acumulada, 2),
    'patrimonio_estimado', round(v_total_activos - v_total_pasivos + v_utilidad_acumulada, 2)
  );
end;
$function$
