CREATE OR REPLACE FUNCTION public.kpi_tiempo_confirmacion_cobro()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_avg numeric;
  v_max numeric;
  v_evaluadas int;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return null;
  end if;

  select avg(extract(epoch from (confirmado_at - created_at)) / 3600.0),
         max(extract(epoch from (confirmado_at - created_at)) / 3600.0),
         count(*)
    into v_avg, v_max, v_evaluadas
  from membresias
  where pagada = true and confirmado_at is not null and origen = 'compra';

  return json_build_object(
    'horas_promedio', round(coalesce(v_avg, 0), 1),
    'horas_maximo', round(coalesce(v_max, 0), 1),
    'cobros_evaluados', v_evaluadas
  );
end;
$function$
