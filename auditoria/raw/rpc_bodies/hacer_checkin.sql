CREATE OR REPLACE FUNCTION public.hacer_checkin()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cliente_id uuid;
  v_ahora timestamp;
  v_hoy date;
  v_reserva_id uuid;
  v_nombre_clase text;
  v_hora_inicio time;
begin
  v_ahora := now() - interval '6 hours';
  v_hoy := v_ahora::date;

  select id into v_cliente_id from clientes where user_id = auth.uid();
  if v_cliente_id is null then
    raise exception 'No tienes un perfil de clienta asociado';
  end if;

  select r.id, h.nombre_clase, h.hora_inicio
    into v_reserva_id, v_nombre_clase, v_hora_inicio
    from reservas r
    join horarios h on h.id = r.horario_id
    where r.cliente_id = v_cliente_id
      and r.fecha = v_hoy
      and r.estado = 'confirmada'
      and r.asistio is null
      and v_ahora between (r.fecha + h.hora_inicio - interval '30 minutes') and (r.fecha + h.hora_fin + interval '30 minutes')
    order by
      case
        when v_ahora between (r.fecha + h.hora_inicio) and (r.fecha + h.hora_fin) then 0
        when v_ahora < (r.fecha + h.hora_inicio) then 1
        else 2
      end,
      abs(extract(epoch from ((r.fecha + h.hora_inicio) - v_ahora)))
    limit 1;

  if v_reserva_id is null then
    raise exception 'No encontramos ninguna clase tuya para marcar en este momento. Si crees que es un error, avísale al estudio.';
  end if;

  update reservas set asistio = true where id = v_reserva_id;

  return json_build_object('ok', true, 'clase', v_nombre_clase, 'hora', v_hora_inicio);
end;
$function$
