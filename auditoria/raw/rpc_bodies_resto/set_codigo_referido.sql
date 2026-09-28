CREATE OR REPLACE FUNCTION public.set_codigo_referido()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.codigo_referido is null then
    new.codigo_referido := generar_codigo_referido();
  end if;
  return new;
end;
$function$
