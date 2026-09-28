CREATE OR REPLACE FUNCTION public.kpi_cancelaciones_prueba(p_dias integer DEFAULT 30)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles where id = auth.uid()) then
    raise exception 'No autorizado';
  end if;
  return public.kpi_cancelaciones_prueba__interno(p_dias);
end;
$function$
