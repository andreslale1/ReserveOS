CREATE OR REPLACE FUNCTION public.membresias_por_vencer(p_dias integer DEFAULT 7)
 RETURNS TABLE(cliente_id uuid, nombre text, email text, telefono text, fecha_vencimiento date, paquete_nombre text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return;
  end if;

  return query
  select c.id, c.nombre, c.email, c.telefono, m.fecha_vencimiento, p.nombre
  from membresias m
  join clientes c on c.id = m.cliente_id
  join paquetes p on p.id = m.paquete_id
  where m.estado = 'activa'
    and m.fecha_vencimiento >= ((now() - interval '6 hours')::date)
    and m.fecha_vencimiento <= ((now() - interval '6 hours')::date) + p_dias
  order by m.fecha_vencimiento asc;
end;
$function$
