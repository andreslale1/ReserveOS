CREATE OR REPLACE FUNCTION public.ranking_clientas_valor(p_limite integer DEFAULT 50)
 RETURNS TABLE(cliente_id uuid, nombre text, telefono text, email text, total_gastado numeric, primera_compra date, ultima_compra date, transacciones integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return;
  end if;

  return query
  with membresias_cli as (
    select m.cliente_id, coalesce(m.precio_final, pq.precio, 0) as monto, m.confirmado_at::date as fecha
    from membresias m
    join paquetes pq on pq.id = m.paquete_id
    where m.estado in ('activa', 'vencida') and m.pagada = true and m.confirmado_at is not null
  ),
  privadas_cli as (
    select cliente_id, precio as monto, confirmado_at::date as fecha
    from horario_fechas_privadas_personas
    where pagada = true and confirmado_at is not null
  ),
  pedidos_cli as (
    select cliente_id, total as monto, pagado_at::date as fecha
    from pedidos
    where estado in ('pagado', 'entregado') and pagado_at is not null and cliente_id is not null
  ),
  todo as (
    select * from membresias_cli
    union all select * from privadas_cli
    union all select * from pedidos_cli
  )
  select c.id, c.nombre, c.telefono, c.email,
    sum(t.monto) as total_gastado,
    min(t.fecha) as primera_compra,
    max(t.fecha) as ultima_compra,
    count(*)::int as transacciones
  from todo t
  join clientes c on c.id = t.cliente_id
  group by c.id, c.nombre, c.telefono, c.email
  order by total_gastado desc
  limit p_limite;
end;
$function$
