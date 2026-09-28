CREATE OR REPLACE FUNCTION public.editar_venta_producto(p_pedido_id uuid, p_cliente_id uuid, p_variante_id uuid, p_cantidad integer, p_metodo_pago text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pedido record;
  v_item record;
  v_variante record;
  v_producto record;
  v_total numeric;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol in ('duena', 'empleada')) then
    raise exception 'No tienes permiso para editar ventas';
  end if;

  if p_cantidad is null or p_cantidad < 1 then
    raise exception 'Cantidad inválida';
  end if;
  if p_metodo_pago not in ('efectivo', 'tarjeta_estudio', 'transferencia', 'pasarela') then
    raise exception 'Método de pago no válido';
  end if;
  if not exists (select 1 from clientes where id = p_cliente_id) then
    raise exception 'Clienta no encontrada';
  end if;

  select * into v_pedido from pedidos where id = p_pedido_id;
  if v_pedido is null then
    raise exception 'Venta no encontrada';
  end if;
  if v_pedido.estado = 'cancelado' then
    raise exception 'Esta venta está cancelada — no se puede editar';
  end if;
  if (select count(*) from pedido_items where pedido_id = p_pedido_id) <> 1
     or exists (select 1 from pedido_items where pedido_id = p_pedido_id and tipo <> 'producto') then
    raise exception 'Esta venta no se puede editar aquí — avísame directo';
  end if;

  select * into v_item from pedido_items where pedido_id = p_pedido_id;

  update producto_variantes set stock = stock + v_item.cantidad where id = v_item.variante_id;

  select * into v_variante from producto_variantes where id = p_variante_id for update;
  if v_variante is null then
    update producto_variantes set stock = stock - v_item.cantidad where id = v_item.variante_id;
    raise exception 'Producto no encontrado';
  end if;
  if v_variante.stock < p_cantidad then
    update producto_variantes set stock = stock - v_item.cantidad where id = v_item.variante_id;
    raise exception 'No hay suficiente stock — quedan %', v_variante.stock;
  end if;

  select * into v_producto from productos where id = v_variante.producto_id;
  v_total := v_producto.precio * p_cantidad;

  update producto_variantes set stock = stock - p_cantidad where id = p_variante_id;

  update pedido_items set
    producto_id = v_producto.id,
    variante_id = v_variante.id,
    nombre = v_producto.nombre,
    variante_nombre = v_variante.nombre,
    cantidad = p_cantidad,
    precio_unitario = v_producto.precio
  where id = v_item.id;

  update pedidos set cliente_id = p_cliente_id, metodo_pago = p_metodo_pago, total = v_total
  where id = p_pedido_id;

  return json_build_object('ok', true, 'total', v_total);
end;
$function$
