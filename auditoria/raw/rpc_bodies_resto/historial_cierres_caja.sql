CREATE OR REPLACE FUNCTION public.historial_cierres_caja(p_limite integer DEFAULT 60)
 RETURNS TABLE(fecha date, efectivo_sistema numeric, efectivo_contado numeric, tarjeta_sistema numeric, tarjeta_contado numeric, transferencia_sistema numeric, transferencia_contado numeric, notas text, cerrado_por_nombre text, cerrado_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    cc.fecha,
    cc.efectivo_sistema, cc.efectivo_contado,
    cc.tarjeta_sistema, cc.tarjeta_contado,
    cc.transferencia_sistema, cc.transferencia_contado,
    cc.notas,
    p.nombre,
    cc.cerrado_at
  from cierre_caja cc
  left join perfiles p on p.id = cc.cerrado_por
  where exists (select 1 from perfiles pd where pd.id = auth.uid() and pd.rol = 'duena')
  order by cc.fecha desc
  limit p_limite;
$function$
