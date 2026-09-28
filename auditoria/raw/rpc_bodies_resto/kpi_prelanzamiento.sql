CREATE OR REPLACE FUNCTION public.kpi_prelanzamiento(p_fecha_apertura date)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cupos_vendidos int;
  v_pruebas_pasadas int;
  v_pruebas_asistidas int;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return null;
  end if;

  select count(*) into v_cupos_vendidos
    from reservas
    where estado = 'confirmada' and fecha >= p_fecha_apertura and fecha < p_fecha_apertura + 7;

  select count(*), count(*) filter (where asistio is true)
    into v_pruebas_pasadas, v_pruebas_asistidas
    from reservas
    where tipo = 'prueba' and estado = 'confirmada' and fecha < (now() - interval '6 hours')::date;

  return json_build_object(
    'cupos_vendidos', v_cupos_vendidos,
    'pruebas_pasadas', v_pruebas_pasadas,
    'tasa_show_up_pct', case when v_pruebas_pasadas > 0 then round(100.0 * v_pruebas_asistidas / v_pruebas_pasadas, 1) else null end
  );
end;
$function$
