CREATE OR REPLACE FUNCTION public.actualizar_cantidad_carrito(p_item_id uuid, p_cantidad integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_carrito_id uuid;
begin
  select c.id into v_carrito_id from carrito_items ci
    join carritos c on c.id = ci.carrito_id
    join clientes cl on cl.id = c.cliente_id
    where ci.id = p_item_id and cl.user_id = auth.uid();

  if v_carrito_id is null then
    raise exception 'Ítem no encontrado en tu carrito';
  end if;

  if p_cantidad <= 0 then
    delete from carrito_items where id = p_item_id;
  else
    update carrito_items set cantidad = p_cantidad where id = p_item_id;
  end if;

  update carritos set actualizado_at = now() where id = v_carrito_id;
  return json_build_object('ok', true);
end;
$function$
