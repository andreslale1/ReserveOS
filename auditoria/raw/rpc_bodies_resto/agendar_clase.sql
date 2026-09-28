CREATE OR REPLACE FUNCTION public.agendar_clase(p_horario_id uuid, p_fecha date, p_cliente_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_propio_id uuid;
  v_cliente_id uuid;
  v_tutor_familia_id uuid;
  v_cupo int;
  v_ocupadas int;
  v_membresia_id uuid;
  v_clases_totales int;
  v_reserva_id uuid;
  v_estado_existente text;
  v_pago_pendiente boolean := false;
  v_ultimo_paquete_id uuid;
  v_gracia_agotada boolean;
  v_hoy_gt date;
  v_ya_uso_prueba boolean;
begin
  v_hoy_gt := (now() - interval '6 hours')::date;

  if p_fecha < greatest(v_hoy_gt, date '2026-09-21') then
    raise exception 'Las reservas abren a partir del 21 de septiembre de 2026.';
  end if;

  select id into v_propio_id from clientes where user_id = auth.uid();
  if v_propio_id is null then
    raise exception 'No tienes un perfil de clienta asociado';
  end if;

  v_cliente_id := v_propio_id;
  if p_cliente_id is not null and p_cliente_id <> v_propio_id then
    if not exists (select 1 from clientes where id = p_cliente_id and tutor_id = v_propio_id) then
      raise exception 'No tienes permiso para reservar por esa persona.';
    end if;
    v_cliente_id := p_cliente_id;
  end if;

  select cupo_maximo into v_cupo from horarios where id = p_horario_id and activo = true and categoria = 'regular';
  if v_cupo is null then
    raise exception 'Horario no válido';
  end if;

  if not _fecha_coincide_horario(p_horario_id, p_fecha) then
    raise exception 'Esa fecha no corresponde a ese horario.';
  end if;

  if exists (select 1 from horario_fechas_privadas where horario_id = p_horario_id and fecha = p_fecha) then
    raise exception 'Ese horario no tiene cupo disponible en esa fecha';
  end if;

  if exists (select 1 from horario_cancelaciones where horario_id = p_horario_id and fecha = p_fecha) then
    raise exception 'Ese horario no tiene clase en esa fecha.';
  end if;

  select count(*) into v_ocupadas from reservas
    where horario_id = p_horario_id and fecha = p_fecha and estado = 'confirmada';
  if v_ocupadas >= v_cupo then
    raise exception 'Ese horario ya no tiene cupo disponible';
  end if;

  select id, estado into v_reserva_id, v_estado_existente from reservas
    where horario_id = p_horario_id and cliente_id = v_cliente_id and fecha = p_fecha;

  if v_reserva_id is not null and v_estado_existente = 'confirmada' then
    raise exception 'Ya tiene una reserva confirmada en esa clase.';
  end if;

  select id, clases_totales into v_membresia_id, v_clases_totales from membresias
    where cliente_id = v_cliente_id and estado = 'activa'
      and congelada_desde is null
      and fecha_vencimiento >= p_fecha
      and (clases_totales is null or clases_usadas < clases_totales)
    order by fecha_vencimiento asc
    limit 1;

  if v_membresia_id is null then
    select coalesce(tutor_id, id) into v_tutor_familia_id from clientes where id = v_cliente_id;

    select m.id, m.clases_totales into v_membresia_id, v_clases_totales
      from membresias m
      join paquetes pq on pq.id = m.paquete_id
      where m.cliente_id = v_tutor_familia_id
        and pq.compartido_familiar = true
        and m.estado = 'activa'
        and m.congelada_desde is null
        and m.fecha_vencimiento >= p_fecha
        and (m.clases_totales is null or m.clases_usadas < m.clases_totales)
      order by m.fecha_vencimiento asc
      limit 1;
  end if;

  if v_membresia_id is null then
    select id, clases_totales into v_membresia_id, v_clases_totales from membresias
      where cliente_id = v_cliente_id and estado = 'activa' and pagada = false
        and congelada_desde is null
        and clases_usadas < clases_totales
      order by created_at desc limit 1;

    if v_membresia_id is not null then
      v_pago_pendiente := true;
    else
      select exists(select 1 from membresias where cliente_id = v_cliente_id and pagada = false)
        into v_gracia_agotada;

      if v_gracia_agotada then
        raise exception 'Tienes un pago pendiente. Contacta al estudio para renovar tu paquete.';
      end if;

      select paquete_id into v_ultimo_paquete_id from membresias
        where cliente_id = v_cliente_id order by created_at desc limit 1;

      if v_ultimo_paquete_id is null then
        select exists(select 1 from reservas where cliente_id = v_cliente_id and tipo = 'prueba' and estado <> 'cancelada')
          into v_ya_uso_prueba;

        if v_ya_uso_prueba then
          raise exception 'No tienes clases disponibles en tu paquete';
        end if;

        if v_reserva_id is not null then
          update reservas set estado = 'confirmada', tipo = 'prueba' where id = v_reserva_id;
        else
          insert into reservas (horario_id, cliente_id, fecha, tipo, estado)
            values (p_horario_id, v_cliente_id, p_fecha, 'prueba', 'confirmada')
            returning id into v_reserva_id;
        end if;

        return json_build_object('ok', true, 'reserva_id', v_reserva_id, 'pago_pendiente', false);
      end if;

      -- Antes: se creaba solo, en silencio, un paquete de 1 clase sin
      -- pagar y se reservaba al instante. Ahora: se rechaza con un
      -- mensaje reconocible — el frontend manda a "Mi paquete" a elegir
      -- paquete y método de pago de verdad.
      raise exception 'Necesitas comprar un paquete para poder reservar esta clase.';
    end if;
  end if;

  if v_reserva_id is not null then
    update reservas set estado = 'confirmada', tipo = 'regular' where id = v_reserva_id;
  else
    insert into reservas (horario_id, cliente_id, fecha, tipo, estado)
      values (p_horario_id, v_cliente_id, p_fecha, 'regular', 'confirmada')
      returning id into v_reserva_id;
  end if;

  if v_clases_totales is not null then
    update membresias set clases_usadas = clases_usadas + 1 where id = v_membresia_id;
  end if;

  return json_build_object('ok', true, 'reserva_id', v_reserva_id, 'pago_pendiente', v_pago_pendiente);
end;
$function$
