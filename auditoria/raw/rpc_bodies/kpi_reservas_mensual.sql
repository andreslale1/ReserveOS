CREATE OR REPLACE FUNCTION public.kpi_reservas_mensual(p_meses integer DEFAULT 12)
 RETURNS TABLE(mes date, reservas_real bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles where id = auth.uid()) then
    raise exception 'No autorizado';
  end if;
  return query select * from public.kpi_reservas_mensual__interno(p_meses);
end;
$function$
