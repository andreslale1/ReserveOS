CREATE OR REPLACE FUNCTION public.kpi_ingreso_bruto_mensual(p_meses integer DEFAULT 12)
 RETURNS TABLE(mes date, ingreso_real numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles where id = auth.uid()) then
    raise exception 'No autorizado';
  end if;
  return query select * from public.kpi_ingreso_bruto_mensual__interno(p_meses);
end;
$function$
