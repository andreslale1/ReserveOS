CREATE OR REPLACE FUNCTION public.agregar_cobro_personalizado(p_cliente_id uuid, p_concepto text, p_monto numeric, p_metodo_pago text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cobro_id uuid;
begin
  if not exists (select 1 from perfiles where id = auth.uid() and rol = 'duena') then
    raise exception 'Solo la dueña puede registrar un cobro personalizado';
  end if;

  if p_concepto is null or trim(p_concepto) = '' then
    raise exception 'Falta el concepto del cobro';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;

  if p_metodo_pago not in ('transferencia', 'tarjeta_estudio', 'efectivo', 'pasarela') then
    raise exception 'Método de pago no válido';
  end if;

  if not exists (select 1 from clientes where id = p_cliente_id) then
    raise exception 'Clienta no encontrada';
  end if;

  insert into cobros_personalizados (cliente_id, concepto, monto, metodo_pago, confirmado_por)
    values (p_cliente_id, trim(p_concepto), p_monto, p_metodo_pago, auth.uid())
    returning id into v_cobro_id;

  return json_build_object('ok', true, 'cobro_id', v_cobro_id);
end;
$function$
