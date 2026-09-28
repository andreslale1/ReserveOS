CREATE OR REPLACE FUNCTION public.carritos_abandonados()
 RETURNS TABLE(carrito_id uuid, cliente_id uuid, cliente_nombre text, cliente_telefono text, actualizado_at timestamp with time zone, items text, total numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return;
  end if;

  return query
  select ct.id, cl.id, cl.nombre, cl.telefono, ct.actualizado_at,
    string_agg(
      case when ci.tipo = 'producto' then ci.cantidad || 'x ' || pr.nombre || coalesce(' (' || v.nombre || ')', '')
           else pq.nombre end,
      ', '
    ),
    sum(case when ci.tipo = 'producto' then pr.precio * ci.cantidad else pq.precio end)
  from carritos ct
  join clientes cl on cl.id = ct.cliente_id
  join carrito_items ci on ci.carrito_id = ct.id
  left join productos pr on pr.id = ci.producto_id
  left join producto_variantes v on v.id = ci.variante_id
  left join paquetes pq on pq.id = ci.paquete_id
  where ct.estado = 'activo' and ct.actualizado_at < now() - interval '2 hours'
  group by ct.id, cl.id, cl.nombre, cl.telefono, ct.actualizado_at
  order by ct.actualizado_at desc;
end;
$function$
