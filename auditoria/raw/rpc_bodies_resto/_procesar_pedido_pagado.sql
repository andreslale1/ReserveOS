CREATE OR REPLACE FUNCTION public._procesar_pedido_pagado(p_pedido_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pedido record;
  v_item record;
  v_membresia_id uuid;
begin
  select * into v_pedido from pedidos where id = p_pedido_id;
  if v_pedido is null then
    raise exception 'Pedido no encontrado';
  end if;
  if v_pedido.estado != 'pendiente_pago' then
    return json_build_object('ok', true, 'ya_procesado', true, 'membresia_id', null);
  end if;

  for v_item in select * from pedido_items where pedido_id = p_pedido_id loop
    if v_item.tipo = 'producto' then
      update producto_variantes set stock = stock - v_item.cantidad where id = v_item.variante_id;
    else
      if v_item.membresia_id is not null then
        update membresias set clases_totales = pq.num_clases, pagada = true, confirmado_at = now()
          from paquetes pq
          where membresias.id = v_item.membresia_id and pq.id = v_item.paquete_id
          returning membresias.id into v_membresia_id;
      else
        insert into membresias
          (cliente_id, paquete_id, metodo_pago, descuento_pct, precio_final, estado, clases_totales, clases_usadas,
           fecha_inicio, fecha_vencimiento, pagada, origen, codigo_descuento_id, confirmado_at)
          select v_pedido.cliente_id, pq.id, v_pedido.metodo_pago, v_pedido.descuento_pct, v_item.precio_unitario, 'activa',
                 pq.num_clases, 0, ((now() - interval '6 hours')::date), ((now() - interval '6 hours')::date) + pq.vigencia_dias, true, 'compra', v_pedido.codigo_descuento_id, now()
          from paquetes pq where pq.id = v_item.paquete_id
          returning membresias.id into v_membresia_id;
      end if;

      perform otorgar_bono_referido_si_corresponde(v_pedido.cliente_id, v_item.paquete_id);
    end if;
  end loop;

  if v_pedido.codigo_descuento_usado_id is not null then
    update codigos_descuento set usos_actuales = usos_actuales + 1 where id = v_pedido.codigo_descuento_usado_id;
  end if;

  update pedidos set estado = 'pagado', pagado_at = now() where id = p_pedido_id;

  return json_build_object('ok', true, 'membresia_id', v_membresia_id);
end;
$function$
