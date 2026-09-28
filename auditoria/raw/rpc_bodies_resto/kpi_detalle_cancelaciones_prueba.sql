CREATE OR REPLACE FUNCTION public.kpi_detalle_cancelaciones_prueba(p_dias integer DEFAULT 30)
 RETURNS TABLE(reserva_id uuid, cliente_id uuid, cliente_nombre text, cliente_telefono text, cliente_email text, fecha date, hora_inicio time without time zone, reservo_de_nuevo boolean, nueva_fecha date, nueva_hora time without time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles where id = auth.uid()) then
    raise exception 'No autorizado';
  end if;
  return query select * from public.kpi_detalle_cancelaciones_prueba__interno(p_dias);
end;
$function$
