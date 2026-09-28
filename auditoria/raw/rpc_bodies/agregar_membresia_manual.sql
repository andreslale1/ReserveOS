CREATE OR REPLACE FUNCTION public.agregar_membresia_manual(p_cliente_id uuid, p_paquete_id uuid, p_metodo_pago text DEFAULT 'tarjeta_estudio'::text, p_codigo_descuento text DEFAULT NULL::text, p_fecha_cobro date DEFAULT NULL::date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_paquete record;
  v_membresia_id uuid;
  v_descuento_pct int := 0;
  v_codigo_id uuid;
  v_precio_final numeric;
  v_origen text := 'compra';
  v_confirmado_at timestamptz := now();
begin
  if not exists (select 1 from perfiles where id = auth.uid()) then
    raise exception 'No autorizado';
  end if;

  if p_metodo_pago not in ('transferencia', 'tarjeta_estudio', 'efectivo', 'cortesia', 'pasarela') then
    raise exception 'Método de pago no válido';
  end if;

  if p_metodo_pago = 'cortesia' and not exists (select 1 from perfiles where id = auth.uid() and rol = 'duena') then
    raise exception 'Solo la dueña puede otorgar paquetes de cortesía';
  end if;

  if p_fecha_cobro is not null then
    if not exists (select 1 from perfiles where id = auth.uid() and rol in ('duena', 'empleada')) then
      raise exception 'Solo dueña/empleada puede registrar un cobro con fecha atrasada';
    end if;
    if p_fecha_cobro > ((now() - interval '6 hours')::date) then
      raise exception 'La fecha del cobro no puede ser a futuro';
    end if;
    if p_fecha_cobro < ((now() - interval '6 hours')::date - 14) then
      raise exception 'Esa fecha es de hace más de 14 días — corrígelo manualmente en Supabase si el atraso es mayor.';
    end if;
    -- Mediodía GT: cae dentro del mismo día sin importar la hora exacta
    -- en que se termine de registrar.
    v_confirmado_at := (p_fecha_cobro::timestamp + interval '12 hours');
  end if;

  select num_clases, vigencia_dias, precio into v_paquete
    from paquetes where id = p_paquete_id and activo = true;
  if v_paquete is null then
    raise exception 'Paquete no válido';
  end if;

  if not exists (select 1 from clientes where id = p_cliente_id) then
    raise exception 'Clienta no encontrada';
  end if;

  if p_metodo_pago = 'cortesia' then
    v_origen := 'cortesia';
    v_precio_final := 0;
  else
    select v.v_descuento_pct, v.v_codigo_id into v_descuento_pct, v_codigo_id
      from _aplicar_codigo_descuento(p_codigo_descuento, p_paquete_id) v;

    v_precio_final := _precio_con_descuento(p_paquete_id, v_paquete.precio, v_codigo_id, v_descuento_pct);
  end if;

  insert into membresias
    (cliente_id, paquete_id, metodo_pago, descuento_pct, precio_final, codigo_descuento_id, estado, clases_totales, clases_usadas,
     fecha_inicio, fecha_vencimiento, pagada, origen, confirmado_at, confirmado_por)
    values
    (p_cliente_id, p_paquete_id, p_metodo_pago, v_descuento_pct, v_precio_final, v_codigo_id, 'activa', v_paquete.num_clases, 0,
     ((now() - interval '6 hours')::date), ((now() - interval '6 hours')::date) + v_paquete.vigencia_dias, true, v_origen, v_confirmado_at, auth.uid())
    returning id into v_membresia_id;

  perform otorgar_bono_referido_si_corresponde(p_cliente_id, p_paquete_id);

  return json_build_object('ok', true, 'membresia_id', v_membresia_id, 'precio_final', v_precio_final);
end;
$function$
