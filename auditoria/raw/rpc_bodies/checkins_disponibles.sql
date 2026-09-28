CREATE OR REPLACE FUNCTION public.checkins_disponibles()
 RETURNS TABLE(cliente_id uuid, nombre text, es_propia boolean, nombre_clase text, hora_inicio time without time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_propio_id uuid;
  v_ahora time;
  v_hoy date;
begin
  v_ahora := (now() - interval '6 hours')::time;
  v_hoy := (now() - interval '6 hours')::date;

  select id into v_propio_id from clientes where user_id = auth.uid();
  if v_propio_id is null then
    return;
  end if;

  return query
  select c.id, c.nombre, (c.id = v_propio_id), h.nombre_clase, h.hora_inicio
  from reservas r
  join horarios h on h.id = r.horario_id
  join clientes c on c.id = r.cliente_id
  where (c.id = v_propio_id or c.tutor_id = v_propio_id)
    and r.fecha = v_hoy
    and r.estado = 'confirmada'
    and r.asistio is null
    and h.hora_inicio between (v_ahora - interval '15 minutes') and (v_ahora + interval '20 minutes')
  order by h.hora_inicio;
end;
$function$
