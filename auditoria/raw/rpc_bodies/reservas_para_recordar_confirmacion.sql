CREATE OR REPLACE FUNCTION public.reservas_para_recordar_confirmacion()
 RETURNS TABLE(reserva_id uuid, nombre text, email text, user_id uuid, nombre_clase text, hora_inicio time without time zone, fecha date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_horas_confirmacion int;
  v_ahora timestamp := (now() - interval '6 hours')::timestamp;
begin
  select horas_minimas_confirmacion into v_horas_confirmacion from configuracion_reservas where id = true;
  v_horas_confirmacion := coalesce(v_horas_confirmacion, 1);

  return query
  select
    r.id, c.nombre, c.email, c.user_id, h.nombre_clase, h.hora_inicio, r.fecha
  from reservas r
  join horarios h on h.id = r.horario_id
  join clientes c on c.id = r.cliente_id
  where r.estado = 'confirmada'
    and r.tipo = 'regular'
    and r.confirmada_por_clienta_at is null
    and r.confirmacion_recordatorio_enviado = false
    and (r.fecha + h.hora_inicio) > v_ahora
    and (r.fecha + h.hora_inicio) <= v_ahora + (v_horas_confirmacion || ' hours')::interval
    and (
      select count(*) from reservas r2
      where r2.horario_id = r.horario_id and r2.fecha = r.fecha and r2.estado = 'confirmada'
    ) >= h.cupo_maximo;
end;
$function$
