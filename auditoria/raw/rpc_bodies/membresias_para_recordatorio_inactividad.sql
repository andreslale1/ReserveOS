CREATE OR REPLACE FUNCTION public.membresias_para_recordatorio_inactividad(p_dias integer DEFAULT 14)
 RETURNS TABLE(membresia_id uuid, cliente_id uuid, user_id uuid, nombre text, email text, clases_restantes integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
  select
    m.id,
    c.id,
    c.user_id,
    c.nombre,
    c.email,
    case when m.clases_totales is null then null else m.clases_totales - m.clases_usadas end
  from membresias m
  join clientes c on c.id = m.cliente_id
  where m.estado = 'activa'
    and m.congelada_desde is null
    and m.fecha_vencimiento >= ((now() - interval '6 hours')::date)
    and (m.clases_totales is null or m.clases_usadas < m.clases_totales)
    and m.recordatorio_inactividad_enviado_at is null
    and m.created_at <= now() - (p_dias || ' days')::interval
    and not exists (
      select 1 from reservas r
      where r.cliente_id = c.id and r.estado = 'confirmada' and r.fecha >= ((now() - interval '6 hours')::date) - p_dias
    );
end;
$function$
