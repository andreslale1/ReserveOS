CREATE OR REPLACE FUNCTION public.registrar_venta_presencial(p_variante_id uuid, p_cantidad integer, p_metodo_pago text, p_cliente_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cliente_id uuid;
  v_variante record;
  v_producto record;
  v_pedido_id uuid;
  v_total numeric;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol in ('duena', 'empleada')) then
    raise exception 'No tienes permiso para registrar ventas';
  end if;

  if p_cantidad is null or p_cantidad < 1 then
    raise exception 'Cantidad inválida';
  end if;

  if p_metodo_pago not in ('efectivo', 'tarjeta_estudio', 'transferencia', 'pasarela') then
    raise exception 'Método de pago no válido';
  end if;

  v_cliente_id := coalesce(p_cliente_id, '716aca27-ddaa-401a-bb5c-5e620edaf26b'::uuid);
  if not exists (select 1 from clientes where id = v_cliente_id) then
    raise exception 'Clienta no encontrada';
  end if;

  select * into v_variante from producto_variantes where id = p_variante_id for update;
  if v_variante is null then
    raise exception 'Producto no encontrado';
  end if;
  if v_variante.stock < p_cantidad then
    raise exception 'No hay suficiente stock — quedan %', v_variante.stock;
  end if;

  select * into v_producto from productos where id = v_variante.producto_id;
  v_total := v_producto.precio * p_cantidad;

  insert into pedidos (cliente_id, estado, metodo_pago, total, pagado_at)
    values (v_cliente_id, 'pagado', p_metodo_pago, v_total, now())
    returning id into v_pedido_id;

  insert into pedido_items (pedido_id, tipo, producto_id, variante_id, nombre, variante_nombre, cantidad, precio_unitario)
    values (v_pedido_id, 'producto', v_producto.id, v_variante.id, v_producto.nombre, v_variante.nombre, p_cantidad, v_producto.precio);

  update producto_variantes set stock = stock - p_cantidad where id = p_variante_id;

  return json_build_object('ok', true, 'pedido_id', v_pedido_id, 'total', v_total);
end;
$function$
