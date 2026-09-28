CREATE OR REPLACE FUNCTION public.privatizar_fecha_horario(p_horario_id uuid, p_fecha date, p_cupo integer DEFAULT 1)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_categoria text;
  v_activo boolean;
  v_otras_reservas int;
  v_id uuid;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol in ('duena', 'empleada')) then
    raise exception 'No autorizado';
  end if;

  if p_fecha < greatest((now() - interval '6 hours')::date, date '2026-09-21') then
    raise exception 'No se pueden privatizar fechas anteriores a la apertura de reservas.';
  end if;

  if coalesce(p_cupo, 0) < 1 then
    raise exception 'El cupo debe ser al menos 1.';
  end if;

  select categoria, activo into v_categoria, v_activo from horarios where id = p_horario_id;
  if v_categoria is null then
    raise exception 'Horario no válido';
  end if;
  if v_categoria <> 'regular' then
    raise exception 'Solo se pueden privatizar fechas de horarios regulares — las clases privadas ya tienen su propio calendario.';
  end if;
  if not v_activo then
    raise exception 'Ese horario está inactivo.';
  end if;

  if exists (select 1 from horario_cancelaciones where horario_id = p_horario_id and fecha = p_fecha) then
    raise exception 'Esa fecha está cancelada — quítale la cancelación primero si quieres privatizarla.';
  end if;

  if exists (select 1 from horario_fechas_privadas where horario_id = p_horario_id and fecha = p_fecha) then
    raise exception 'Esa fecha ya está privatizada.';
  end if;

  select count(*) into v_otras_reservas from reservas
    where horario_id = p_horario_id and fecha = p_fecha and estado = 'confirmada';
  if v_otras_reservas > 0 then
    raise exception 'Ya hay % clienta(s) con reserva confirmada en esa fecha — cancélalas primero o elige otra fecha.', v_otras_reservas;
  end if;

  insert into horario_fechas_privadas (horario_id, fecha, cupo)
    values (p_horario_id, p_fecha, p_cupo)
    returning id into v_id;

  return json_build_object('ok', true, 'privatizacion_id', v_id);
end;
$function$
