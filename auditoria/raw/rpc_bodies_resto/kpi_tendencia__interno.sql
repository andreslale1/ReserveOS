CREATE OR REPLACE FUNCTION public.kpi_tendencia__interno(p_granularidad text DEFAULT 'semana'::text)
 RETURNS TABLE(periodo date, total_reservas bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    date_trunc(
      case p_granularidad when 'dia' then 'day' when 'mes' then 'month' else 'week' end,
      created_at
    )::date as periodo,
    count(*) as total_reservas
  from reservas
  where estado = 'confirmada'
    and created_at >= now() - (
      case p_granularidad
        when 'dia' then interval '30 days'
        when 'mes' then interval '12 months'
        else interval '8 weeks'
      end
    )
  group by 1 order by 1;
$function$
