CREATE OR REPLACE FUNCTION public.clientas_vencidas_sin_renovar()
 RETURNS TABLE(cliente_id uuid, nombre text, telefono text, email text, paquete_nombre text, fecha_vencimiento date, dias_vencida integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_hoy date := (now() - interval '6 hours')::date;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return;
  end if;

  return query
  with ultima as (
    select distinct on (m.cliente_id) m.cliente_id, m.fecha_vencimiento, p.nombre as paquete_nombre
    from membresias m
    join paquetes p on p.id = m.paquete_id
    where m.pagada = true and m.estado in ('activa', 'vencida') and m.fecha_vencimiento is not null
    order by m.cliente_id, m.fecha_vencimiento desc
  )
  select c.id, c.nombre, c.telefono, c.email, u.paquete_nombre, u.fecha_vencimiento, (v_hoy - u.fecha_vencimiento)::int
  from ultima u
  join clientes c on c.id = u.cliente_id
  where u.fecha_vencimiento < v_hoy
  order by u.fecha_vencimiento asc;
end;
$function$
