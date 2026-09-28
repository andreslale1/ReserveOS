CREATE OR REPLACE FUNCTION public.kpi_reservas_mensual__interno(p_meses integer DEFAULT 12)
 RETURNS TABLE(mes date, reservas_real bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select date_trunc('month', r.fecha)::date as mes, count(*) as reservas_real
  from reservas r
  where r.estado = 'confirmada'
  group by mes
  order by mes desc
  limit p_meses;
$function$
