CREATE OR REPLACE FUNCTION public.kpi_instructora__interno(p_instructor_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ocupacion numeric;
  v_total_clases int;
  v_top_clientas json;
begin
  select round(avg(ocupacion), 1), count(*) into v_ocupacion, v_total_clases
  from (
    select r.fecha, r.horario_id, count(*)::numeric / h.cupo_maximo * 100 as ocupacion
    from reservas r
    join horarios h on h.id = r.horario_id
    where h.instructor_id = p_instructor_id and r.estado = 'confirmada' and r.fecha < ((now() - interval '6 hours')::date)
    group by r.fecha, r.horario_id, h.cupo_maximo
  ) sesiones;

  select json_agg(t) into v_top_clientas
  from (
    select c.nombre, count(*) as clases
    from reservas r
    join horarios h on h.id = r.horario_id
    join clientes c on c.id = r.cliente_id
    where h.instructor_id = p_instructor_id and r.estado = 'confirmada' and r.fecha < ((now() - interval '6 hours')::date)
    group by c.nombre
    order by count(*) desc
    limit 5
  ) t;

  return json_build_object(
    'ocupacion_promedio', coalesce(v_ocupacion, 0),
    'total_clases_dictadas', coalesce(v_total_clases, 0),
    'clientas_top', coalesce(v_top_clientas, '[]'::json)
  );
end;
$function$
