CREATE OR REPLACE FUNCTION public.kpi_finanzas_resumen(p_desde date, p_hasta date)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ingresos numeric := 0;
  v_ingresos_membresias numeric := 0;
  v_ingresos_productos numeric := 0;
  v_gastos_fijos numeric := 0;
  v_gastos_variables numeric := 0;
  v_costo_variable_clase numeric := 0;
  v_clases_corridas int := 0;
  v_capacidad_total int := 0;
  v_reservas_confirmadas int := 0;
  v_clientas_activas int := 0;
  v_margen_contribucion numeric;
  v_margen_contribucion_pct numeric;
  v_margen_operativo numeric;
  v_margen_operativo_pct numeric;
  v_precio_promedio_clase numeric;
  v_margen_contribucion_clase numeric;
  v_punto_equilibrio_clases numeric;
  v_punto_equilibrio_q numeric;
  v_capacidad_promedio_clase numeric;
  v_ocupacion_pct numeric;
  v_ocupacion_breakeven_pct numeric;
  v_ingreso_promedio_clienta numeric;
  v_margen_promedio_clienta numeric;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol in ('duena', 'contadora')) then
    return null;
  end if;

  select coalesce(sum(coalesce(m.precio_final, pq.precio, 0)), 0) into v_ingresos_membresias
    from membresias m
    left join paquetes pq on pq.id = m.paquete_id
    where m.pagada = true and m.estado <> 'anulada' and m.confirmado_at::date >= p_desde and m.confirmado_at::date <= p_hasta;

  select coalesce(sum(pi.cantidad * pi.precio_unitario), 0) into v_ingresos_productos
    from pedido_items pi
    join pedidos pd on pd.id = pi.pedido_id
    where pi.tipo = 'producto' and pd.estado in ('pagado', 'entregado')
      and pd.pagado_at::date >= p_desde and pd.pagado_at::date <= p_hasta;

  v_ingresos := v_ingresos_membresias + v_ingresos_productos;

  select coalesce(sum(monto) filter (where tipo = 'fijo_operativo'), 0), coalesce(sum(monto) filter (where tipo = 'variable_operativo'), 0)
    into v_gastos_fijos, v_gastos_variables
    from gastos where fecha >= p_desde and fecha <= p_hasta;

  select costo_variable_por_clase into v_costo_variable_clase from configuracion_finanzas where id = true;

  select count(*), coalesce(sum(h.cupo_maximo), 0), coalesce(sum(s.reservas), 0)
    into v_clases_corridas, v_capacidad_total, v_reservas_confirmadas
    from (
      select r.horario_id, r.fecha, count(*) as reservas
      from reservas r
      where r.estado = 'confirmada' and r.fecha >= p_desde and r.fecha <= least(p_hasta, ((now() - interval '6 hours')::date))
      group by r.horario_id, r.fecha
    ) s
    join horarios h on h.id = s.horario_id;

  select count(distinct cliente_id) into v_clientas_activas
    from reservas where estado = 'confirmada' and fecha >= p_desde and fecha <= p_hasta;

  v_margen_contribucion := v_ingresos - v_gastos_variables;
  v_margen_contribucion_pct := case when v_ingresos > 0 then v_margen_contribucion / v_ingresos else null end;
  v_margen_operativo := v_ingresos - v_gastos_fijos - v_gastos_variables;
  v_margen_operativo_pct := case when v_ingresos > 0 then v_margen_operativo / v_ingresos else null end;

  v_precio_promedio_clase := case when v_reservas_confirmadas > 0 then v_ingresos_membresias / v_reservas_confirmadas else null end;
  v_margen_contribucion_clase := case when v_precio_promedio_clase is not null then v_precio_promedio_clase - v_costo_variable_clase else null end;

  v_punto_equilibrio_clases := case
    when v_margen_contribucion_clase is not null and v_margen_contribucion_clase > 0
      then v_gastos_fijos / v_margen_contribucion_clase
    else null
  end;

  v_punto_equilibrio_q := case
    when v_precio_promedio_clase is not null and v_precio_promedio_clase > 0 and v_margen_contribucion_clase is not null and v_margen_contribucion_clase > 0
      then v_gastos_fijos / (v_margen_contribucion_clase / v_precio_promedio_clase)
    else null
  end;

  v_capacidad_promedio_clase := case when v_clases_corridas > 0 then round(v_capacidad_total::numeric / v_clases_corridas, 1) else null end;
  v_ocupacion_pct := case when v_capacidad_total > 0 then v_reservas_confirmadas::numeric / v_capacidad_total else null end;
  v_ocupacion_breakeven_pct := case
    when v_punto_equilibrio_clases is not null and v_clases_corridas > 0
      then v_punto_equilibrio_clases / v_clases_corridas
    else null
  end;

  v_ingreso_promedio_clienta := case when v_clientas_activas > 0 then v_ingresos / v_clientas_activas else null end;
  v_margen_promedio_clienta := case when v_ingreso_promedio_clienta is not null and v_margen_operativo_pct is not null
    then v_ingreso_promedio_clienta * v_margen_operativo_pct else null end;

  return json_build_object(
    'ingresos', round(v_ingresos, 2),
    'ingresos_membresias', round(v_ingresos_membresias, 2),
    'ingresos_productos', round(v_ingresos_productos, 2),
    'gastos_fijos', round(v_gastos_fijos, 2),
    'gastos_variables', round(v_gastos_variables, 2),
    'gastos_totales', round(v_gastos_fijos + v_gastos_variables, 2),
    'margen_contribucion', round(v_margen_contribucion, 2),
    'margen_contribucion_pct', round(v_margen_contribucion_pct, 4),
    'margen_operativo', round(v_margen_operativo, 2),
    'margen_operativo_pct', round(v_margen_operativo_pct, 4),
    'costo_variable_por_clase', v_costo_variable_clase,
    'precio_promedio_clase', round(v_precio_promedio_clase, 2),
    'margen_contribucion_clase', round(v_margen_contribucion_clase, 2),
    'punto_equilibrio_clases', round(v_punto_equilibrio_clases, 1),
    'punto_equilibrio_q', round(v_punto_equilibrio_q, 2),
    'clases_corridas', v_clases_corridas,
    'capacidad_total', v_capacidad_total,
    'capacidad_promedio_clase', v_capacidad_promedio_clase,
    'reservas_confirmadas', v_reservas_confirmadas,
    'ocupacion_pct', round(v_ocupacion_pct, 4),
    'ocupacion_breakeven_pct', round(v_ocupacion_breakeven_pct, 4),
    'clientas_activas', v_clientas_activas,
    'ingreso_promedio_clienta', round(v_ingreso_promedio_clienta, 2),
    'margen_promedio_clienta', round(v_margen_promedio_clienta, 2)
  );
end;
$function$
