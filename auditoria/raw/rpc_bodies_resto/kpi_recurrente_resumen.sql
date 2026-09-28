CREATE OR REPLACE FUNCTION public.kpi_recurrente_resumen(p_desde date DEFAULT NULL::date, p_hasta date DEFAULT NULL::date)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_total_bruto numeric := 0;
  v_total_comision numeric := 0;
  v_cantidad int := 0;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol in ('duena', 'contadora')) then
    return null;
  end if;

  select coalesce(sum(monto), 0), coalesce(sum(monto * 0.045 + 2), 0), count(*)
    into v_total_bruto, v_total_comision, v_cantidad
    from pago_transacciones tx
    where tx.proveedor = 'recurrente' and tx.estado = 'exitoso'
      and (p_desde is null or tx.actualizado_at::date >= p_desde)
      and (p_hasta is null or tx.actualizado_at::date <= p_hasta);

  return json_build_object(
    'total_bruto', round(v_total_bruto, 2),
    'total_comision_estimada', round(v_total_comision, 2),
    'total_neto_estimado', round(v_total_bruto - v_total_comision, 2),
    'cantidad_transacciones', v_cantidad
  );
end;
$function$
