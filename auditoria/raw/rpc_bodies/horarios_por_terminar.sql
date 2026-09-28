CREATE OR REPLACE FUNCTION public.horarios_por_terminar(p_minutos_antes integer DEFAULT 10)
 RETURNS TABLE(horario_id uuid, instructor_id uuid, nombre_clase text, hora_fin time without time zone, fecha date, sin_marcar integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ahora timestamp := (now() - interval '6 hours')::timestamp;
  v_hoy date := v_ahora::date;
begin
  return query
  select h.id, h.instructor_id, h.nombre_clase, h.hora_fin, v_hoy,
         (select count(*)::int from reservas r where r.horario_id = h.id and r.fecha = v_hoy and r.estado = 'confirmada' and r.asistio is null)
  from horarios h
  where h.activo = true
    and h.dia_semana = extract(dow from v_hoy)
    and (v_hoy + h.hora_fin) > v_ahora
    and (v_hoy + h.hora_fin) <= v_ahora + (p_minutos_antes || ' minutes')::interval
    and not exists (
      select 1 from avisos_operativos_enviados a
      where a.horario_id = h.id and a.fecha = v_hoy and a.tipo = 'fin'
    );
end;
$function$
