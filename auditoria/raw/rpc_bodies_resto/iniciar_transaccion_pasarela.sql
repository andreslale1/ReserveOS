CREATE OR REPLACE FUNCTION public.iniciar_transaccion_pasarela(p_paquete_id uuid, p_codigo_descuento text DEFAULT NULL::text, p_proveedor text DEFAULT 'recurrente'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cliente_id uuid;
  v_paquete record;
  v_descuento_pct int;
  v_codigo_id uuid;
  v_precio_final numeric;
  v_transaccion_id uuid;
begin
  select id into v_cliente_id from clientes where user_id = auth.uid();
  if v_cliente_id is null then
    raise exception 'No se encontró tu cuenta de clienta';
  end if;

  select * into v_paquete from paquetes where id = p_paquete_id and activo = true;
  if v_paquete is null then
    raise exception 'Paquete no válido';
  end if;

  select v.v_descuento_pct, v.v_codigo_id into v_descuento_pct, v_codigo_id
    from _validar_codigo_descuento(p_codigo_descuento, p_paquete_id) v;

  v_precio_final := _precio_con_descuento(p_paquete_id, v_paquete.precio, v_codigo_id, v_descuento_pct);

  insert into pago_transacciones (cliente_id, paquete_id, proveedor, monto, codigo_descuento_id, descuento_pct)
    values (v_cliente_id, p_paquete_id, p_proveedor, v_precio_final, v_codigo_id, v_descuento_pct)
    returning id into v_transaccion_id;

  return json_build_object('transaccion_id', v_transaccion_id, 'monto', v_precio_final, 'nombre_paquete', v_paquete.nombre);
end;
$function$
