CREATE OR REPLACE FUNCTION public.generar_codigo_referido()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  v_codigo text;
begin
  loop
    v_codigo := upper(substr(md5(random()::text), 1, 6));
    exit when not exists (select 1 from clientes where codigo_referido = v_codigo);
  end loop;
  return v_codigo;
end;
$function$
