CREATE OR REPLACE FUNCTION public.kpi_clientas_paquete_activo_mensual__interno(p_meses integer DEFAULT 12)
 RETURNS TABLE(mes date, clientas_real bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    gs.mes_ts::date as mes,
    count(distinct mb.cliente_id) as clientas_real
  from generate_series(
    date_trunc('month', (now() - interval '6 hours')) - ((p_meses - 1) || ' months')::interval,
    date_trunc('month', (now() - interval '6 hours')),
    interval '1 month'
  ) as gs(mes_ts)
  left join membresias mb
    on mb.pagada = true
    and mb.estado not in ('rechazada', 'cancelada', 'anulada')
    and mb.fecha_inicio <= (gs.mes_ts + interval '1 month' - interval '1 day')::date
    and mb.fecha_vencimiento >= gs.mes_ts::date
  group by gs.mes_ts
  order by gs.mes_ts desc;
$function$
