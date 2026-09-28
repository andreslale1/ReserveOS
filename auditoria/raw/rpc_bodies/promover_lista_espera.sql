CREATE OR REPLACE FUNCTION public.promover_lista_espera()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cupo int;
  v_hora_inicio time;
  v_ocupadas int;
  v_espera record;
  v_reserva_existente uuid;
  v_nueva_reserva_id uuid;
  v_membresia_id uuid;
  v_tutor_familia_id uuid;
begin
  if NEW.estado <> 'cancelada' or OLD.estado = 'cancelada' then
    return NEW;
  end if;

  -- Fecha cancelada o privatizada: no hay clase abierta a la cual promover.
  if exists (select 1 from horario_cancelaciones where horario_id = NEW.horario_id and fecha = NEW.fecha)
     or exists (select 1 from horario_fechas_privadas where horario_id = NEW.horario_id and fecha = NEW.fecha) then
    return NEW;
  end if;

  select cupo_maximo, hora_inicio into v_cupo, v_hora_inicio from horarios where id = NEW.horario_id;

  -- La clase ya empezó (hora de Guatemala) — no tiene sentido confirmar a nadie.
  if v_hora_inicio is null or (NEW.fecha + v_hora_inicio) <= (now() - interval '6 hours')::timestamp then
    return NEW;
  end if;

  select count(*) into v_ocupadas from reservas
    where horario_id = NEW.horario_id and fecha = NEW.fecha and estado = 'confirmada';

  if v_cupo is null or v_ocupadas >= v_cupo then
    return NEW;
  end if;

  for v_espera in
    select * from lista_espera
      where horario_id = NEW.horario_id and fecha = NEW.fecha
      order by created_at asc
  loop
    select id into v_membresia_id from membresias
      where cliente_id = v_espera.cliente_id
        and estado = 'activa'
        and congelada_desde is null
        and fecha_vencimiento >= NEW.fecha
        and (clases_totales is null or clases_usadas < clases_totales)
      order by fecha_vencimiento asc
      limit 1;

    if v_membresia_id is null then
      select coalesce(tutor_id, id) into v_tutor_familia_id from clientes where id = v_espera.cliente_id;

      select m.id into v_membresia_id
        from membresias m
        join paquetes pq on pq.id = m.paquete_id
        where m.cliente_id = v_tutor_familia_id
          and pq.compartido_familiar = true
          and m.estado = 'activa'
          and m.congelada_desde is null
          and m.fecha_vencimiento >= NEW.fecha
          and (m.clases_totales is null or m.clases_usadas < m.clases_totales)
        order by m.fecha_vencimiento asc
        limit 1;
    end if;

    if v_membresia_id is null then
      continue;
    end if;

    select id into v_reserva_existente from reservas
      where horario_id = NEW.horario_id and cliente_id = v_espera.cliente_id and fecha = NEW.fecha;

    if v_reserva_existente is not null then
      update reservas set estado = 'confirmada', tipo = 'regular' where id = v_reserva_existente;
      v_nueva_reserva_id := v_reserva_existente;
    else
      insert into reservas (horario_id, cliente_id, fecha, tipo, estado)
        values (NEW.horario_id, v_espera.cliente_id, NEW.fecha, 'regular', 'confirmada')
        returning id into v_nueva_reserva_id;
    end if;

    update membresias set clases_usadas = clases_usadas + 1 where id = v_membresia_id;

    delete from lista_espera where id = v_espera.id;

    insert into lista_espera_notificaciones (reserva_id, cliente_id)
      values (v_nueva_reserva_id, v_espera.cliente_id);

    exit;
  end loop;

  return NEW;
end;
$function$
