CREATE OR REPLACE FUNCTION public.kpi_tendencia(p_granularidad text DEFAULT 'semana'::text)
 RETURNS TABLE(periodo date, total_reservas bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles where id = auth.uid()) then
    raise exception 'No autorizado';
  end if;
  return query select * from public.kpi_tendencia__interno(p_granularidad);
end;
$function$
