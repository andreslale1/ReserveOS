CREATE OR REPLACE FUNCTION public.confirmar_transaccion_carrito(p_transaccion_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tx record;
  v_resultado json;
begin
  select * into v_tx from pago_transacciones where id = p_transaccion_id;
  if v_tx is null then
    raise exception 'Transacción no encontrada';
  end if;
  if v_tx.estado = 'exitoso' then
    return json_build_object('ok', true, 'ya_procesada', true, 'pedido_id', v_tx.pedido_id);
  end if;

  v_resultado := _procesar_pedido_pagado(v_tx.pedido_id);

  update pago_transacciones set estado = 'exitoso', actualizado_at = now() where id = p_transaccion_id;

  return json_build_object('ok', true, 'pedido_id', v_tx.pedido_id, 'membresia_id', v_resultado->>'membresia_id');
end;
$function$
