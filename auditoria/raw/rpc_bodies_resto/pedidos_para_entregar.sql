CREATE OR REPLACE FUNCTION public.pedidos_para_entregar()
 RETURNS TABLE(pedido_id uuid, cliente_nombre text, cliente_telefono text, total numeric, pagado_at timestamp with time zone, items text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return;
  end if;

  return query
  select pd.id, c.nombre, c.telefono, pd.total, pd.pagado_at,
    string_agg(pi.cantidad || 'x ' || pi.nombre || coalesce(' (' || pi.variante_nombre || ')', ''), ', ' order by pi.nombre)
  from pedidos pd
  join clientes c on c.id = pd.cliente_id
  join pedido_items pi on pi.pedido_id = pd.id
  where pd.estado = 'pagado'
  group by pd.id, c.nombre, c.telefono, pd.total, pd.pagado_at
  order by pd.pagado_at asc;
end;
$function$
