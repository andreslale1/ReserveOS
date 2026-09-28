CREATE OR REPLACE FUNCTION public.kpi_cuentas_por_pagar()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_resultado json;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol in ('duena', 'contadora')) then
    return null;
  end if;

  with deudas as (
    select descripcion, monto, fecha, ((now() - interval '6 hours')::date) - fecha as dias
    from pasivos
  )
  select json_build_object(
    'total', round(coalesce(sum(monto), 0), 2),
    'bucket_0_30', round(coalesce(sum(monto) filter (where dias <= 30), 0), 2),
    'bucket_31_60', round(coalesce(sum(monto) filter (where dias between 31 and 60), 0), 2),
    'bucket_61_90', round(coalesce(sum(monto) filter (where dias between 61 and 90), 0), 2),
    'bucket_90_mas', round(coalesce(sum(monto) filter (where dias > 90), 0), 2),
    'detalle', coalesce(json_agg(json_build_object('descripcion', descripcion, 'monto', monto, 'dias', dias) order by dias desc), '[]'::json)
  ) into v_resultado
  from deudas;

  return v_resultado;
end;
$function$
