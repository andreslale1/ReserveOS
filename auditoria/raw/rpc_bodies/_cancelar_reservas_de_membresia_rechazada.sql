CREATE OR REPLACE FUNCTION public._cancelar_reservas_de_membresia_rechazada(p_membresia_id uuid, p_cliente_id uuid, p_clases_usadas integer, p_membresia_created_at timestamp with time zone)
 RETURNS TABLE(reserva_id uuid, fecha date, hora_inicio time without time zone, nombre_clase text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_reserva record;
begin
  if p_clases_usadas <= 0 then
    return;
  end if;

  -- El UPDATE de cada reserva dispara promover_lista_espera() sola (ya
  -- respeta fechas canceladas/privatizadas y clases que ya empezaron,
  -- arreglado hoy) — no hace falta tocar lista_espera aquí.
  for v_reserva in
    select r.id, r.fecha, h.hora_inicio, h.nombre_clase
      from reservas r join horarios h on h.id = r.horario_id
      where r.cliente_id = p_cliente_id
        and r.tipo = 'regular'
        and r.estado = 'confirmada'
        and r.created_at >= p_membresia_created_at
      order by r.created_at desc
      limit p_clases_usadas
  loop
    update reservas set estado = 'cancelada' where id = v_reserva.id;
    reserva_id := v_reserva.id;
    fecha := v_reserva.fecha;
    hora_inicio := v_reserva.hora_inicio;
    nombre_clase := v_reserva.nombre_clase;
    return next;
  end loop;
end;
$function$
