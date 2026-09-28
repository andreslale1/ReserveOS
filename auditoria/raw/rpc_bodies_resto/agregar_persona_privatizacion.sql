CREATE OR REPLACE FUNCTION public.agregar_persona_privatizacion(p_horario_id uuid, p_fecha date, p_cliente_id uuid, p_precio numeric, p_metodo_pago text DEFAULT 'efectivo'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_privatizacion_id uuid;
  v_cupo int;
  v_ocupadas int;
  v_reserva_id uuid;
  v_estado_existente text;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol in ('duena', 'empleada')) then
    raise exception 'No autorizado';
  end if;

  if p_precio is null or p_precio <= 0 then
    raise exception 'Ingresa el precio del evento privado.';
  end if;

  if p_metodo_pago not in ('transferencia', 'tarjeta_estudio', 'efectivo', 'pasarela') then
    raise exception 'Método de pago no válido';
  end if;

  select id, cupo into v_privatizacion_id, v_cupo from horario_fechas_privadas
    where horario_id = p_horario_id and fecha = p_fecha;
  if v_privatizacion_id is null then
    raise exception 'Esa fecha no está privatizada.';
  end if;

  if not exists (select 1 from clientes where id = p_cliente_id) then
    raise exception 'Clienta no encontrada';
  end if;

  if exists (select 1 from horario_fechas_privadas_personas where privatizacion_id = v_privatizacion_id and cliente_id = p_cliente_id) then
    raise exception 'Esa clienta ya está agregada a esta fecha privatizada.';
  end if;

  select count(*) into v_ocupadas from horario_fechas_privadas_personas where privatizacion_id = v_privatizacion_id;
  if v_ocupadas >= v_cupo then
    raise exception 'Ya se llenó el cupo (%) de esta fecha privatizada.', v_cupo;
  end if;

  -- reservas tiene un unique(horario_id, cliente_id, fecha) — si esta
  -- clienta YA tenía una fila para este horario+fecha (ej. una reserva
  -- cancelada de antes), un insert ciego choca con esa unicidad. Se
  -- reutiliza la fila existente en vez de intentar crear otra.
  select id, estado into v_reserva_id, v_estado_existente from reservas
    where horario_id = p_horario_id and cliente_id = p_cliente_id and fecha = p_fecha;

  if v_reserva_id is not null and v_estado_existente = 'confirmada' then
    raise exception 'Esa clienta ya tiene una reserva confirmada en esa fecha.';
  end if;

  if v_reserva_id is not null then
    update reservas set estado = 'confirmada', tipo = 'regular' where id = v_reserva_id;
  else
    insert into reservas (horario_id, cliente_id, fecha, tipo, estado)
      values (p_horario_id, p_cliente_id, p_fecha, 'regular', 'confirmada')
      returning id into v_reserva_id;
  end if;

  insert into horario_fechas_privadas_personas (privatizacion_id, cliente_id, reserva_id, precio, metodo_pago)
    values (v_privatizacion_id, p_cliente_id, v_reserva_id, p_precio, p_metodo_pago);

  return json_build_object('ok', true, 'reserva_id', v_reserva_id);
end;
$function$
