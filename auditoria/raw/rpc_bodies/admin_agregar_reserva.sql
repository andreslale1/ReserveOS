CREATE OR REPLACE FUNCTION public.admin_agregar_reserva(p_cliente_id uuid, p_horario_id uuid, p_fecha date, p_tipo text DEFAULT 'regular'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cupo int;
  v_ocupadas int;
  v_reserva_id uuid;
  v_estado_actual text;
  v_membresia_id uuid;
  v_clases_totales int;
  v_tutor_familia_id uuid;
begin
  if not exists (select 1 from perfiles where id = auth.uid() and rol = 'duena') then
    raise exception 'Solo la dueña puede asignar reservas';
  end if;
  if p_tipo not in ('regular', 'prueba') then
    raise exception 'Tipo de reserva inválido';
  end if;
  select cupo_maximo into v_cupo from horarios where id = p_horario_id;
  if v_cupo is null then raise exception 'Horario no válido'; end if;

  -- La fecha tiene que corresponder al horario: mismo día de la semana
  -- (o la fecha exacta si es clase puntual), y no cancelada/privatizada.
  if not exists (
    select 1 from horarios where id = p_horario_id
      and ((fecha_especifica is null and dia_semana = extract(dow from p_fecha)::int)
           or fecha_especifica = p_fecha)
  ) then
    raise exception 'Esa fecha no corresponde a ese horario — revisa que el día de la semana de la fecha coincida con el de la clase.';
  end if;
  if exists (select 1 from horario_cancelaciones where horario_id = p_horario_id and fecha = p_fecha) then
    raise exception 'Esa fecha está cancelada para ese horario.';
  end if;
  if exists (select 1 from horario_fechas_privadas where horario_id = p_horario_id and fecha = p_fecha) then
    raise exception 'Esa fecha está privatizada — agrégala desde Horarios, no desde aquí.';
  end if;
  select id, estado into v_reserva_id, v_estado_actual from reservas
    where cliente_id = p_cliente_id and horario_id = p_horario_id and fecha = p_fecha;
  if v_reserva_id is not null and v_estado_actual = 'confirmada' then
    raise exception 'Esta clienta ya tiene una reserva confirmada en esa clase';
  end if;
  select count(*) into v_ocupadas from reservas
    where horario_id = p_horario_id and fecha = p_fecha and estado = 'confirmada';
  if v_ocupadas >= v_cupo then raise exception 'Ese horario ya no tiene cupo disponible'; end if;
  if p_tipo = 'regular' then
    select id, clases_totales into v_membresia_id, v_clases_totales from membresias
      where cliente_id = p_cliente_id and estado = 'activa'
        and congelada_desde is null
        and fecha_vencimiento >= p_fecha
        and (clases_totales is null or clases_usadas < clases_totales)
      order by fecha_vencimiento asc
      limit 1;
    if v_membresia_id is null then
      select coalesce(tutor_id, id) into v_tutor_familia_id from clientes where id = p_cliente_id;
      select m.id, m.clases_totales into v_membresia_id, v_clases_totales
        from membresias m join paquetes pq on pq.id = m.paquete_id
        where m.cliente_id = v_tutor_familia_id and pq.compartido_familiar = true
          and m.estado = 'activa' and m.congelada_desde is null and m.fecha_vencimiento >= p_fecha
          and (m.clases_totales is null or m.clases_usadas < m.clases_totales)
        order by m.fecha_vencimiento asc limit 1;
    end if;
    if v_membresia_id is null then
      raise exception 'Esta clienta no tiene un paquete activo con cupo disponible — asígnale un paquete o un link de pago primero, o márcala como clase de prueba.';
    end if;
  end if;
  if v_reserva_id is not null then
    update reservas set estado = 'confirmada', tipo = p_tipo where id = v_reserva_id;
  else
    insert into reservas (horario_id, cliente_id, fecha, tipo, estado)
      values (p_horario_id, p_cliente_id, p_fecha, p_tipo, 'confirmada')
      returning id into v_reserva_id;
  end if;
  if p_tipo = 'regular' and v_clases_totales is not null then
    update membresias set clases_usadas = clases_usadas + 1 where id = v_membresia_id;
  end if;
  return json_build_object('ok', true, 'reserva_id', v_reserva_id);
end;
$function$
