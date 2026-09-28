CREATE OR REPLACE FUNCTION public._fecha_coincide_horario(p_horario_id uuid, p_fecha date)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from horarios where id = p_horario_id
      and ((fecha_especifica is null and dia_semana = extract(dow from p_fecha)::int)
           or fecha_especifica = p_fecha)
  );
$function$
