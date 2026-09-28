CREATE OR REPLACE FUNCTION public.iniciar_checkout_carrito(p_metodo_pago text, p_codigo_descuento text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cliente_id uuid;
  v_carrito_id uuid;
  v_item record;
  v_stock int;
  v_total numeric := 0;
  v_pedido_id uuid;
  v_descuento_generico int := 0;
  v_codigo_id uuid;
  v_aplica_a text;
  v_descuento_pct_paquete int := 0;
  v_codigo_id_pedido uuid;
  v_paquete_item record;
  v_precio_item numeric;
  v_descuento_pct_item int;
  v_transaccion_id uuid;
  v_codigo_usado boolean := false;
  v_membresia_capada_id uuid;
begin
  if p_metodo_pago not in ('efectivo', 'pasarela') then
    raise exception 'Método de pago no válido';
  end if;

  select id into v_cliente_id from clientes where user_id = auth.uid();
  if v_cliente_id is null then
    raise exception 'No se encontró tu cuenta de clienta';
  end if;

  select id into v_carrito_id from carritos where cliente_id = v_cliente_id and estado = 'activo';
  if v_carrito_id is null or not exists (select 1 from carrito_items where carrito_id = v_carrito_id) then
    raise exception 'Tu carrito está vacío';
  end if;

  if p_codigo_descuento is not null and trim(p_codigo_descuento) <> '' then
    select g.v_descuento_pct, g.v_codigo_id, g.v_aplica_a into v_descuento_generico, v_codigo_id, v_aplica_a
      from _codigo_valido_generico(p_codigo_descuento) g;
  end if;

  select ci.* into v_paquete_item from carrito_items ci where ci.carrito_id = v_carrito_id and ci.tipo = 'paquete';
  if found and v_codigo_id is not null then
    if v_aplica_a in ('paquetes', 'todo') then
      if exists (select 1 from codigos_descuento_paquetes where codigo_id = v_codigo_id)
         and not exists (select 1 from codigos_descuento_paquetes where codigo_id = v_codigo_id and paquete_id = v_paquete_item.paquete_id) then
        raise exception 'Este código no aplica para el paquete seleccionado';
      end if;
      v_descuento_pct_paquete := v_descuento_generico;
      v_codigo_id_pedido := v_codigo_id;
      v_codigo_usado := true;
    end if;
  end if;

  insert into pedidos (cliente_id, estado, metodo_pago, total, codigo_descuento_id, descuento_pct)
    values (v_cliente_id, 'pendiente_pago', p_metodo_pago, 0, v_codigo_id_pedido, v_descuento_pct_paquete)
    returning id into v_pedido_id;

  for v_item in select * from carrito_items where carrito_id = v_carrito_id loop
    if v_item.tipo = 'producto' then
      select stock into v_stock from producto_variantes where id = v_item.variante_id for update;
      if v_stock is null or v_stock < v_item.cantidad then
        raise exception 'Ya no hay suficiente stock de %', (select nombre || ' — ' || (select nombre from producto_variantes where id = v_item.variante_id) from productos where id = v_item.producto_id);
      end if;

      v_descuento_pct_item := 0;
      if v_codigo_id is not null and v_aplica_a in ('productos', 'todo') then
        if not exists (select 1 from codigos_descuento_productos where codigo_id = v_codigo_id)
           or exists (select 1 from codigos_descuento_productos where codigo_id = v_codigo_id and producto_id = v_item.producto_id) then
          v_descuento_pct_item := v_descuento_generico;
          v_codigo_usado := true;
        end if;
      end if;

      select round(precio * (1 - v_descuento_pct_item / 100.0), 2) into v_precio_item from productos where id = v_item.producto_id;

      insert into pedido_items (pedido_id, tipo, producto_id, variante_id, nombre, variante_nombre, cantidad, precio_unitario)
        select v_pedido_id, 'producto', p.id, v.id, p.nombre, v.nombre, v_item.cantidad, v_precio_item
          from productos p join producto_variantes v on v.id = v_item.variante_id where p.id = v_item.producto_id;

      v_total := v_total + (v_precio_item * v_item.cantidad);
    else
      select round(precio * (1 - v_descuento_pct_paquete / 100.0), 2) into v_precio_item from paquetes where id = v_item.paquete_id;

      v_membresia_capada_id := null;
      if p_metodo_pago = 'efectivo' then
        -- Mismo patrón que solicitar_membresia(): acceso instantáneo
        -- capado a 1 clase mientras se confirma el cobro.
        insert into membresias
          (cliente_id, paquete_id, metodo_pago, descuento_pct, precio_final, estado, clases_totales, clases_usadas,
           fecha_inicio, fecha_vencimiento, pagada, origen, codigo_descuento_id)
          select v_cliente_id, pq.id, p_metodo_pago, v_descuento_pct_paquete, v_precio_item, 'activa', 1, 0,
                 ((now() - interval '6 hours')::date), ((now() - interval '6 hours')::date) + pq.vigencia_dias, false, 'compra', v_codigo_id_pedido
          from paquetes pq where pq.id = v_item.paquete_id
          returning membresias.id into v_membresia_capada_id;
      end if;

      insert into pedido_items (pedido_id, tipo, paquete_id, nombre, cantidad, precio_unitario, membresia_id)
        select v_pedido_id, 'paquete', id, nombre, 1, v_precio_item, v_membresia_capada_id from paquetes where id = v_item.paquete_id;

      v_total := v_total + v_precio_item;
    end if;
  end loop;

  if v_codigo_id is not null and not v_codigo_usado then
    raise exception 'Este código no aplica a lo que tienes en el carrito';
  end if;

  update pedidos set total = v_total, codigo_descuento_usado_id = (case when v_codigo_usado then v_codigo_id else null end)
    where id = v_pedido_id;
  update carritos set estado = 'convertido', actualizado_at = now() where id = v_carrito_id;

  if p_metodo_pago = 'pasarela' then
    insert into pago_transacciones (cliente_id, tipo, pedido_id, proveedor, monto)
      values (v_cliente_id, 'carrito', v_pedido_id, 'recurrente', v_total)
      returning id into v_transaccion_id;
  end if;

  return json_build_object('pedido_id', v_pedido_id, 'transaccion_id', v_transaccion_id, 'total', v_total, 'metodo_pago', p_metodo_pago);
end;
$function$
