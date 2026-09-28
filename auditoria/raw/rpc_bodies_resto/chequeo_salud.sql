CREATE OR REPLACE FUNCTION public.chequeo_salud()
 RETURNS TABLE(chequeo text, severidad text, cantidad integer, detalle jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles where id = auth.uid() and rol in ('duena', 'empleada')) then
    raise exception 'No autorizado';
  end if;
  return query select * from chequeo_salud__interno();
end;
$function$
