CREATE OR REPLACE FUNCTION public.confirmar_pago_transaccion(p_transaccion_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tx record;
  v_paquete record;
  v_membresia_id uuid;
begin
  select * into v_tx from pago_transacciones where id = p_transaccion_id;
  if v_tx is null then
    raise exception 'Transacción no encontrada';
  end if;
  if v_tx.membresia_id is not null then
    return json_build_object('ok', true, 'membresia_id', v_tx.membresia_id, 'ya_procesada', true);
  end if;

  select * into v_paquete from paquetes where id = v_tx.paquete_id;
  if v_paquete is null then
    raise exception 'Paquete no encontrado';
  end if;

  insert into membresias
    (cliente_id, paquete_id, metodo_pago, descuento_pct, precio_final, estado, clases_totales, clases_usadas,
     fecha_inicio, fecha_vencimiento, pagada, origen, codigo_descuento_id, confirmado_at)
    values
    (v_tx.cliente_id, v_tx.paquete_id, 'pasarela', v_tx.descuento_pct, v_tx.monto, 'activa', v_paquete.num_clases, 0,
     ((now() - interval '6 hours')::date), ((now() - interval '6 hours')::date) + v_paquete.vigencia_dias, true, 'compra', v_tx.codigo_descuento_id, now())
    returning id into v_membresia_id;

  if v_tx.codigo_descuento_id is not null then
    update codigos_descuento set usos_actuales = usos_actuales + 1 where id = v_tx.codigo_descuento_id;
  end if;

  update pago_transacciones
    set estado = 'exitoso', membresia_id = v_membresia_id, actualizado_at = now()
    where id = p_transaccion_id;

  perform otorgar_bono_referido_si_corresponde(v_tx.cliente_id, v_tx.paquete_id);

  return json_build_object('ok', true, 'membresia_id', v_membresia_id);
end;
$function$
