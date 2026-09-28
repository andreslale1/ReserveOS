CREATE OR REPLACE FUNCTION public.clientas_riesgo_fuga(p_dias integer DEFAULT 14)
 RETURNS TABLE(cliente_id uuid, nombre text, email text, telefono text, ultima_clase date, dias_sin_reservar integer, tiene_membresia_activa boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return;
  end if;

  return query
  with ultima as (
    select r.cliente_id, max(r.fecha) as ultima_clase
    from reservas r
    where r.estado = 'confirmada' and r.tipo = 'regular' and r.fecha < ((now() - interval '6 hours')::date)
    group by r.cliente_id
  )
  select
    c.id,
    c.nombre,
    c.email,
    c.telefono,
    u.ultima_clase,
    (((now() - interval '6 hours')::date) - u.ultima_clase)::int,
    exists (
      select 1 from membresias m
      where m.cliente_id = c.id and m.estado = 'activa' and m.congelada_desde is null
        and m.fecha_vencimiento >= ((now() - interval '6 hours')::date)
        and (m.clases_totales is null or m.clases_usadas < m.clases_totales)
    )
  from ultima u
  join clientes c on c.id = u.cliente_id
  where u.ultima_clase < ((now() - interval '6 hours')::date) - p_dias
    and not exists (
      select 1 from reservas r2
      where r2.cliente_id = c.id and r2.estado = 'confirmada' and r2.fecha >= ((now() - interval '6 hours')::date)
    )
  order by u.ultima_clase asc;
end;
$function$
