CREATE OR REPLACE FUNCTION public.chequeo_salud__interno()
 RETURNS TABLE(chequeo text, severidad text, cantidad integer, detalle jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
  select 'Reserva con fecha que no corresponde al horario' , 'alta',
    count(*)::int,
    coalesce(jsonb_agg(jsonb_build_object('reserva_id', r.id, 'clienta', c.nombre, 'fecha', r.fecha, 'horario', h.hora_inicio)) filter (where r.id is not null), '[]'::jsonb)
  from reservas r join horarios h on h.id = r.horario_id join clientes c on c.id = r.cliente_id
  where r.estado = 'confirmada'
    and not ((h.fecha_especifica is null and h.dia_semana = extract(dow from r.fecha)::int) or h.fecha_especifica = r.fecha);

  return query
  select 'Reserva confirmada en fecha cancelada o privatizada', 'alta', count(*)::int,
    coalesce(jsonb_agg(jsonb_build_object('reserva_id', r.id, 'clienta', c.nombre, 'fecha', r.fecha)) filter (where r.id is not null), '[]'::jsonb)
  from reservas r join clientes c on c.id = r.cliente_id
  where r.estado = 'confirmada' and r.tipo = 'regular'
    and (exists (select 1 from horario_cancelaciones hc where hc.horario_id = r.horario_id and hc.fecha = r.fecha)
         or exists (select 1 from horario_fechas_privadas hp where hp.horario_id = r.horario_id and hp.fecha = r.fecha));

  return query
  select 'Paquete con más clases usadas que las que tiene', 'alta', count(*)::int,
    coalesce(jsonb_agg(jsonb_build_object('membresia_id', m.id, 'clienta', c.nombre, 'usadas', m.clases_usadas, 'totales', m.clases_totales)) filter (where m.id is not null), '[]'::jsonb)
  from membresias m join clientes c on c.id = m.cliente_id
  where m.clases_totales is not null and m.clases_usadas > m.clases_totales;

  return query
  select 'Membresía paga sin precio guardado (se vería como el precio de lista completo)', 'media', count(*)::int,
    coalesce(jsonb_agg(jsonb_build_object('membresia_id', m.id, 'clienta', c.nombre, 'paquete', pq.nombre)) filter (where m.id is not null), '[]'::jsonb)
  from membresias m join clientes c on c.id = m.cliente_id join paquetes pq on pq.id = m.paquete_id
  where m.pagada = true and m.precio_final is null and m.origen <> 'cortesia';

  return query
  select 'Inventario en negativo', 'alta', count(*)::int,
    coalesce(jsonb_agg(jsonb_build_object('producto', p.nombre, 'variante', v.nombre, 'stock', v.stock)) filter (where v.id is not null), '[]'::jsonb)
  from producto_variantes v join productos p on p.id = v.producto_id
  where v.stock < 0;

  return query
  select 'Número de referencia de transferencia repetido entre paquetes', 'media', count(*)::int,
    coalesce(jsonb_agg(jsonb_build_object('referencia', t.referencia_pago, 'veces', t.n)) filter (where t.referencia_pago is not null), '[]'::jsonb)
  from (
    select referencia_pago, count(*) n from membresias
    where metodo_pago = 'transferencia' and referencia_pago is not null and estado <> 'anulada'
    group by referencia_pago having count(*) > 1
  ) t;

  return query
  select 'Pago pendiente hace más de 7 días sin resolver', 'baja', count(*)::int,
    coalesce(jsonb_agg(jsonb_build_object('membresia_id', m.id, 'clienta', c.nombre, 'desde', m.created_at::date)) filter (where m.id is not null), '[]'::jsonb)
  from membresias m join clientes c on c.id = m.cliente_id
  where m.pagada = false and m.estado in ('activa', 'pendiente_pago') and m.created_at < now() - interval '7 days';

  return query
  select 'Misma clienta con dos reservas confirmadas en el mismo horario y fecha', 'alta', count(*)::int,
    coalesce(jsonb_agg(jsonb_build_object('clienta', c.nombre, 'fecha', x.fecha, 'horario_id', x.horario_id)) filter (where x.horario_id is not null), '[]'::jsonb)
  from (
    select cliente_id, horario_id, fecha from reservas where estado = 'confirmada'
    group by cliente_id, horario_id, fecha having count(*) > 1
  ) x join clientes c on c.id = x.cliente_id;
end;
$function$
