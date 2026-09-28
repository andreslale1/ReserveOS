CREATE OR REPLACE FUNCTION public.kpi_retencion()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_hoy date := (now() - interval '6 hours')::date;
  v_vencidas_ventana int;
  v_no_renovaron int;
  v_en_riesgo int;
  v_recurrentes int;
  v_total int;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return null;
  end if;

  select count(*) into v_vencidas_ventana
    from membresias m
    where m.estado in ('activa','vencida') and m.fecha_vencimiento between v_hoy - 60 and v_hoy - 30;

  select count(*) into v_no_renovaron
    from membresias m
    where m.estado in ('activa','vencida') and m.fecha_vencimiento between v_hoy - 60 and v_hoy - 30
      and not exists (
        select 1 from membresias m2
        where m2.cliente_id = m.cliente_id and m2.created_at::date > m.fecha_vencimiento
      );

  select count(distinct m.cliente_id) into v_en_riesgo
    from membresias m
    where m.estado = 'activa' and m.fecha_vencimiento >= v_hoy
      and not exists (
        select 1 from reservas r
        where r.cliente_id = m.cliente_id and r.estado = 'confirmada'
          and r.fecha between v_hoy - 14 and v_hoy + 7
      );

  select count(*) into v_total from clientes where user_id is not null;
  select count(*) into v_recurrentes from (
    select cliente_id from membresias group by cliente_id having count(*) >= 2
  ) x;

  return json_build_object(
    'churn_pct', case when v_vencidas_ventana > 0 then round(100.0 * v_no_renovaron / v_vencidas_ventana, 1) else null end,
    'membresias_evaluadas', v_vencidas_ventana,
    'en_riesgo', v_en_riesgo,
    'retencion_acumulada_pct', case when v_total > 0 then round(100.0 * v_recurrentes / v_total, 1) else null end
  );
end;
$function$
