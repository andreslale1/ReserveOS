CREATE OR REPLACE FUNCTION public.gasto_productos_clienta(p_cliente_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(sum(pi.cantidad * pi.precio_unitario), 0)
  from pedido_items pi
  join pedidos pd on pd.id = pi.pedido_id
  where pd.cliente_id = p_cliente_id and pd.estado in ('pagado', 'entregado') and pi.tipo = 'producto';
$function$
