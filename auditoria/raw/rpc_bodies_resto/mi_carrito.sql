CREATE OR REPLACE FUNCTION public.mi_carrito()
 RETURNS TABLE(item_id uuid, tipo text, cantidad integer, producto_id uuid, producto_nombre text, imagen_url text, variante_id uuid, variante_nombre text, stock_disponible integer, paquete_id uuid, paquete_nombre text, precio_unitario numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_carrito_id uuid;
begin
  select c.id into v_carrito_id from carritos c
    join clientes cl on cl.id = c.cliente_id
    where cl.user_id = auth.uid() and c.estado = 'activo';

  if v_carrito_id is null then
    return;
  end if;

  return query
  select ci.id, ci.tipo, ci.cantidad,
    pr.id, pr.nombre, coalesce(v.imagen_url, pr.imagen_url),
    v.id, v.nombre, v.stock,
    pq.id, pq.nombre,
    coalesce(pr.precio, pq.precio)
  from carrito_items ci
  left join productos pr on pr.id = ci.producto_id
  left join producto_variantes v on v.id = ci.variante_id
  left join paquetes pq on pq.id = ci.paquete_id
  where ci.carrito_id = v_carrito_id
  order by ci.created_at;
end;
$function$
