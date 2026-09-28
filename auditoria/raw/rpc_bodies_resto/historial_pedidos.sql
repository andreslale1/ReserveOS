CREATE OR REPLACE FUNCTION public.historial_pedidos()
 RETURNS TABLE(pedido_id uuid, cliente_nombre text, total numeric, metodo_pago text, pagado_at timestamp with time zone, entregado_at timestamp with time zone, items text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return;
  end if;

  return query
  select pd.id, c.nombre, pd.total, pd.metodo_pago, pd.pagado_at, pd.entregado_at,
    string_agg(pi.cantidad || 'x ' || pi.nombre || coalesce(' (' || pi.variante_nombre || ')', ''), ', ' order by pi.nombre)
  from pedidos pd
  join clientes c on c.id = pd.cliente_id
  join pedido_items pi on pi.pedido_id = pd.id
  where pd.estado in ('pagado', 'entregado')
  group by pd.id, c.nombre, pd.total, pd.metodo_pago, pd.pagado_at, pd.entregado_at
  order by pd.pagado_at desc
  limit 200;
end;
$function$
