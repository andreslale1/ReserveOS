CREATE OR REPLACE FUNCTION public.cancelar_venta_producto(p_pedido_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pedido record;
  v_item record;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol in ('duena', 'empleada')) then
    raise exception 'No tienes permiso para cancelar ventas';
  end if;

  select * into v_pedido from pedidos where id = p_pedido_id;
  if v_pedido is null then
    raise exception 'Venta no encontrada';
  end if;
  if v_pedido.estado = 'cancelado' then
    raise exception 'Esta venta ya está cancelada';
  end if;
  if exists (select 1 from pedido_items where pedido_id = p_pedido_id and tipo <> 'producto') then
    raise exception 'Esta venta incluye un paquete — contáctame para cancelarla, no solo producto.';
  end if;

  for v_item in select * from pedido_items where pedido_id = p_pedido_id and tipo = 'producto' loop
    update producto_variantes set stock = stock + v_item.cantidad where id = v_item.variante_id;
  end loop;

  if v_pedido.codigo_descuento_usado_id is not null then
    update codigos_descuento set usos_actuales = greatest(usos_actuales - 1, 0) where id = v_pedido.codigo_descuento_usado_id;
  end if;

  update pedidos set estado = 'cancelado' where id = p_pedido_id;

  return json_build_object('ok', true);
end;
$function$
