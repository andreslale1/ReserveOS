CREATE OR REPLACE FUNCTION public.cobros_de_hoy()
 RETURNS TABLE(tipo text, cliente_id uuid, nombre text, telefono text, concepto text, monto numeric, hora_clase time without time zone, membresia_id uuid, membresia_estado text, horario_id uuid, fecha_privada date, metodo_pago text, comprobante_url text, referencia_pago text)
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
  select
    'paquete'::text,
    c.id,
    c.nombre,
    c.telefono,
    p.nombre,
    coalesce(m.precio_final, p.precio),
    (
      select min(h.hora_inicio) from reservas r
      join horarios h on h.id = r.horario_id
      where r.cliente_id = c.id and r.fecha = v_hoy and r.estado = 'confirmada'
    ),
    m.id,
    m.estado,
    null::uuid,
    null::date,
    m.metodo_pago,
    m.comprobante_url,
    m.referencia_pago
  from membresias m
  join clientes c on c.id = m.cliente_id
  join paquetes p on p.id = m.paquete_id
  where m.pagada = false and m.estado in ('activa', 'pendiente_pago')

  union all

  select
    'privada'::text,
    c.id,
    c.nombre,
    c.telefono,
    'Sesión privada — ' || h.nombre_clase,
    hp.precio,
    case when hfp.fecha = v_hoy then h.hora_inicio else null end,
    null::uuid,
    null::text,
    hfp.horario_id,
    hfp.fecha,
    hp.metodo_pago,
    null::text,
    hp.referencia_pago
  from horario_fechas_privadas_personas hp
  join clientes c on c.id = hp.cliente_id
  join horario_fechas_privadas hfp on hfp.id = hp.privatizacion_id
  join horarios h on h.id = hfp.horario_id
  where hp.pagada = false

  -- Por posición (7=hora_clase, 3=nombre), no por nombre de columna: el
  -- nombre de retorno de la función ("nombre") choca con el alias de la
  -- consulta y Postgres no sabe a cuál de los dos te refieres.
  order by 7 asc nulls last, 3 asc;
end;
$function$
