CREATE OR REPLACE FUNCTION public.ventas_producto_recientes()
 RETURNS TABLE(pedido_id uuid, cliente_id uuid, cliente_nombre text, total numeric, metodo_pago text, pagado_at timestamp with time zone, estado text, items text, editable boolean, variante_id uuid, cantidad integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol in ('duena', 'empleada')) then
    return;
  end if;

  return query
  select pd.id, pd.cliente_id, c.nombre, pd.total, pd.metodo_pago, pd.pagado_at, pd.estado,
    string_agg(pi.cantidad || 'x ' || pi.nombre || coalesce(' (' || pi.variante_nombre || ')', ''), ', ' order by pi.nombre),
    count(*) = 1,
    (array_agg(pi.variante_id))[1],
    (array_agg(pi.cantidad))[1]
  from pedidos pd
  join clientes c on c.id = pd.cliente_id
  join pedido_items pi on pi.pedido_id = pd.id
  where pi.tipo = 'producto' and pd.estado in ('pagado', 'entregado')
    and pd.pagado_at > now() - interval '30 days'
  group by pd.id, pd.cliente_id, c.nombre, pd.total, pd.metodo_pago, pd.pagado_at, pd.estado
  order by pd.pagado_at desc
  limit 50;
end;
$function$
