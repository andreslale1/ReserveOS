CREATE OR REPLACE FUNCTION public.reservas_para_recordatorio_agendada()
 RETURNS TABLE(reserva_id uuid, cliente_id uuid, user_id uuid, tutor_id uuid, tutor_user_id uuid, nombre text, email text, tutor_email text, nombre_clase text, fecha date, hora_inicio time without time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ahora timestamp := (now() - interval '6 hours')::timestamp;
begin
  return query
  select
    r.id,
    c.id,
    c.user_id,
    tutor.id,
    tutor.user_id,
    c.nombre,
    c.email,
    tutor.email,
    h.nombre_clase,
    r.fecha,
    h.hora_inicio
  from reservas r
  join horarios h on h.id = r.horario_id
  join clientes c on c.id = r.cliente_id
  left join clientes tutor on tutor.id = c.tutor_id
  where r.estado = 'confirmada'
    and r.recordatorio_agendada_enviado_at is null
    and (r.fecha + h.hora_inicio) > v_ahora
    and v_ahora >= (
      case
        when (r.fecha + h.hora_inicio) - ((r.created_at - interval '6 hours')::timestamp) > interval '24 hours'
          then ((r.created_at - interval '6 hours')::timestamp) + interval '24 hours'
        else (r.fecha + h.hora_inicio) - interval '3 hours'
      end
    );
end;
$function$
