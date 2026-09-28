CREATE OR REPLACE FUNCTION public.horarios_por_comenzar(p_minutos_antes integer DEFAULT 15)
 RETURNS TABLE(horario_id uuid, instructor_id uuid, nombre_clase text, hora_inicio time without time zone, fecha date, confirmadas integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ahora timestamp := (now() - interval '6 hours')::timestamp;
  v_hoy date := v_ahora::date;
begin
  return query
  select h.id, h.instructor_id, h.nombre_clase, h.hora_inicio, v_hoy,
         (select count(*)::int from reservas r where r.horario_id = h.id and r.fecha = v_hoy and r.estado = 'confirmada')
  from horarios h
  where h.activo = true
    and h.dia_semana = extract(dow from v_hoy)
    and (v_hoy + h.hora_inicio) > v_ahora
    and (v_hoy + h.hora_inicio) <= v_ahora + (p_minutos_antes || ' minutes')::interval
    and not exists (
      select 1 from avisos_operativos_enviados a
      where a.horario_id = h.id and a.fecha = v_hoy and a.tipo = 'inicio'
    );
end;
$function$
