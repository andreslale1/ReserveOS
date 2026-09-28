CREATE OR REPLACE FUNCTION public.caja_esperado_del_dia__interno(p_fecha date)
 RETURNS TABLE(metodo_pago text, monto numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with membresias_dia as (
    select m.metodo_pago, coalesce(m.precio_final, pq.precio, 0) as monto
    from membresias m
    join paquetes pq on pq.id = m.paquete_id
    where m.estado = 'activa' and m.pagada = true and m.confirmado_at is not null
      and m.metodo_pago <> 'pasarela'
      and (m.confirmado_at - interval '6 hours')::date = p_fecha
  ),
  privatizaciones_dia as (
    select metodo_pago, precio as monto
    from horario_fechas_privadas_personas
    where pagada = true and confirmado_at is not null
      and metodo_pago <> 'pasarela'
      and (confirmado_at - interval '6 hours')::date = p_fecha
  ),
  pedidos_dia as (
    select metodo_pago, total as monto
    from pedidos
    where estado in ('pagado', 'entregado') and pagado_at is not null
      and metodo_pago <> 'pasarela'
      and (pagado_at - interval '6 hours')::date = p_fecha
  ),
  cobros_personalizados_dia as (
    select metodo_pago, monto
    from cobros_personalizados
    where confirmado_at is not null
      and metodo_pago <> 'pasarela'
      and (confirmado_at - interval '6 hours')::date = p_fecha
  ),
  todo as (
    select * from membresias_dia
    union all select * from privatizaciones_dia
    union all select * from pedidos_dia
    union all select * from cobros_personalizados_dia
  )
  select metodo_pago, sum(monto) as monto
  from todo
  group by metodo_pago;
$function$
