CREATE OR REPLACE FUNCTION public.rotacion_productos()
 RETURNS TABLE(producto_nombre text, variante_nombre text, unidades_vendidas bigint, ingresos numeric, stock_actual integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return;
  end if;

  return query
  select p.nombre, v.nombre, coalesce(sum(pi.cantidad), 0), coalesce(sum(pi.cantidad * pi.precio_unitario), 0), v.stock
  from producto_variantes v
  join productos p on p.id = v.producto_id
  left join pedido_items pi on pi.variante_id = v.id
    and pi.pedido_id in (select id from pedidos where estado in ('pagado', 'entregado'))
  group by p.id, p.nombre, p.orden, v.id, v.nombre, v.orden, v.stock
  order by p.orden, p.nombre, v.orden;
end;
$function$
