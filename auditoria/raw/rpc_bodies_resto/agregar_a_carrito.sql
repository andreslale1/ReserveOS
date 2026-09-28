CREATE OR REPLACE FUNCTION public.agregar_a_carrito(p_tipo text, p_producto_id uuid DEFAULT NULL::uuid, p_variante_id uuid DEFAULT NULL::uuid, p_paquete_id uuid DEFAULT NULL::uuid, p_cantidad integer DEFAULT 1)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_carrito_id uuid;
  v_stock int;
  v_item_existente uuid;
begin
  select _mi_carrito_activo() into v_carrito_id;

  if p_tipo = 'producto' then
    if p_producto_id is null or p_variante_id is null then
      raise exception 'Falta el producto o la variante';
    end if;
    select stock into v_stock from producto_variantes where id = p_variante_id and producto_id = p_producto_id;
    if v_stock is null then
      raise exception 'Producto no válido';
    end if;

    select id into v_item_existente from carrito_items
      where carrito_id = v_carrito_id and tipo = 'producto' and variante_id = p_variante_id;

    if v_item_existente is not null then
      update carrito_items set cantidad = cantidad + p_cantidad where id = v_item_existente;
    else
      insert into carrito_items (carrito_id, tipo, producto_id, variante_id, cantidad)
        values (v_carrito_id, 'producto', p_producto_id, p_variante_id, p_cantidad);
    end if;

  elsif p_tipo = 'paquete' then
    if p_paquete_id is null then
      raise exception 'Falta el paquete';
    end if;
    if not exists (select 1 from paquetes where id = p_paquete_id and activo = true) then
      raise exception 'Paquete no válido';
    end if;
    -- Solo un paquete a la vez en el carrito: si ya había otro, lo reemplaza.
    delete from carrito_items where carrito_id = v_carrito_id and tipo = 'paquete';
    insert into carrito_items (carrito_id, tipo, paquete_id, cantidad)
      values (v_carrito_id, 'paquete', p_paquete_id, 1);
  else
    raise exception 'Tipo de ítem no válido';
  end if;

  update carritos set actualizado_at = now() where id = v_carrito_id;
  return json_build_object('ok', true);
end;
$function$
