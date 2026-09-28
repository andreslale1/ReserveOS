CREATE OR REPLACE FUNCTION public.pagos_pasarela_pendientes()
 RETURNS TABLE(id uuid, cliente_nombre text, cliente_telefono text, paquete_nombre text, monto numeric, proveedor text, proveedor_transaccion_id text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return;
  end if;

  return query
  select pt.id, c.nombre, c.telefono, p.nombre, pt.monto, pt.proveedor, pt.proveedor_transaccion_id, pt.created_at
  from pago_transacciones pt
  join clientes c on c.id = pt.cliente_id
  join paquetes p on p.id = pt.paquete_id
  where pt.estado = 'iniciado'
  order by pt.created_at desc;
end;
$function$
