CREATE OR REPLACE FUNCTION public.cobros_pendientes_hace_tiempo()
 RETURNS TABLE(cliente_id uuid, nombre text, telefono text, paquete_nombre text, pedida_el timestamp with time zone, horas_esperando numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return;
  end if;

  return query
  select c.id, c.nombre, c.telefono, p.nombre,
    m.created_at,
    round(extract(epoch from (now() - m.created_at)) / 3600.0, 1)
  from membresias m
  join clientes c on c.id = m.cliente_id
  join paquetes p on p.id = m.paquete_id
  where m.pagada = false and m.estado = 'activa'
  order by m.created_at asc;
end;
$function$
