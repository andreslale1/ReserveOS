CREATE OR REPLACE FUNCTION public.quitar_de_carrito(p_item_id uuid)
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select actualizar_cantidad_carrito(p_item_id, 0);
$function$
