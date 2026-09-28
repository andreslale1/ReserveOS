CREATE OR REPLACE FUNCTION public.ventas_por_hora_del_dia()
 RETURNS TABLE(hora integer, cantidad integer, monto numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return;
  end if;

  return query
  with horas as (
    select generate_series(0, 23) as hora
  ),
  ventas as (
    select extract(hour from (m.confirmado_at - interval '6 hours'))::int as hora,
      coalesce(m.precio_final, pq.precio, 0) as monto
    from membresias m
    join paquetes pq on pq.id = m.paquete_id
    where m.pagada = true and m.confirmado_at is not null and m.origen = 'compra'
  )
  select h.hora, count(v.hora)::int, coalesce(sum(v.monto), 0)
  from horas h
  left join ventas v on v.hora = h.hora
  group by h.hora
  order by h.hora;
end;
$function$
