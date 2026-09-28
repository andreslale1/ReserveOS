CREATE OR REPLACE FUNCTION public.iniciar_transaccion_pasarela_admin(p_cliente_id uuid, p_paquete_id uuid, p_codigo_descuento text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_paquete record;
  v_descuento_pct int;
  v_codigo_id uuid;
  v_precio_final numeric;
  v_transaccion_id uuid;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    raise exception 'Solo la dueña puede generar un link de pago';
  end if;

  if not exists (select 1 from clientes where id = p_cliente_id) then
    raise exception 'Clienta no encontrada';
  end if;

  select * into v_paquete from paquetes where id = p_paquete_id and activo = true;
  if v_paquete is null then
    raise exception 'Paquete no válido';
  end if;

  select v.v_descuento_pct, v.v_codigo_id into v_descuento_pct, v_codigo_id
    from _validar_codigo_descuento(p_codigo_descuento, p_paquete_id) v;

  v_precio_final := _precio_con_descuento(p_paquete_id, v_paquete.precio, v_codigo_id, v_descuento_pct);

  insert into pago_transacciones (cliente_id, paquete_id, proveedor, monto, codigo_descuento_id, descuento_pct)
    values (p_cliente_id, p_paquete_id, 'recurrente', v_precio_final, v_codigo_id, v_descuento_pct)
    returning id into v_transaccion_id;

  return json_build_object('transaccion_id', v_transaccion_id, 'monto', v_precio_final, 'nombre_paquete', v_paquete.nombre);
end;
$function$
