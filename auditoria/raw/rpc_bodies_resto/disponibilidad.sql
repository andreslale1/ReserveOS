CREATE OR REPLACE FUNCTION public.disponibilidad(p_desde date, p_hasta date)
 RETURNS TABLE(horario_id uuid, fecha date, hora_inicio time without time zone, hora_fin time without time zone, nombre_clase text, cupo_maximo integer, cupo_disponible integer, instructor_nombre text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    h.id,
    d.fecha,
    h.hora_inicio,
    h.hora_fin,
    h.nombre_clase,
    h.cupo_maximo,
    case when hp.id is not null then 0 else h.cupo_maximo - coalesce(r.ocupadas, 0) end as cupo_disponible,
    p.nombre as instructor_nombre
  from horarios h
  cross join lateral generate_series(greatest(p_desde, date '2026-09-21'), p_hasta, interval '1 day') as d(fecha)
  left join lateral (
    select count(*) as ocupadas from reservas
    where horario_id = h.id and fecha = d.fecha::date and estado = 'confirmada'
  ) r on true
  left join perfiles p on p.id = h.instructor_id
  left join horario_fechas_privadas hp on hp.horario_id = h.id and hp.fecha = d.fecha::date
  left join horario_cancelaciones hc on hc.horario_id = h.id and hc.fecha = d.fecha::date
  where h.activo = true
    and (d.fecha::date + h.hora_inicio) > (now() - interval '6 hours')::timestamp
    and h.categoria = 'regular'
    and extract(dow from d.fecha) = h.dia_semana
    and hc.horario_id is null
  order by d.fecha, h.hora_inicio;
$function$
