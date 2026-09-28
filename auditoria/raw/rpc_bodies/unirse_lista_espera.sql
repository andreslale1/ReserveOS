CREATE OR REPLACE FUNCTION public.unirse_lista_espera(p_horario_id uuid, p_fecha date, p_cliente_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_propio_id uuid;
  v_cliente_id uuid;
  v_cupo int;
  v_ocupadas int;
begin
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

  if v_ocupadas < v_cupo then
    raise exception 'Esta clase todavía tiene cupo — resérvala directo.';
  end if;

  if exists (select 1 from reservas where cliente_id = v_cliente_id and horario_id = p_horario_id and fecha = p_fecha and estado = 'confirmada') then
    raise exception 'Ya tiene una reserva confirmada en esa clase.';
  end if;

  insert into lista_espera (horario_id, cliente_id, fecha)
    values (p_horario_id, v_cliente_id, p_fecha)
    on conflict (horario_id, cliente_id, fecha) do nothing;

  return json_build_object('ok', true);
end;
$function$
