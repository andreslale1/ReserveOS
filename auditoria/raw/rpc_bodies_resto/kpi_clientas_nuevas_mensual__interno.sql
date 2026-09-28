CREATE OR REPLACE FUNCTION public.kpi_clientas_nuevas_mensual__interno(p_meses integer DEFAULT 12)
 RETURNS TABLE(mes date, clientas_real bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select date_trunc('month', c.created_at)::date as mes, count(*) as clientas_real
  from clientes c
  group by mes
  order by mes desc
  limit p_meses;
$function$
