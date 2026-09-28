CREATE OR REPLACE FUNCTION public.kpi_embudo_prueba__interno(p_dias integer DEFAULT 90)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with pruebas as (
    select distinct cliente_id, min(fecha) as primera_prueba
    from reservas
    where tipo = 'prueba' and fecha >= ((now() - interval '6 hours')::date) - p_dias
    group by cliente_id
  ),
  convertidas as (
    select p.cliente_id
    from pruebas p
    where exists (
      select 1 from membresias m
      where m.cliente_id = p.cliente_id and m.origen = 'compra'
    )
  )
  select json_build_object(
    'total_pruebas', (select count(*) from pruebas),
    'total_convertidas', (select count(*) from convertidas),
    'pct_conversion', case when (select count(*) from pruebas) > 0
      then round(100.0 * (select count(*) from convertidas) / (select count(*) from pruebas), 1)
      else 0 end
  );
$function$
