CREATE OR REPLACE FUNCTION public.asignar_clase_privada_manual(p_cliente_id uuid, p_paquete_id uuid, p_horario_id uuid, p_fecha date, p_metodo_pago text DEFAULT 'efectivo'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_paquete record;
  v_cupo int;
  v_categoria_horario text;
  v_ocupadas int;
  v_membresia_id uuid;
  v_reserva_id uuid;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol in ('duena', 'empleada')) then
    raise exception 'No autorizado';
  end if;

  if p_metodo_pago not in ('transferencia', 'tarjeta_estudio', 'efectivo', 'pasarela') then
    raise exception 'Método de pago no válido';
  end if;

  select num_clases, vigencia_dias, precio into v_paquete
    from paquetes where id = p_paquete_id and activo = true and categoria = 'privado';
  if v_paquete is null then
    raise exception 'Paquete no válido';
  end if;

  if not exists (select 1 from clientes where id = p_cliente_id) then
    raise exception 'Clienta no encontrada';
  end if;

  select cupo_maximo, categoria into v_cupo, v_categoria_horario
    from horarios where id = p_horario_id and activo = true;
  if v_cupo is null or v_categoria_horario <> 'privado' then
    raise exception 'Horario no válido';
  end if;

  select count(*) into v_ocupadas from reservas
    where horario_id = p_horario_id and fecha = p_fecha and estado = 'confirmada';
  if v_ocupadas >= v_cupo then
    raise exception 'Ese horario ya tiene una reserva — elige otra fecha.';
  end if;

  insert into membresias
    (cliente_id, paquete_id, metodo_pago, precio_final, estado, clases_totales, clases_usadas,
     fecha_inicio, fecha_vencimiento, pagada, origen, confirmado_at, confirmado_por)
    values
    (p_cliente_id, p_paquete_id, p_metodo_pago, v_paquete.precio, 'activa', v_paquete.num_clases, 1,
     ((now() - interval '6 hours')::date), ((now() - interval '6 hours')::date) + v_paquete.vigencia_dias, true, 'compra', now(), auth.uid())
    returning id into v_membresia_id;

  insert into reservas (horario_id, cliente_id, fecha, tipo, estado)
    values (p_horario_id, p_cliente_id, p_fecha, 'privado', 'confirmada')
    returning id into v_reserva_id;

  return json_build_object('ok', true, 'membresia_id', v_membresia_id, 'reserva_id', v_reserva_id);
end;
$function$
