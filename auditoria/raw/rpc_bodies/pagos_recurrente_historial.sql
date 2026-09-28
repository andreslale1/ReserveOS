CREATE OR REPLACE FUNCTION public.pagos_recurrente_historial(p_desde date DEFAULT NULL::date, p_hasta date DEFAULT NULL::date)
 RETURNS TABLE(transaccion_id uuid, fecha timestamp with time zone, cliente_nombre text, tipo text, descripcion text, monto numeric, comision_estimada numeric, neto_estimado numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol in ('duena', 'contadora')) then
    return;
  end if;

  return query
  select
    tx.id, tx.actualizado_at, c.nombre, tx.tipo,
    case
      when tx.tipo = 'paquete' then pq.nombre
      else coalesce((
        select string_agg(pi.cantidad || 'x ' || pi.nombre || coalesce(' (' || pi.variante_nombre || ')', ''), ', ')
        from pedido_items pi where pi.pedido_id = tx.pedido_id
      ), 'Pedido de tienda')
    end,
    tx.monto,
    round(tx.monto * 0.045 + 2, 2),
    round(tx.monto - (tx.monto * 0.045 + 2), 2)
  from pago_transacciones tx
  join clientes c on c.id = tx.cliente_id
  left join paquetes pq on pq.id = tx.paquete_id
  where tx.proveedor = 'recurrente' and tx.estado = 'exitoso'
    and (p_desde is null or tx.actualizado_at::date >= p_desde)
    and (p_hasta is null or tx.actualizado_at::date <= p_hasta)
  order by tx.actualizado_at desc;
end;
$function$
