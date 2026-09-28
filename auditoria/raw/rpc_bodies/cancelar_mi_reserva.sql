CREATE OR REPLACE FUNCTION public.cancelar_mi_reserva(p_reserva_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_propio_id uuid;
  v_reserva record;
  v_horas_minimas int;
  v_horas_faltantes numeric;
  v_es_tardia boolean;
begin
  select id into v_propio_id from clientes where user_id = auth.uid();

  select r.*, h.hora_inicio into v_reserva
    from reservas r join horarios h on h.id = r.horario_id
    where r.id = p_reserva_id
      and (r.cliente_id = v_propio_id or r.cliente_id in (select id from clientes where tutor_id = v_propio_id))
      and r.estado = 'confirmada';

  if v_reserva is null then
    raise exception 'Reserva no encontrada';
  end if;

  select horas_minimas_cancelacion into v_horas_minimas from configuracion_reservas where id = true;
  v_horas_minimas := coalesce(v_horas_minimas, 2);

  -- Guatemala es UTC-6 todo el año — fecha+hora_inicio es hora local.
  v_horas_faltantes := extract(epoch from ((v_reserva.fecha + v_reserva.hora_inicio) - (now() - interval '6 hours')::timestamp)) / 3600;
  v_es_tardia := v_horas_faltantes < v_horas_minimas;

  update reservas set estado = 'cancelada', penalizada = v_es_tardia where id = p_reserva_id;

  if v_reserva.tipo = 'regular' and not v_es_tardia then
    perform devolver_clase_a_membresia(v_reserva.cliente_id);
  end if;

  return json_build_object('ok', true, 'penalizada', v_es_tardia, 'horas_minimas', v_horas_minimas);
end;
$function$
