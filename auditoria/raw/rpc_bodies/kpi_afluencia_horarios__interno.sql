CREATE OR REPLACE FUNCTION public.kpi_afluencia_horarios__interno()
 RETURNS TABLE(horario_id uuid, nombre_clase text, dia_semana integer, hora_inicio time without time zone, cupo_maximo integer, total_reservas bigint, sesiones bigint, ocupacion_pct numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    h.id,
    h.nombre_clase,
    h.dia_semana,
    h.hora_inicio,
    h.cupo_maximo,
    count(r.id) as total_reservas,
    count(distinct r.fecha) as sesiones,
    case when count(distinct r.fecha) = 0 then 0
      else round(100.0 * count(r.id) / (count(distinct r.fecha) * h.cupo_maximo), 1)
    end as ocupacion_pct
  from horarios h
  left join reservas r on r.horario_id = h.id and r.estado = 'confirmada'
  where h.activo = true and h.categoria = 'regular' and h.fecha_especifica is null
  group by h.id, h.nombre_clase, h.dia_semana, h.hora_inicio, h.cupo_maximo
  order by ocupacion_pct desc;
$function$
