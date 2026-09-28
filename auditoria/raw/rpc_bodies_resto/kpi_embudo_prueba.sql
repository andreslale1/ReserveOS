CREATE OR REPLACE FUNCTION public.kpi_embudo_prueba(p_dias integer DEFAULT 90)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles where id = auth.uid()) then
    raise exception 'No autorizado';
  end if;
  return public.kpi_embudo_prueba__interno(p_dias);
end;
$function$
