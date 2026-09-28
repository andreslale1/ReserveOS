CREATE OR REPLACE FUNCTION public.membresias_para_recordatorio_vencimiento(p_dias integer DEFAULT 3)
 RETURNS TABLE(membresia_id uuid, cliente_id uuid, user_id uuid, nombre text, email text, fecha_vencimiento date, paquete_nombre text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
  select m.id, c.id, c.user_id, c.nombre, c.email, m.fecha_vencimiento, p.nombre
  from membresias m
  join clientes c on c.id = m.cliente_id
  join paquetes p on p.id = m.paquete_id
  where m.estado = 'activa'
    and m.congelada_desde is null
    and m.recordatorio_vencimiento_enviado = false
    and m.fecha_vencimiento >= ((now() - interval '6 hours')::date)
    and m.fecha_vencimiento <= ((now() - interval '6 hours')::date) + p_dias
    and (m.clases_totales is null or m.clases_usadas < m.clases_totales);
end;
$function$
