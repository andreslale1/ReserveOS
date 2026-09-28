CREATE OR REPLACE FUNCTION public.kpi_ranking_instructoras()
 RETURNS TABLE(instructor_id uuid, nombre text, total_clases bigint, ocupacion_promedio numeric, pct_asistencia numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return;
  end if;

  return query
  with sesiones as (
    select
      h.instructor_id,
      r.fecha,
      r.horario_id,
      count(*) filter (where r.estado = 'confirmada')::numeric as reservas,
      h.cupo_maximo,
      count(*) filter (where r.estado = 'confirmada' and r.fecha < ((now() - interval '6 hours')::date)) as pasadas,
      count(*) filter (where r.estado = 'confirmada' and r.fecha < ((now() - interval '6 hours')::date) and r.asistio is true) as asistidas
    from horarios h
    join reservas r on r.horario_id = h.id
    where h.instructor_id is not null
    group by h.instructor_id, r.fecha, r.horario_id, h.cupo_maximo
  )
  select
    p.id as instructor_id,
    p.nombre,
    count(distinct (s.fecha, s.horario_id)) as total_clases,
    round(avg(s.reservas / s.cupo_maximo * 100), 1) as ocupacion_promedio,
    case when sum(s.pasadas) = 0 then null
      else round(100.0 * sum(s.asistidas) / sum(s.pasadas), 1)
    end as pct_asistencia
  from perfiles p
  join sesiones s on s.instructor_id = p.id
  where p.rol = 'instructora'
  group by p.id, p.nombre
  order by ocupacion_promedio desc nulls last;
end;
$function$
