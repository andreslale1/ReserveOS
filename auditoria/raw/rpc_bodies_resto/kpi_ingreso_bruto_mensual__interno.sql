CREATE OR REPLACE FUNCTION public.kpi_ingreso_bruto_mensual__interno(p_meses integer DEFAULT 12)
 RETURNS TABLE(mes date, ingreso_real numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with membresias_mes as (
    select date_trunc('month', m.confirmado_at)::date as mes,
      coalesce(m.precio_final, pq.precio, 0) as monto
    from membresias m
    join paquetes pq on pq.id = m.paquete_id
    where m.estado = 'activa' and m.pagada = true and m.confirmado_at is not null
  ),
  privatizaciones_mes as (
    select date_trunc('month', confirmado_at)::date as mes, precio as monto
    from horario_fechas_privadas_personas
    where pagada = true and confirmado_at is not null
  ),
  pedidos_mes as (
    select date_trunc('month', pagado_at)::date as mes, total as monto
    from pedidos
    where estado in ('pagado', 'entregado') and pagado_at is not null
  ),
  cobros_personalizados_mes as (
    select date_trunc('month', confirmado_at)::date as mes, monto
    from cobros_personalizados
    where confirmado_at is not null
  ),
  todo as (
    select * from membresias_mes
    union all select * from privatizaciones_mes
    union all select * from pedidos_mes
    union all select * from cobros_personalizados_mes
  )
  select t.mes, sum(t.monto) as ingreso_real
  from todo t
  group by t.mes
  order by t.mes desc
  limit p_meses;
$function$
