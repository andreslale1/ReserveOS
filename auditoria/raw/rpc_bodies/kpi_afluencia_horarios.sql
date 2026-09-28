CREATE OR REPLACE FUNCTION public.kpi_afluencia_horarios()
 RETURNS TABLE(horario_id uuid, nombre_clase text, dia_semana integer, hora_inicio time without time zone, cupo_maximo integer, total_reservas bigint, sesiones bigint, ocupacion_pct numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles where id = auth.uid()) then
    raise exception 'No autorizado';
  end if;
  return query select * from public.kpi_afluencia_horarios__interno();
end;
$function$
