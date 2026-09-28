CREATE OR REPLACE FUNCTION public.rechazar_membresia_pendiente(p_membresia_id uuid, p_motivo text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_m record;
  v_canceladas jsonb := '[]'::jsonb;
  v_r record;
begin
  if not exists (select 1 from perfiles where id = auth.uid() and rol in ('duena', 'empleada')) then
    raise exception 'No autorizado';
  end if;

  select id, cliente_id, clases_usadas, created_at, pagada into v_m from membresias where id = p_membresia_id;
  if v_m is null then
    raise exception 'Membresía no encontrada';
  end if;
  if v_m.pagada then
    raise exception 'Esta membresía ya está pagada — anúlala desde Centro de Pagos si hay un error, no la rechaces aquí.';
  end if;

  update membresias set estado = 'rechazada' where id = p_membresia_id;

  for v_r in select * from _cancelar_reservas_de_membresia_rechazada(p_membresia_id, v_m.cliente_id, v_m.clases_usadas, v_m.created_at) loop
    v_canceladas := v_canceladas || jsonb_build_object('reserva_id', v_r.reserva_id, 'fecha', v_r.fecha, 'hora_inicio', v_r.hora_inicio, 'nombre_clase', v_r.nombre_clase);
  end loop;

  return json_build_object('ok', true, 'cliente_id', v_m.cliente_id, 'canceladas', v_canceladas);
end;
$function$
