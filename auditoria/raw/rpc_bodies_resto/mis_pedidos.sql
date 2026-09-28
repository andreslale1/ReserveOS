CREATE OR REPLACE FUNCTION public.mis_pedidos()
 RETURNS TABLE(pedido_id uuid, estado text, metodo_pago text, total numeric, created_at timestamp with time zone, pagado_at timestamp with time zone, entregado_at timestamp with time zone, items text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cliente_id uuid;
begin
  select id into v_cliente_id from clientes where user_id = auth.uid();
  if v_cliente_id is null then
    return;
  end if;

  return query
  select pd.id, pd.estado, pd.metodo_pago, pd.total, pd.created_at, pd.pagado_at, pd.entregado_at,
    string_agg(pi.cantidad || 'x ' || pi.nombre || coalesce(' (' || pi.variante_nombre || ')', ''), ', ' order by pi.nombre)
  from pedidos pd
  join pedido_items pi on pi.pedido_id = pd.id
  where pd.cliente_id = v_cliente_id
  group by pd.id, pd.estado, pd.metodo_pago, pd.total, pd.created_at, pd.pagado_at, pd.entregado_at
  order by pd.created_at desc;
end;
$function$
