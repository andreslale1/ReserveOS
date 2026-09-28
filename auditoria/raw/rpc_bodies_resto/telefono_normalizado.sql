CREATE OR REPLACE FUNCTION public.telefono_normalizado(p_telefono text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare
  v_digitos text := regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g');
begin
  if length(v_digitos) = 8 then
    return v_digitos;
  elsif length(v_digitos) = 11 and left(v_digitos, 3) = '502' then
    return right(v_digitos, 8);
  else
    return null;
  end if;
end;
$function$
