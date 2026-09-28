CREATE OR REPLACE FUNCTION public.kpi_resumen_clientas()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_total int;
  v_recurrentes int;
  v_referidas int;
  v_antiguedad_prom numeric;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return null;
  end if;

  select count(*) into v_total from clientes where user_id is not null;

  select count(*) into v_recurrentes from (
    select cliente_id from membresias group by cliente_id having count(*) >= 2
  ) x;

  select count(*) into v_referidas from clientes where user_id is not null and referido_por is not null;

  select avg(extract(epoch from (now() - created_at)) / 86400.0) into v_antiguedad_prom
    from clientes where user_id is not null;

  return json_build_object(
    'total', v_total,
    'recurrentes', v_recurrentes,
    'nuevas', v_total - v_recurrentes,
    'tasa_referidos_pct', case when v_total > 0 then round(100.0 * v_referidas / v_total, 1) else null end,
    'antiguedad_promedio_dias', round(coalesce(v_antiguedad_prom, 0))
  );
end;
$function$
