CREATE OR REPLACE FUNCTION public.agendar_clase_privada(p_horario_id uuid, p_fecha date, p_cliente_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_propio_id uuid;
  v_cliente_id uuid;
  v_cupo int;
  v_categoria text;
  v_ocupadas int;
  v_membresia_id uuid;
  v_reserva_id uuid;
  v_estado_existente text;
begin
  if p_fecha < greatest((now() - interval '6 hours')::date, date '2026-09-21') then
    raise exception 'Las reservas abren a partir del 21 de septiembre de 2026.';
  end if;

  select id into v_propio_id from clientes where user_id = auth.uid();
  if v_propio_id is null then
    raise exception 'Completa tu perfil antes de reservar';
  end if;

  v_cliente_id := v_propio_id;
  if p_cliente_id is not null and p_cliente_id <> v_propio_id then
    if not exists (select 1 from clientes where id = p_cliente_id and tutor_id = v_propio_id) then
      raise exception 'No tienes permiso para reservar por esa persona.';
    end if;
    v_cliente_id := p_cliente_id;
  end if;

  select cupo_maximo, categoria into v_cupo, v_categoria from horarios where id = p_horario_id and activo = true;
  if v_cupo is null or v_categoria <> 'privado' then
    raise exception 'Horario no válido';
  end if;

  if not _fecha_coincide_horario(p_horario_id, p_fecha) then
    raise exception 'Esa fecha no corresponde a ese horario.';
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

  select m.id into v_membresia_id
    from membresias m
    join paquetes pq on pq.id = m.paquete_id
    where m.cliente_id = v_cliente_id
      and pq.categoria = 'privado'
      and m.estado = 'activa'
      and m.congelada_desde is null
      and m.fecha_vencimiento >= p_fecha
      and (m.clases_totales is null or m.clases_usadas < m.clases_totales)
    order by m.fecha_vencimiento asc
    limit 1;

  if v_membresia_id is null then
    raise exception 'No tienes un paquete de clase privada activo. Compra uno primero.';
  end if;

  if v_reserva_id is not null then
    update reservas set estado = 'confirmada', tipo = 'privado' where id = v_reserva_id;
  else
    insert into reservas (horario_id, cliente_id, fecha, tipo, estado)
      values (p_horario_id, v_cliente_id, p_fecha, 'privado', 'confirmada')
      returning id into v_reserva_id;
  end if;

  update membresias set clases_usadas = clases_usadas + 1 where id = v_membresia_id;

  return json_build_object('ok', true, 'reserva_id', v_reserva_id);
end;
$function$
