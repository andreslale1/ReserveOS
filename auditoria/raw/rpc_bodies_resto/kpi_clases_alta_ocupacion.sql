CREATE OR REPLACE FUNCTION public.kpi_clases_alta_ocupacion(p_semanas integer DEFAULT 8)
 RETURNS TABLE(semana date, clases_totales bigint, clases_alta_ocupacion bigint, pct_alta_ocupacion numeric)
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
      r.horario_id,
      r.fecha,
      date_trunc('week', r.fecha)::date as sem,
      count(*) as reservas,
      h.cupo_maximo
    from reservas r
    join horarios h on h.id = r.horario_id
    where r.estado = 'confirmada'
      and r.fecha < ((now() - interval '6 hours')::date)
      and r.fecha >= ((now() - interval '6 hours')::date) - (p_semanas * 7)
      and h.categoria = 'regular'
    group by r.horario_id, r.fecha, h.cupo_maximo
  )
  select
    sem,
    count(*) as clases_totales,
    count(*) filter (where cupo_maximo > 0 and reservas::numeric / cupo_maximo > 0.7) as clases_alta_ocupacion,
    round(100.0 * count(*) filter (where cupo_maximo > 0 and reservas::numeric / cupo_maximo > 0.7) / count(*), 1) as pct_alta_ocupacion
  from sesiones
  group by sem
  order by sem;
end;
$function$
