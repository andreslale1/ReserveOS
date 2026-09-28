CREATE OR REPLACE FUNCTION public.cancelar_fecha_horario(p_horario_id uuid, p_fecha date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_categoria text;
  v_reserva record;
  v_afectados jsonb := '[]'::jsonb;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol in ('duena', 'empleada')) then
    raise exception 'No autorizado';
  end if;

  select categoria into v_categoria from horarios where id = p_horario_id;
  if v_categoria is null then
    raise exception 'Horario no válido';
  end if;

  if exists (select 1 from horario_cancelaciones where horario_id = p_horario_id and fecha = p_fecha) then
    raise exception 'Esa fecha ya está cancelada.';
  end if;

  if exists (select 1 from horario_fechas_privadas where horario_id = p_horario_id and fecha = p_fecha) then
    raise exception 'Esa fecha está privatizada — quita la privatización primero si quieres cancelarla.';
  end if;

  insert into horario_cancelaciones (horario_id, fecha) values (p_horario_id, p_fecha);

  for v_reserva in
    select id, cliente_id, tipo from reservas
      where horario_id = p_horario_id and fecha = p_fecha and estado = 'confirmada'
  loop
    update reservas set estado = 'cancelada' where id = v_reserva.id;

    if v_reserva.tipo = 'regular' then
      perform devolver_clase_a_membresia(v_reserva.cliente_id);
    end if;

    v_afectados := v_afectados || jsonb_build_object('cliente_id', v_reserva.cliente_id, 'tipo', v_reserva.tipo);
  end loop;

  delete from lista_espera where horario_id = p_horario_id and fecha = p_fecha;

  return json_build_object('ok', true, 'afectados', v_afectados);
end;
$function$
