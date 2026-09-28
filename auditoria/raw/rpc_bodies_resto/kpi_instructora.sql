CREATE OR REPLACE FUNCTION public.kpi_instructora(p_instructor_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles where id = auth.uid()) then
    raise exception 'No autorizado';
  end if;
  if exists (select 1 from perfiles where id = auth.uid() and rol = 'instructora') and p_instructor_id <> auth.uid() then
    raise exception 'No autorizado';
  end if;
  return public.kpi_instructora__interno(p_instructor_id);
end;
$function$
