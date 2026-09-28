CREATE OR REPLACE FUNCTION public.kpi_detalle_cancelaciones_prueba__interno(p_dias integer DEFAULT 30)
 RETURNS TABLE(reserva_id uuid, cliente_id uuid, cliente_nombre text, cliente_telefono text, cliente_email text, fecha date, hora_inicio time without time zone, reservo_de_nuevo boolean, nueva_fecha date, nueva_hora time without time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    r.id, r.cliente_id, c.nombre, c.telefono, c.email,
    r.fecha, h.hora_inicio,
    r2n.id is not null as reservo_de_nuevo,
    r2n.fecha, h2n.hora_inicio
  from reservas r
  join clientes c on c.id = r.cliente_id
  join horarios h on h.id = r.horario_id
  left join lateral (
    select r2.* from reservas r2
    where r2.cliente_id = r.cliente_id and r2.estado = 'confirmada'
    order by r2.fecha asc, r2.created_at asc
    limit 1
  ) r2n on true
  left join horarios h2n on h2n.id = r2n.horario_id
  where r.tipo = 'prueba' and r.estado = 'cancelada' and r.fecha >= ((now() - interval '6 hours')::date) - p_dias
  order by r.fecha desc, h.hora_inicio;
$function$
