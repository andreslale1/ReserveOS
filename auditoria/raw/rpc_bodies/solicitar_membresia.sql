CREATE OR REPLACE FUNCTION public.solicitar_membresia(p_paquete_id uuid, p_referencia_pago text, p_metodo_pago text DEFAULT 'transferencia'::text, p_comprobante_url text DEFAULT NULL::text, p_codigo_descuento text DEFAULT NULL::text, p_cliente_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_propio_id uuid;
  v_cliente_id uuid;
  v_membresia_id uuid;
  v_codigo record;
  v_descuento_pct int := 0;
  v_codigo_id uuid := null;
  v_paquete record;
  v_precio_final numeric;
begin
  select id into v_propio_id from clientes where user_id = auth.uid();
  if v_propio_id is null then
    raise exception 'Primero completa tu registro';
  end if;

  v_cliente_id := v_propio_id;
  if p_cliente_id is not null and p_cliente_id <> v_propio_id then
    if not exists (select 1 from clientes where id = p_cliente_id and tutor_id = v_propio_id) then
      raise exception 'No tienes permiso para comprar un paquete para esa persona.';
    end if;
    v_cliente_id := p_cliente_id;
  end if;

  select num_clases, vigencia_dias, precio into v_paquete
    from paquetes where id = p_paquete_id and activo = true;
  if v_paquete is null then
    raise exception 'Paquete no válido';
  end if;

  if p_metodo_pago not in ('transferencia','tarjeta_estudio') then
    raise exception 'Método de pago no válido';
  end if;

  if p_metodo_pago = 'transferencia' then
    p_referencia_pago := trim(p_referencia_pago);

    if coalesce(p_referencia_pago, '') = '' then
      raise exception 'Ingresa el número de referencia de tu transferencia';
    end if;

    -- No verifica contra el banco (no tenemos acceso a eso) — pero corta
    -- de raíz el caso más tonto y más común: escribir cualquier cosa
    -- ("1111", "11111111", "asdf") solo para poder seguir. Un número de
    -- confirmación real de transferencia en Guatemala nunca es así.
    if length(regexp_replace(p_referencia_pago, '\s', '', 'g')) < 6 then
      raise exception 'Ese número de referencia se ve incompleto — cópialo tal cual aparece en tu comprobante de transferencia.';
    end if;
    if p_referencia_pago ~ '^(.)\1*$' then
      raise exception 'Ese número de referencia no parece real — cópialo tal cual aparece en tu comprobante de transferencia.';
    end if;

    -- Un número de confirmación de transferencia real nunca se repite.
    -- Si ya se usó (aprobado o pendiente, de cualquier clienta), alguien
    -- está reciclando un comprobante viejo o inventando el número.
    if exists (
      select 1 from membresias
        where metodo_pago = 'transferencia' and estado <> 'anulada'
          and referencia_pago = p_referencia_pago
    ) then
      raise exception 'Ese número de referencia ya se usó antes en otra solicitud. Si crees que es un error, contacta al estudio directamente.';
    end if;
  end if;

  if p_codigo_descuento is not null and trim(p_codigo_descuento) <> '' then
    select * into v_codigo from codigos_descuento
      where codigo = upper(trim(p_codigo_descuento)) and activo = true
        and (vigente_hasta is null or vigente_hasta >= ((now() - interval '6 hours')::date))
        and (usos_maximos is null or usos_actuales < usos_maximos);

    if v_codigo is null then
      raise exception 'Código de descuento no válido o vencido';
    end if;

    if exists (select 1 from codigos_descuento_paquetes where codigo_id = v_codigo.id)
       and not exists (select 1 from codigos_descuento_paquetes where codigo_id = v_codigo.id and paquete_id = p_paquete_id) then
      raise exception 'Este código no aplica para el paquete seleccionado';
    end if;

    if exists (select 1 from membresias where cliente_id = v_cliente_id and codigo_descuento_id = v_codigo.id) then
      raise exception 'Ya usaste este código antes — cada código se puede usar una sola vez por cuenta.';
    end if;

    v_descuento_pct := v_codigo.descuento_pct;
    v_codigo_id := v_codigo.id;
    update codigos_descuento set usos_actuales = usos_actuales + 1 where id = v_codigo.id;
  end if;

  v_precio_final := _precio_con_descuento(p_paquete_id, v_paquete.precio, v_codigo_id, v_descuento_pct);

  insert into membresias
    (cliente_id, paquete_id, referencia_pago, metodo_pago, comprobante_url, descuento_pct, precio_final, codigo_descuento_id,
     estado, clases_totales, clases_usadas, fecha_inicio, fecha_vencimiento, pagada)
    values
    (v_cliente_id, p_paquete_id, nullif(trim(p_referencia_pago), ''), p_metodo_pago, p_comprobante_url, v_descuento_pct, v_precio_final, v_codigo_id,
     'activa', 1, 0, ((now() - interval '6 hours')::date), ((now() - interval '6 hours')::date) + v_paquete.vigencia_dias, false)
    returning id into v_membresia_id;

  return json_build_object(
    'ok', true,
    'membresia_id', v_membresia_id,
    'activa_al_instante', true,
    'capada_a_una_clase', true
  );
end;
$function$
