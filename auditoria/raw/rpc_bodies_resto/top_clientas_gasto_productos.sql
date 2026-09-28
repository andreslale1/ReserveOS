CREATE OR REPLACE FUNCTION public.top_clientas_gasto_productos()
 RETURNS TABLE(cliente_nombre text, pedidos bigint, gasto numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return;
  end if;

  return query
  select c.nombre, count(distinct pd.id), sum(pi.cantidad * pi.precio_unitario)
  from pedido_items pi
  join pedidos pd on pd.id = pi.pedido_id
  join clientes c on c.id = pd.cliente_id
  where pd.estado in ('pagado', 'entregado') and pi.tipo = 'producto'
  group by c.id, c.nombre
  order by sum(pi.cantidad * pi.precio_unitario) desc
  limit 20;
end;
$function$
