CREATE OR REPLACE FUNCTION public.disponibilidad_privada(p_desde date, p_hasta date)
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
    h.cupo_maximo - coalesce(r.ocupadas, 0) as cupo_disponible,
    p.nombre as instructor_nombre
  from horarios h
  cross join lateral generate_series(greatest(p_desde, date '2026-09-21'), p_hasta, interval '1 day') as d(fecha)
  left join lateral (
    select count(*) as ocupadas from reservas
    where horario_id = h.id and fecha = d.fecha::date and estado = 'confirmada'
  ) r on true
  left join perfiles p on p.id = h.instructor_id
  where h.activo = true
    and (d.fecha::date + h.hora_inicio) > (now() - interval '6 hours')::timestamp
    and h.categoria = 'privado'
    and (
      (h.fecha_especifica is not null and h.fecha_especifica = d.fecha)
      or (h.fecha_especifica is null and extract(dow from d.fecha) = h.dia_semana)
    )
  order by d.fecha, h.hora_inicio;
$function$
