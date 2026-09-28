CREATE OR REPLACE FUNCTION public.clientas_prueba_seguimiento()
 RETURNS TABLE(reserva_id uuid, cliente_id uuid, cliente_nombre text, cliente_telefono text, cliente_email text, resultado text, fecha date, hora_inicio time without time zone, reservo_de_nuevo boolean, nueva_fecha date, nueva_hora time without time zone)
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
    r.id, r.cliente_id, c.nombre, c.telefono, c.email,
    case when r.estado = 'cancelada' then 'Canceló' else 'No asistió' end,
    r.fecha, h.hora_inicio,
    r2n.id is not null,
    r2n.fecha, h2n.hora_inicio
  from reservas r
  join clientes c on c.id = r.cliente_id
  join horarios h on h.id = r.horario_id
  left join lateral (
    select r2.* from reservas r2
    where r2.cliente_id = r.cliente_id and r2.estado = 'confirmada' and r2.id <> r.id
    order by r2.fecha asc, r2.created_at asc
    limit 1
  ) r2n on true
  left join horarios h2n on h2n.id = r2n.horario_id
  where r.tipo = 'prueba'
    and (
      r.estado = 'cancelada'
      or (r.estado = 'confirmada' and r.fecha < v_hoy and coalesce(r.asistio, false) = false)
    )
  order by r.fecha desc, h.hora_inicio;
end;
$function$
