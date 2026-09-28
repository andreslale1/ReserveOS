CREATE OR REPLACE FUNCTION public.kpi_clientas_paquete_activo_mensual(p_meses integer DEFAULT 12)
 RETURNS TABLE(mes date, clientas_real bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles where id = auth.uid()) then
    raise exception 'No autorizado';
  end if;
  return query select * from public.kpi_clientas_paquete_activo_mensual__interno(p_meses);
end;
$function$
