CREATE OR REPLACE FUNCTION public.liberar_cupos_no_confirmados()
 RETURNS TABLE(reserva_id uuid, nombre text, email text, user_id uuid, nombre_clase text, hora_inicio time without time zone, fecha date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_horas_confirmacion int;
  v_ahora timestamp := (now() - interval '6 hours')::timestamp;
  v_reg record;
begin
  if v_ahora <= '2026-09-30 23:59:59'::timestamp then
    return;
  end if;

  select horas_minimas_confirmacion into v_horas_confirmacion from configuracion_reservas where id = true;
  v_horas_confirmacion := coalesce(v_horas_confirmacion, 1);

  for v_reg in
    select
      r.id as reserva_id, r.cliente_id, r.horario_id, r.fecha,
      h.hora_inicio, h.cupo_maximo, h.nombre_clase,
      c.nombre as cliente_nombre, c.email as cliente_email, c.user_id as cliente_user_id
    from reservas r
    join horarios h on h.id = r.horario_id
    join clientes c on c.id = r.cliente_id
    where r.estado = 'confirmada'
      and r.tipo = 'regular'
      and r.confirmada_por_clienta_at is null
      and (r.fecha + h.hora_inicio) > v_ahora
      and (r.fecha + h.hora_inicio) <= v_ahora + (v_horas_confirmacion || ' hours')::interval
      and (
        select count(*) from reservas r2
        where r2.horario_id = r.horario_id and r2.fecha = r.fecha and r2.estado = 'confirmada'
      ) >= h.cupo_maximo
  loop
    update reservas set estado = 'cancelada', liberada_por_no_confirmar = true, penalizada = true
      where id = v_reg.reserva_id;

    reserva_id := v_reg.reserva_id;
    nombre := v_reg.cliente_nombre;
    email := v_reg.cliente_email;
    user_id := v_reg.cliente_user_id;
    nombre_clase := v_reg.nombre_clase;
    hora_inicio := v_reg.hora_inicio;
    fecha := v_reg.fecha;
    return next;
  end loop;
end;
$function$
