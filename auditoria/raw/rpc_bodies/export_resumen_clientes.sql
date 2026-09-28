CREATE OR REPLACE FUNCTION public.export_resumen_clientes()
 RETURNS TABLE(cliente_id uuid, nombre text, telefono text, email text, genero text, como_se_entero text, fecha_registro timestamp with time zone, dias_como_clienta integer, paquete_actual text, estado_membresia text, vencimiento date, total_pagado numeric, total_reservas bigint, clases_asistidas bigint, pct_asistencia numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return;
  end if;

  return query
  with pagos as (
    select m.cliente_id as cid, sum(coalesce(m.precio_final, 0)) as monto
    from membresias m
    where m.pagada = true
    group by m.cliente_id
  ),
  actividad as (
    select
      r.cliente_id as cid,
      count(*) filter (where r.estado = 'confirmada') as reservas_total,
      count(*) filter (where r.estado = 'confirmada' and r.fecha < ((now() - interval '6 hours')::date)) as reservas_pasadas,
      count(*) filter (where r.estado = 'confirmada' and r.fecha < ((now() - interval '6 hours')::date) and r.asistio is true) as reservas_asistidas
    from reservas r
    group by r.cliente_id
  ),
  membresia_actual as (
    select distinct on (m.cliente_id)
      m.cliente_id as cid,
      p.nombre as paquete_nombre,
      m.estado as membresia_estado,
      m.fecha_vencimiento as membresia_vencimiento
    from membresias m
    join paquetes p on p.id = m.paquete_id
    order by m.cliente_id, m.created_at desc
  )
  select
    c.id,
    c.nombre,
    c.telefono,
    c.email,
    c.genero,
    c.como_se_entero,
    c.created_at,
    (((now() - interval '6 hours')::date) - c.created_at::date)::int,
    ma.paquete_nombre,
    ma.membresia_estado,
    ma.membresia_vencimiento,
    coalesce(pg.monto, 0),
    coalesce(ac.reservas_total, 0),
    coalesce(ac.reservas_asistidas, 0),
    case when coalesce(ac.reservas_pasadas, 0) = 0 then null
      else round(100.0 * ac.reservas_asistidas / ac.reservas_pasadas, 1)
    end
  from clientes c
  left join membresia_actual ma on ma.cid = c.id
  left join pagos pg on pg.cid = c.id
  left join actividad ac on ac.cid = c.id
  order by c.created_at desc;
end;
$function$
