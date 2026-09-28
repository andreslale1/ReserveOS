CREATE OR REPLACE FUNCTION public.kpi_cancelaciones_prueba__interno(p_dias integer DEFAULT 30)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with universo as (
    select id, cliente_id from reservas
    where tipo = 'prueba' and fecha >= ((now() - interval '6 hours')::date) - p_dias
  ),
  canceladas as (
    select r.id, r.cliente_id from reservas r
    where r.tipo = 'prueba' and r.estado = 'cancelada' and r.fecha >= ((now() - interval '6 hours')::date) - p_dias
  ),
  reagendadas as (
    select c.id from canceladas c
    where exists (select 1 from reservas r2 where r2.cliente_id = c.cliente_id and r2.estado = 'confirmada')
  )
  select json_build_object(
    'total_pruebas', (select count(*) from universo),
    'total_canceladas', (select count(*) from canceladas),
    'pct_cancelacion', case when (select count(*) from universo) > 0
      then round(100.0 * (select count(*) from canceladas) / (select count(*) from universo), 1)
      else 0 end,
    'total_reagendadas', (select count(*) from reagendadas),
    'pct_reagendo', case when (select count(*) from canceladas) > 0
      then round(100.0 * (select count(*) from reagendadas) / (select count(*) from canceladas), 1)
      else 0 end
  );
$function$
