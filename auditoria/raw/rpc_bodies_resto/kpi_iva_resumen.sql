CREATE OR REPLACE FUNCTION public.kpi_iva_resumen(p_desde date, p_hasta date)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tasa numeric := 0.12;
  v_ingresos numeric := 0;
  v_ingresos_membresias numeric := 0;
  v_ingresos_productos numeric := 0;
  v_gastos_operativos numeric := 0;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol in ('duena', 'contadora')) then
    return null;
  end if;

  select coalesce(sum(coalesce(m.precio_final, pq.precio, 0)), 0) into v_ingresos_membresias
    from membresias m
    left join paquetes pq on pq.id = m.paquete_id
    where m.pagada = true and m.confirmado_at::date >= p_desde and m.confirmado_at::date <= p_hasta;

  select coalesce(sum(pi.cantidad * pi.precio_unitario), 0) into v_ingresos_productos
    from pedido_items pi
    join pedidos pd on pd.id = pi.pedido_id
    where pi.tipo = 'producto' and pd.estado in ('pagado', 'entregado')
      and pd.pagado_at::date >= p_desde and pd.pagado_at::date <= p_hasta;

  v_ingresos := v_ingresos_membresias + v_ingresos_productos;

  select coalesce(sum(monto), 0) into v_gastos_operativos
    from gastos where fecha >= p_desde and fecha <= p_hasta and tipo in ('fijo_operativo', 'variable_operativo');

  return json_build_object(
    'tasa', v_tasa,
    'ingresos', round(v_ingresos, 2),
    'ingresos_membresias', round(v_ingresos_membresias, 2),
    'ingresos_productos', round(v_ingresos_productos, 2),
    'gastos_operativos', round(v_gastos_operativos, 2),
    'debito_fiscal_estimado', round(v_ingresos * v_tasa / (1 + v_tasa), 2),
    'credito_fiscal_estimado', round(v_gastos_operativos * v_tasa / (1 + v_tasa), 2),
    'iva_por_pagar_estimado', round((v_ingresos - v_gastos_operativos) * v_tasa / (1 + v_tasa), 2)
  );
end;
$function$
