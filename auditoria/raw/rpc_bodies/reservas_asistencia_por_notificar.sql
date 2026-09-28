CREATE OR REPLACE FUNCTION public.reservas_asistencia_por_notificar()
 RETURNS TABLE(reserva_id uuid, user_id uuid, nombre_clase text, fecha date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
  select r.id, c.user_id, h.nombre_clase, r.fecha
  from reservas r
  join horarios h on h.id = r.horario_id
  join clientes c on c.id = r.cliente_id
  where r.asistio = true
    and r.asistencia_notificada = false
    and c.user_id is not null;
end;
$function$
