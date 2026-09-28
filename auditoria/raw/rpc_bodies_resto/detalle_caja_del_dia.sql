CREATE OR REPLACE FUNCTION public.detalle_caja_del_dia(p_fecha date)
 RETURNS TABLE(origen text, cliente_nombre text, concepto text, monto numeric, metodo_pago text, hora time without time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles where id = auth.uid() and rol in ('duena', 'empleada')) then
    raise exception 'No autorizado';
  end if;

  return query
  select 'Cobro personalizado', c.nombre, cp.concepto, cp.monto, cp.metodo_pago, (cp.confirmado_at - interval '6 hours')::time
    from cobros_personalizados cp join clientes c on c.id = cp.cliente_id
    where cp.metodo_pago <> 'pasarela' and (cp.confirmado_at - interval '6 hours')::date = p_fecha

  union all
  select 'Tienda', coalesce(c.nombre, 'Venta al público'), pd.total::text, pd.total, pd.metodo_pago, (pd.pagado_at - interval '6 hours')::time
    from pedidos pd left join clientes c on c.id = pd.cliente_id
    where pd.estado in ('pagado', 'entregado') and pd.metodo_pago <> 'pasarela' and (pd.pagado_at - interval '6 hours')::date = p_fecha

  union all
  select 'Paquete', c.nombre, pq.nombre, coalesce(m.precio_final, pq.precio), m.metodo_pago, (m.confirmado_at - interval '6 hours')::time
    from membresias m join clientes c on c.id = m.cliente_id join paquetes pq on pq.id = m.paquete_id
    where m.estado = 'activa' and m.pagada = true and m.confirmado_at is not null and m.metodo_pago <> 'pasarela'
      and (m.confirmado_at - interval '6 hours')::date = p_fecha

  union all
  select 'Fecha privatizada', c.nombre, 'Privatización', hfp.precio, hfp.metodo_pago, (hfp.confirmado_at - interval '6 hours')::time
    from horario_fechas_privadas_personas hfp join clientes c on c.id = hfp.cliente_id
    where hfp.pagada = true and hfp.confirmado_at is not null and hfp.metodo_pago <> 'pasarela'
      and (hfp.confirmado_at - interval '6 hours')::date = p_fecha

  order by 1, 6;
end;
$function$
