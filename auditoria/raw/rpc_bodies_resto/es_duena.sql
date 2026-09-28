CREATE OR REPLACE FUNCTION public.es_duena()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(select 1 from perfiles where id = auth.uid() and rol = 'duena');
$function$
