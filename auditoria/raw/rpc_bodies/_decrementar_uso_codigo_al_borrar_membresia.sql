CREATE OR REPLACE FUNCTION public._decrementar_uso_codigo_al_borrar_membresia()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if OLD.codigo_descuento_id is not null then
    update codigos_descuento set usos_actuales = greatest(usos_actuales - 1, 0) where id = OLD.codigo_descuento_id;
  end if;
  return OLD;
end;
$function$
