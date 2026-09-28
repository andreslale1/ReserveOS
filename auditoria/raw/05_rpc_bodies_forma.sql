-- ===== _cancelar_reservas_de_membresia_rechazada =====
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


-- ===== _decrementar_uso_codigo_al_borrar_membresia =====
CREATE OR REPLACE FUNCTION public._decrementar_uso_codigo_al_borrar_membresia()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if OLD.codigo_descuento_id is not null then
    update codigos_descuento set usos_actuales = greatest(usos_actuales - 1, 0) where id = OLD.codigo_descuento_id;
  end if;
  return OLD;
end;
$function$


-- ===== _fecha_coincide_horario =====
CREATE OR REPLACE FUNCTION public._fecha_coincide_horario(p_horario_id uuid, p_fecha date)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from horarios where id = p_horario_id
      and ((fecha_especifica is null and dia_semana = extract(dow from p_fecha)::int)
           or fecha_especifica = p_fecha)
  );
$function$


-- ===== admin_agregar_reserva =====
CREATE OR REPLACE FUNCTION public.admin_agregar_reserva(p_cliente_id uuid, p_horario_id uuid, p_fecha date, p_tipo text DEFAULT 'regular'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cupo int;
  v_ocupadas int;
  v_reserva_id uuid;
  v_estado_actual text;
  v_membresia_id uuid;
  v_clases_totales int;
  v_tutor_familia_id uuid;
begin
  if not exists (select 1 from perfiles where id = auth.uid() and rol = 'duena') then
    raise exception 'Solo la dueña puede asignar reservas';
  end if;
  if p_tipo not in ('regular', 'prueba') then
    raise exception 'Tipo de reserva inválido';
  end if;
  select cupo_maximo into v_cupo from horarios where id = p_horario_id;
  if v_cupo is null then raise exception 'Horario no válido'; end if;

  -- La fecha tiene que corresponder al horario: mismo día de la semana
  -- (o la fecha exacta si es clase puntual), y no cancelada/privatizada.
  if not exists (
    select 1 from horarios where id = p_horario_id
      and ((fecha_especifica is null and dia_semana = extract(dow from p_fecha)::int)
           or fecha_especifica = p_fecha)
  ) then
    raise exception 'Esa fecha no corresponde a ese horario — revisa que el día de la semana de la fecha coincida con el de la clase.';
  end if;
  if exists (select 1 from horario_cancelaciones where horario_id = p_horario_id and fecha = p_fecha) then
    raise exception 'Esa fecha está cancelada para ese horario.';
  end if;
  if exists (select 1 from horario_fechas_privadas where horario_id = p_horario_id and fecha = p_fecha) then
    raise exception 'Esa fecha está privatizada — agrégala desde Horarios, no desde aquí.';
  end if;
  select id, estado into v_reserva_id, v_estado_actual from reservas
    where cliente_id = p_cliente_id and horario_id = p_horario_id and fecha = p_fecha;
  if v_reserva_id is not null and v_estado_actual = 'confirmada' then
    raise exception 'Esta clienta ya tiene una reserva confirmada en esa clase';
  end if;
  select count(*) into v_ocupadas from reservas
    where horario_id = p_horario_id and fecha = p_fecha and estado = 'confirmada';
  if v_ocupadas >= v_cupo then raise exception 'Ese horario ya no tiene cupo disponible'; end if;
  if p_tipo = 'regular' then
    select id, clases_totales into v_membresia_id, v_clases_totales from membresias
      where cliente_id = p_cliente_id and estado = 'activa'
        and congelada_desde is null
        and fecha_vencimiento >= p_fecha
        and (clases_totales is null or clases_usadas < clases_totales)
      order by fecha_vencimiento asc
      limit 1;
    if v_membresia_id is null then
      select coalesce(tutor_id, id) into v_tutor_familia_id from clientes where id = p_cliente_id;
      select m.id, m.clases_totales into v_membresia_id, v_clases_totales
        from membresias m join paquetes pq on pq.id = m.paquete_id
        where m.cliente_id = v_tutor_familia_id and pq.compartido_familiar = true
          and m.estado = 'activa' and m.congelada_desde is null and m.fecha_vencimiento >= p_fecha
          and (m.clases_totales is null or m.clases_usadas < m.clases_totales)
        order by m.fecha_vencimiento asc limit 1;
    end if;
    if v_membresia_id is null then
      raise exception 'Esta clienta no tiene un paquete activo con cupo disponible — asígnale un paquete o un link de pago primero, o márcala como clase de prueba.';
    end if;
  end if;
  if v_reserva_id is not null then
    update reservas set estado = 'confirmada', tipo = p_tipo where id = v_reserva_id;
  else
    insert into reservas (horario_id, cliente_id, fecha, tipo, estado)
      values (p_horario_id, p_cliente_id, p_fecha, p_tipo, 'confirmada')
      returning id into v_reserva_id;
  end if;
  if p_tipo = 'regular' and v_clases_totales is not null then
    update membresias set clases_usadas = clases_usadas + 1 where id = v_membresia_id;
  end if;
  return json_build_object('ok', true, 'reserva_id', v_reserva_id);
end;
$function$


-- ===== admin_cancelar_reserva =====
CREATE OR REPLACE FUNCTION public.admin_cancelar_reserva(p_reserva_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_reserva record;
begin
  if not exists (select 1 from perfiles where id = auth.uid() and rol = 'duena') then
    raise exception 'Solo la dueña puede cancelar reservas desde aquí';
  end if;

  select * into v_reserva from reservas where id = p_reserva_id and estado = 'confirmada';
  if v_reserva is null then
    raise exception 'Reserva no encontrada';
  end if;

  update reservas set estado = 'cancelada' where id = p_reserva_id;

  if v_reserva.tipo = 'regular' then
    perform devolver_clase_a_membresia(v_reserva.cliente_id);
  end if;

  return json_build_object('ok', true);
end;
$function$


-- ===== admin_editar_tipo_reserva =====
CREATE OR REPLACE FUNCTION public.admin_editar_tipo_reserva(p_reserva_id uuid, p_tipo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles where id = auth.uid() and rol = 'duena') then
    raise exception 'Solo la dueña puede editar el tipo de una reserva';
  end if;

  if p_tipo not in ('regular', 'prueba') then
    raise exception 'Tipo de reserva inválido';
  end if;

  update reservas set tipo = p_tipo where id = p_reserva_id;
end;
$function$


-- ===== agregar_cobro_personalizado =====
CREATE OR REPLACE FUNCTION public.agregar_cobro_personalizado(p_cliente_id uuid, p_concepto text, p_monto numeric, p_metodo_pago text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cobro_id uuid;
begin
  if not exists (select 1 from perfiles where id = auth.uid() and rol = 'duena') then
    raise exception 'Solo la dueña puede registrar un cobro personalizado';
  end if;

  if p_concepto is null or trim(p_concepto) = '' then
    raise exception 'Falta el concepto del cobro';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;

  if p_metodo_pago not in ('transferencia', 'tarjeta_estudio', 'efectivo', 'pasarela') then
    raise exception 'Método de pago no válido';
  end if;

  if not exists (select 1 from clientes where id = p_cliente_id) then
    raise exception 'Clienta no encontrada';
  end if;

  insert into cobros_personalizados (cliente_id, concepto, monto, metodo_pago, confirmado_por)
    values (p_cliente_id, trim(p_concepto), p_monto, p_metodo_pago, auth.uid())
    returning id into v_cobro_id;

  return json_build_object('ok', true, 'cobro_id', v_cobro_id);
end;
$function$


-- ===== agregar_membresia_manual =====
CREATE OR REPLACE FUNCTION public.agregar_membresia_manual(p_cliente_id uuid, p_paquete_id uuid, p_metodo_pago text DEFAULT 'tarjeta_estudio'::text, p_codigo_descuento text DEFAULT NULL::text, p_fecha_cobro date DEFAULT NULL::date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_paquete record;
  v_membresia_id uuid;
  v_descuento_pct int := 0;
  v_codigo_id uuid;
  v_precio_final numeric;
  v_origen text := 'compra';
  v_confirmado_at timestamptz := now();
begin
  if not exists (select 1 from perfiles where id = auth.uid()) then
    raise exception 'No autorizado';
  end if;

  if p_metodo_pago not in ('transferencia', 'tarjeta_estudio', 'efectivo', 'cortesia', 'pasarela') then
    raise exception 'Método de pago no válido';
  end if;

  if p_metodo_pago = 'cortesia' and not exists (select 1 from perfiles where id = auth.uid() and rol = 'duena') then
    raise exception 'Solo la dueña puede otorgar paquetes de cortesía';
  end if;

  if p_fecha_cobro is not null then
    if not exists (select 1 from perfiles where id = auth.uid() and rol in ('duena', 'empleada')) then
      raise exception 'Solo dueña/empleada puede registrar un cobro con fecha atrasada';
    end if;
    if p_fecha_cobro > ((now() - interval '6 hours')::date) then
      raise exception 'La fecha del cobro no puede ser a futuro';
    end if;
    if p_fecha_cobro < ((now() - interval '6 hours')::date - 14) then
      raise exception 'Esa fecha es de hace más de 14 días — corrígelo manualmente en Supabase si el atraso es mayor.';
    end if;
    -- Mediodía GT: cae dentro del mismo día sin importar la hora exacta
    -- en que se termine de registrar.
    v_confirmado_at := (p_fecha_cobro::timestamp + interval '12 hours');
  end if;

  select num_clases, vigencia_dias, precio into v_paquete
    from paquetes where id = p_paquete_id and activo = true;
  if v_paquete is null then
    raise exception 'Paquete no válido';
  end if;

  if not exists (select 1 from clientes where id = p_cliente_id) then
    raise exception 'Clienta no encontrada';
  end if;

  if p_metodo_pago = 'cortesia' then
    v_origen := 'cortesia';
    v_precio_final := 0;
  else
    select v.v_descuento_pct, v.v_codigo_id into v_descuento_pct, v_codigo_id
      from _aplicar_codigo_descuento(p_codigo_descuento, p_paquete_id) v;

    v_precio_final := _precio_con_descuento(p_paquete_id, v_paquete.precio, v_codigo_id, v_descuento_pct);
  end if;

  insert into membresias
    (cliente_id, paquete_id, metodo_pago, descuento_pct, precio_final, codigo_descuento_id, estado, clases_totales, clases_usadas,
     fecha_inicio, fecha_vencimiento, pagada, origen, confirmado_at, confirmado_por)
    values
    (p_cliente_id, p_paquete_id, p_metodo_pago, v_descuento_pct, v_precio_final, v_codigo_id, 'activa', v_paquete.num_clases, 0,
     ((now() - interval '6 hours')::date), ((now() - interval '6 hours')::date) + v_paquete.vigencia_dias, true, v_origen, v_confirmado_at, auth.uid())
    returning id into v_membresia_id;

  perform otorgar_bono_referido_si_corresponde(p_cliente_id, p_paquete_id);

  return json_build_object('ok', true, 'membresia_id', v_membresia_id, 'precio_final', v_precio_final);
end;
$function$


-- ===== anular_cobro_membresia =====
CREATE OR REPLACE FUNCTION public.anular_cobro_membresia(p_membresia_id uuid, p_motivo text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_membresia record;
  v_destino_id uuid;
  v_destino_totales int;
  v_destino_usadas int;
  v_movidas int := 0;
  v_otro_activo uuid;
  v_reservas_canceladas int := 0;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    raise exception 'Solo la dueña puede anular un cobro';
  end if;

  select * into v_membresia from membresias where id = p_membresia_id;
  if v_membresia is null then
    raise exception 'Cobro no encontrado';
  end if;

  if v_membresia.estado = 'anulada' then
    raise exception 'Este cobro ya estaba anulado';
  end if;

  if not v_membresia.pagada then
    raise exception 'Esto todavía no es un cobro confirmado — usa "Eliminar" en pendientes en vez de anular';
  end if;

  if v_membresia.codigo_descuento_id is not null then
    update codigos_descuento set usos_actuales = greatest(usos_actuales - 1, 0) where id = v_membresia.codigo_descuento_id;
  end if;

  update membresias set
    estado = 'anulada',
    anulada_at = now(),
    anulada_por = auth.uid(),
    anulada_motivo = p_motivo
  where id = p_membresia_id;

  if coalesce(v_membresia.clases_usadas, 0) > 0 then
    select id, clases_totales, clases_usadas into v_destino_id, v_destino_totales, v_destino_usadas from membresias
      where cliente_id = v_membresia.cliente_id and estado = 'activa' and id <> p_membresia_id
      order by created_at desc limit 1;

    if v_destino_id is not null then
      v_movidas := case when v_destino_totales is null then v_membresia.clases_usadas
                        else greatest(least(v_membresia.clases_usadas, v_destino_totales - v_destino_usadas), 0) end;
      update membresias set clases_usadas = clases_usadas + v_movidas where id = v_destino_id;
    end if;
  end if;

  select id into v_otro_activo from membresias
    where cliente_id = v_membresia.cliente_id and estado = 'activa' and id <> p_membresia_id
    limit 1;

  if v_otro_activo is null then
    with canceladas as (
      update reservas set estado = 'cancelada'
      where cliente_id = v_membresia.cliente_id
        and estado = 'confirmada'
        and tipo = 'regular'
        and fecha >= (now() - interval '6 hours')::date
      returning id
    )
    select count(*) into v_reservas_canceladas from canceladas;
  end if;

  return json_build_object(
    'ok', true,
    'clases_usadas', coalesce(v_membresia.clases_usadas, 0),
    'clases_movidas', v_movidas,
    'reservas_canceladas', v_reservas_canceladas
  );
end;
$function$


-- ===== bloquear_reserva_clase_empezada =====
CREATE OR REPLACE FUNCTION public.bloquear_reserva_clase_empezada()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_hora time;
begin
  if NEW.estado <> 'confirmada' or (TG_OP = 'UPDATE' and OLD.estado = 'confirmada') then
    return NEW;
  end if;
  if auth.uid() is null
     or exists (select 1 from perfiles where id = auth.uid() and rol in ('duena', 'empleada')) then
    return NEW;
  end if;
  select hora_inicio into v_hora from horarios where id = NEW.horario_id;
  if v_hora is not null and (NEW.fecha + v_hora) <= (now() - interval '6 hours')::timestamp then
    raise exception 'Esa clase ya empezó — elige otro horario.';
  end if;
  return NEW;
end;
$function$


-- ===== cancelar_fecha_horario =====
CREATE OR REPLACE FUNCTION public.cancelar_fecha_horario(p_horario_id uuid, p_fecha date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_categoria text;
  v_reserva record;
  v_afectados jsonb := '[]'::jsonb;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol in ('duena', 'empleada')) then
    raise exception 'No autorizado';
  end if;

  select categoria into v_categoria from horarios where id = p_horario_id;
  if v_categoria is null then
    raise exception 'Horario no válido';
  end if;

  if exists (select 1 from horario_cancelaciones where horario_id = p_horario_id and fecha = p_fecha) then
    raise exception 'Esa fecha ya está cancelada.';
  end if;

  if exists (select 1 from horario_fechas_privadas where horario_id = p_horario_id and fecha = p_fecha) then
    raise exception 'Esa fecha está privatizada — quita la privatización primero si quieres cancelarla.';
  end if;

  insert into horario_cancelaciones (horario_id, fecha) values (p_horario_id, p_fecha);

  for v_reserva in
    select id, cliente_id, tipo from reservas
      where horario_id = p_horario_id and fecha = p_fecha and estado = 'confirmada'
  loop
    update reservas set estado = 'cancelada' where id = v_reserva.id;

    if v_reserva.tipo = 'regular' then
      perform devolver_clase_a_membresia(v_reserva.cliente_id);
    end if;

    v_afectados := v_afectados || jsonb_build_object('cliente_id', v_reserva.cliente_id, 'tipo', v_reserva.tipo);
  end loop;

  delete from lista_espera where horario_id = p_horario_id and fecha = p_fecha;

  return json_build_object('ok', true, 'afectados', v_afectados);
end;
$function$


-- ===== cancelar_mi_reserva =====
CREATE OR REPLACE FUNCTION public.cancelar_mi_reserva(p_reserva_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_propio_id uuid;
  v_reserva record;
  v_horas_minimas int;
  v_horas_faltantes numeric;
  v_es_tardia boolean;
begin
  select id into v_propio_id from clientes where user_id = auth.uid();

  select r.*, h.hora_inicio into v_reserva
    from reservas r join horarios h on h.id = r.horario_id
    where r.id = p_reserva_id
      and (r.cliente_id = v_propio_id or r.cliente_id in (select id from clientes where tutor_id = v_propio_id))
      and r.estado = 'confirmada';

  if v_reserva is null then
    raise exception 'Reserva no encontrada';
  end if;

  select horas_minimas_cancelacion into v_horas_minimas from configuracion_reservas where id = true;
  v_horas_minimas := coalesce(v_horas_minimas, 2);

  -- Guatemala es UTC-6 todo el año — fecha+hora_inicio es hora local.
  v_horas_faltantes := extract(epoch from ((v_reserva.fecha + v_reserva.hora_inicio) - (now() - interval '6 hours')::timestamp)) / 3600;
  v_es_tardia := v_horas_faltantes < v_horas_minimas;

  update reservas set estado = 'cancelada', penalizada = v_es_tardia where id = p_reserva_id;

  if v_reserva.tipo = 'regular' and not v_es_tardia then
    perform devolver_clase_a_membresia(v_reserva.cliente_id);
  end if;

  return json_build_object('ok', true, 'penalizada', v_es_tardia, 'horas_minimas', v_horas_minimas);
end;
$function$


-- ===== checkins_disponibles =====
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


-- ===== clientas_frecuentes_para_cobro =====
CREATE OR REPLACE FUNCTION public.clientas_frecuentes_para_cobro(p_limite integer DEFAULT 8)
 RETURNS TABLE(id uuid, nombre text, telefono text, email text, nombre_tutor text, veces integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return;
  end if;

  return query
  select c.id, c.nombre, c.telefono, c.email, t.nombre as nombre_tutor, count(m.id)::int as veces
  from membresias m
  join clientes c on c.id = m.cliente_id
  left join clientes t on t.id = c.tutor_id
  where m.pagada = true
  group by c.id, c.nombre, c.telefono, c.email, t.nombre
  order by count(m.id) desc, c.nombre asc
  limit p_limite;
end;
$function$


-- ===== clientas_para_cobro =====
CREATE OR REPLACE FUNCTION public.clientas_para_cobro()
 RETURNS TABLE(id uuid, nombre text, telefono text, email text, nombre_tutor text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return;
  end if;

  -- Incluye dependientes (igual que "Clientes") — un paquete se puede
  -- asignar directo a un familiar, no solo a la cuenta principal.
  return query
  select c.id, c.nombre, c.telefono, c.email, t.nombre as nombre_tutor
  from clientes c
  left join clientes t on t.id = c.tutor_id
  order by c.nombre asc;
end;
$function$


-- ===== cobros_de_hoy =====
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


-- ===== cobros_pendientes_hace_tiempo =====
CREATE OR REPLACE FUNCTION public.cobros_pendientes_hace_tiempo()
 RETURNS TABLE(cliente_id uuid, nombre text, telefono text, paquete_nombre text, pedida_el timestamp with time zone, horas_esperando numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return;
  end if;

  return query
  select c.id, c.nombre, c.telefono, p.nombre,
    m.created_at,
    round(extract(epoch from (now() - m.created_at)) / 3600.0, 1)
  from membresias m
  join clientes c on c.id = m.cliente_id
  join paquetes p on p.id = m.paquete_id
  where m.pagada = false and m.estado = 'activa'
  order by m.created_at asc;
end;
$function$


-- ===== codigos_activos_por_paquete =====
CREATE OR REPLACE FUNCTION public.codigos_activos_por_paquete()
 RETURNS TABLE(id uuid, codigo text, descuento_pct integer, paquete_ids uuid[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return;
  end if;

  return query
  select
    cd.id, cd.codigo, cd.descuento_pct,
    coalesce(array_agg(cdp.paquete_id) filter (where cdp.paquete_id is not null), '{}')
  from codigos_descuento cd
  left join codigos_descuento_paquetes cdp on cdp.codigo_id = cd.id
  where cd.activo = true
    and (cd.vigente_hasta is null or cd.vigente_hasta >= ((now() - interval '6 hours')::date))
    and (cd.usos_maximos is null or cd.usos_actuales < cd.usos_maximos)
  group by cd.id, cd.codigo, cd.descuento_pct
  order by cd.codigo asc;
end;
$function$


-- ===== confirmar_mi_reserva =====
CREATE OR REPLACE FUNCTION public.confirmar_mi_reserva(p_reserva_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_propio_id uuid;
begin
  select id into v_propio_id from clientes where user_id = auth.uid();

  update reservas set confirmada_por_clienta_at = now()
    where id = p_reserva_id
      and (cliente_id = v_propio_id or cliente_id in (select id from clientes where tutor_id = v_propio_id))
      and estado = 'confirmada';

  if not found then
    raise exception 'Reserva no encontrada';
  end if;

  return json_build_object('ok', true);
end;
$function$


-- ===== confirmar_pago_membresia =====
CREATE OR REPLACE FUNCTION public.confirmar_pago_membresia(p_membresia_id uuid, p_descuento_pct numeric DEFAULT NULL::numeric)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_es_staff boolean;
  v_paquete record;
  v_membresia record;
  v_precio_final numeric;
  v_descuento numeric;
begin
  select exists(select 1 from perfiles where id = auth.uid() and rol in ('duena', 'empleada')) into v_es_staff;
  if not v_es_staff then
    raise exception 'No autorizado';
  end if;

  select m.cliente_id, m.paquete_id, m.descuento_pct into v_membresia
    from membresias m where m.id = p_membresia_id;

  if v_membresia is null then
    raise exception 'Membresía no encontrada';
  end if;

  select p.num_clases, p.vigencia_dias, p.precio into v_paquete
    from paquetes p where p.id = v_membresia.paquete_id;

  v_descuento := coalesce(p_descuento_pct, v_membresia.descuento_pct, 0);
  v_precio_final := round(v_paquete.precio * (1 - v_descuento / 100.0), 2);

  update membresias set
    estado = 'activa',
    clases_totales = v_paquete.num_clases,
    fecha_inicio = ((now() - interval '6 hours')::date),
    fecha_vencimiento = ((now() - interval '6 hours')::date) + v_paquete.vigencia_dias,
    confirmado_at = now(),
    confirmado_por = auth.uid(),
    descuento_pct = v_descuento,
    precio_final = v_precio_final,
    pagada = true
  where id = p_membresia_id;

  perform otorgar_bono_referido_si_corresponde(v_membresia.cliente_id, v_membresia.paquete_id);

  return json_build_object('ok', true, 'precio_final', v_precio_final);
end;
$function$


-- ===== confirmar_pago_privatizacion =====
CREATE OR REPLACE FUNCTION public.confirmar_pago_privatizacion(p_horario_id uuid, p_fecha date, p_cliente_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_privatizacion_id uuid;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol in ('duena', 'empleada')) then
    raise exception 'No autorizado';
  end if;

  select id into v_privatizacion_id from horario_fechas_privadas
    where horario_id = p_horario_id and fecha = p_fecha;
  if v_privatizacion_id is null then
    raise exception 'No se encontró esa privatización.';
  end if;

  update horario_fechas_privadas_personas
    set pagada = true, confirmado_at = now(), confirmado_por = auth.uid()
    where privatizacion_id = v_privatizacion_id and cliente_id = p_cliente_id;

  if not found then
    raise exception 'Esa clienta no está agregada a esta fecha privatizada.';
  end if;

  return json_build_object('ok', true);
end;
$function$


-- ===== confirmar_pago_transaccion =====
CREATE OR REPLACE FUNCTION public.confirmar_pago_transaccion(p_transaccion_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tx record;
  v_paquete record;
  v_membresia_id uuid;
begin
  select * into v_tx from pago_transacciones where id = p_transaccion_id;
  if v_tx is null then
    raise exception 'Transacción no encontrada';
  end if;
  if v_tx.membresia_id is not null then
    return json_build_object('ok', true, 'membresia_id', v_tx.membresia_id, 'ya_procesada', true);
  end if;

  select * into v_paquete from paquetes where id = v_tx.paquete_id;
  if v_paquete is null then
    raise exception 'Paquete no encontrado';
  end if;

  insert into membresias
    (cliente_id, paquete_id, metodo_pago, descuento_pct, precio_final, estado, clases_totales, clases_usadas,
     fecha_inicio, fecha_vencimiento, pagada, origen, codigo_descuento_id, confirmado_at)
    values
    (v_tx.cliente_id, v_tx.paquete_id, 'pasarela', v_tx.descuento_pct, v_tx.monto, 'activa', v_paquete.num_clases, 0,
     ((now() - interval '6 hours')::date), ((now() - interval '6 hours')::date) + v_paquete.vigencia_dias, true, 'compra', v_tx.codigo_descuento_id, now())
    returning id into v_membresia_id;

  if v_tx.codigo_descuento_id is not null then
    update codigos_descuento set usos_actuales = usos_actuales + 1 where id = v_tx.codigo_descuento_id;
  end if;

  update pago_transacciones
    set estado = 'exitoso', membresia_id = v_membresia_id, actualizado_at = now()
    where id = p_transaccion_id;

  perform otorgar_bono_referido_si_corresponde(v_tx.cliente_id, v_tx.paquete_id);

  return json_build_object('ok', true, 'membresia_id', v_membresia_id);
end;
$function$


-- ===== congelar_membresia =====
CREATE OR REPLACE FUNCTION public.congelar_membresia(p_membresia_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles where id = auth.uid() and rol = 'duena') then
    raise exception 'Solo la dueña puede congelar membresías';
  end if;

  update membresias
    set congelada_desde = (now() - interval '6 hours')::date
    where id = p_membresia_id and estado = 'activa' and congelada_desde is null;

  if not found then
    raise exception 'Esta membresía no se puede congelar (no está activa o ya está congelada)';
  end if;
end;
$function$


-- ===== descongelar_membresia =====
CREATE OR REPLACE FUNCTION public.descongelar_membresia(p_membresia_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_congelada_desde date;
  v_dias int;
begin
  if not exists (select 1 from perfiles where id = auth.uid() and rol = 'duena') then
    raise exception 'Solo la dueña puede descongelar membresías';
  end if;

  select congelada_desde into v_congelada_desde from membresias where id = p_membresia_id;
  if v_congelada_desde is null then
    raise exception 'Esta membresía no está congelada';
  end if;

  v_dias := (now() - interval '6 hours')::date - v_congelada_desde;

  update membresias
    set congelada_desde = null,
        fecha_vencimiento = fecha_vencimiento + v_dias
    where id = p_membresia_id;
end;
$function$


-- ===== devolver_clase_a_membresia =====
CREATE OR REPLACE FUNCTION public.devolver_clase_a_membresia(p_cliente_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_membresia_id uuid;
  v_tutor_familia_id uuid;
begin
  select id into v_membresia_id from membresias
    where cliente_id = p_cliente_id and estado = 'activa' and clases_usadas > 0
    order by fecha_vencimiento asc limit 1;

  if v_membresia_id is null then
    select coalesce(tutor_id, id) into v_tutor_familia_id from clientes where id = p_cliente_id;
    select m.id into v_membresia_id
      from membresias m
      join paquetes pq on pq.id = m.paquete_id
      where m.cliente_id = v_tutor_familia_id and pq.compartido_familiar = true
        and m.estado = 'activa' and m.clases_usadas > 0
      order by m.fecha_vencimiento asc limit 1;
  end if;

  if v_membresia_id is not null then
    update membresias set clases_usadas = greatest(clases_usadas - 1, 0) where id = v_membresia_id;
  end if;
end;
$function$


-- ===== editar_cobro_membresia =====
CREATE OR REPLACE FUNCTION public.editar_cobro_membresia(p_membresia_id uuid, p_codigo_descuento text DEFAULT NULL::text, p_descuento_pct_manual numeric DEFAULT NULL::numeric)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_membresia record;
  v_paquete record;
  v_descuento_pct numeric;
  v_codigo_id uuid;
  v_precio_final numeric;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    raise exception 'Solo la dueña puede editar un cobro';
  end if;

  select * into v_membresia from membresias where id = p_membresia_id;
  if v_membresia is null then
    raise exception 'Membresía no encontrada';
  end if;

  select * into v_paquete from paquetes where id = v_membresia.paquete_id;
  if v_paquete is null then
    raise exception 'Paquete no encontrado';
  end if;

  if p_codigo_descuento is not null and trim(p_codigo_descuento) <> '' then
    select v.v_descuento_pct, v.v_codigo_id into v_descuento_pct, v_codigo_id
      from _validar_codigo_descuento(p_codigo_descuento, v_membresia.paquete_id) v;
  else
    v_descuento_pct := coalesce(p_descuento_pct_manual, 0);
    v_codigo_id := null;
    if v_descuento_pct < 0 or v_descuento_pct > 100 then
      raise exception 'El descuento debe estar entre 0 y 100%%';
    end if;
  end if;

  -- Solo mueve el contador si el código realmente cambió — evita que
  -- volver a guardar el mismo código infle "usos_actuales".
  if v_codigo_id is distinct from v_membresia.codigo_descuento_id then
    if v_codigo_id is not null then
      update codigos_descuento set usos_actuales = usos_actuales + 1 where id = v_codigo_id;
    end if;
    if v_membresia.codigo_descuento_id is not null then
      update codigos_descuento set usos_actuales = greatest(usos_actuales - 1, 0) where id = v_membresia.codigo_descuento_id;
    end if;
  end if;

  v_precio_final := round(v_paquete.precio * (1 - v_descuento_pct / 100.0), 2);

  update membresias set
    descuento_pct = v_descuento_pct,
    precio_final = v_precio_final,
    codigo_descuento_id = v_codigo_id
  where id = p_membresia_id;

  return json_build_object('ok', true, 'precio_final', v_precio_final, 'descuento_pct', v_descuento_pct);
end;
$function$


-- ===== eliminar_cobro_pendiente =====
CREATE OR REPLACE FUNCTION public.eliminar_cobro_pendiente(p_membresia_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    raise exception 'Solo la dueña puede eliminar un cobro pendiente';
  end if;

  delete from membresias where id = p_membresia_id and pagada = false;

  return json_build_object('ok', true);
end;
$function$


-- ===== eliminar_membresia_pendiente =====
CREATE OR REPLACE FUNCTION public.eliminar_membresia_pendiente(p_membresia_id uuid)
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
    raise exception 'Esta membresía ya está pagada — anúlala desde Centro de Pagos si hay un error, no la elimines aquí.';
  end if;

  for v_r in select * from _cancelar_reservas_de_membresia_rechazada(p_membresia_id, v_m.cliente_id, v_m.clases_usadas, v_m.created_at) loop
    v_canceladas := v_canceladas || jsonb_build_object('reserva_id', v_r.reserva_id, 'fecha', v_r.fecha, 'hora_inicio', v_r.hora_inicio, 'nombre_clase', v_r.nombre_clase);
  end loop;

  delete from membresias where id = p_membresia_id;

  return json_build_object('ok', true, 'cliente_id', v_m.cliente_id, 'canceladas', v_canceladas);
end;
$function$


-- ===== export_resumen_clientes =====
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


-- ===== hacer_checkin =====
CREATE OR REPLACE FUNCTION public.hacer_checkin()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cliente_id uuid;
  v_ahora timestamp;
  v_hoy date;
  v_reserva_id uuid;
  v_nombre_clase text;
  v_hora_inicio time;
begin
  v_ahora := now() - interval '6 hours';
  v_hoy := v_ahora::date;

  select id into v_cliente_id from clientes where user_id = auth.uid();
  if v_cliente_id is null then
    raise exception 'No tienes un perfil de clienta asociado';
  end if;

  select r.id, h.nombre_clase, h.hora_inicio
    into v_reserva_id, v_nombre_clase, v_hora_inicio
    from reservas r
    join horarios h on h.id = r.horario_id
    where r.cliente_id = v_cliente_id
      and r.fecha = v_hoy
      and r.estado = 'confirmada'
      and r.asistio is null
      and v_ahora between (r.fecha + h.hora_inicio - interval '30 minutes') and (r.fecha + h.hora_fin + interval '30 minutes')
    order by
      case
        when v_ahora between (r.fecha + h.hora_inicio) and (r.fecha + h.hora_fin) then 0
        when v_ahora < (r.fecha + h.hora_inicio) then 1
        else 2
      end,
      abs(extract(epoch from ((r.fecha + h.hora_inicio) - v_ahora)))
    limit 1;

  if v_reserva_id is null then
    raise exception 'No encontramos ninguna clase tuya para marcar en este momento. Si crees que es un error, avísale al estudio.';
  end if;

  update reservas set asistio = true where id = v_reserva_id;

  return json_build_object('ok', true, 'clase', v_nombre_clase, 'hora', v_hora_inicio);
end;
$function$


-- ===== hacer_checkin_multiple =====
CREATE OR REPLACE FUNCTION public.hacer_checkin_multiple(p_cliente_ids uuid[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ declare v_propio_id uuid; v_ahora time; v_hoy date; v_cliente_id uuid; v_reserva_id uuid; v_nombre_clase text; v_hora_inicio time; v_nombre_cliente text; v_marcados jsonb := '[]'::jsonb; begin v_ahora := (now() - interval '6 hours')::time; v_hoy := (now() - interval '6 hours')::date; select id into v_propio_id from clientes where user_id = auth.uid(); if v_propio_id is null then raise exception 'No tienes un perfil de clienta asociado'; end if; foreach v_cliente_id in array p_cliente_ids loop if v_cliente_id <> v_propio_id and not exists (select 1 from clientes where id = v_cliente_id and tutor_id = v_propio_id) then continue; end if; select r.id, h.nombre_clase, h.hora_inicio, c.nombre into v_reserva_id, v_nombre_clase, v_hora_inicio, v_nombre_cliente from reservas r join horarios h on h.id = r.horario_id join clientes c on c.id = r.cliente_id where r.cliente_id = v_cliente_id and r.fecha = v_hoy and r.estado = 'confirmada' and r.asistio is null and h.hora_inicio between (v_ahora - interval '15 minutes') and (v_ahora + interval '20 minutes') order by abs(extract(epoch from (h.hora_inicio - v_ahora))) limit 1; if v_reserva_id is not null then update reservas set asistio = true where id = v_reserva_id; v_marcados := v_marcados || jsonb_build_object('nombre', v_nombre_cliente, 'clase', v_nombre_clase, 'hora', v_hora_inicio); end if; end loop; if jsonb_array_length(v_marcados) = 0 then raise exception 'No encontramos ninguna clase para marcar en este momento. Si crees que es un error, avísale al estudio.'; end if; return json_build_object('ok', true, 'marcados', v_marcados); end; $function$


-- ===== historial_cobros_paquetes =====
CREATE OR REPLACE FUNCTION public.historial_cobros_paquetes(p_limite integer DEFAULT 100)
 RETURNS TABLE(membresia_id uuid, paquete_id uuid, cliente_nombre text, paquete_nombre text, monto numeric, metodo_pago text, codigo text, estado text, pagada boolean, comprobante_url text, fecha timestamp with time zone, origen text, clases_totales integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return;
  end if;

  return query
  select
    m.id,
    m.paquete_id,
    c.nombre,
    p.nombre,
    coalesce(m.precio_final, p.precio),
    m.metodo_pago,
    cd.codigo,
    m.estado,
    m.pagada,
    m.comprobante_url,
    coalesce(m.confirmado_at, m.created_at),
    m.origen,
    m.clases_totales
  from membresias m
  join clientes c on c.id = m.cliente_id
  join paquetes p on p.id = m.paquete_id
  left join codigos_descuento cd on cd.id = m.codigo_descuento_id
  where m.pagada = true
  order by coalesce(m.confirmado_at, m.created_at) desc
  limit p_limite;
end;
$function$


-- ===== horarios_por_comenzar =====
CREATE OR REPLACE FUNCTION public.horarios_por_comenzar(p_minutos_antes integer DEFAULT 15)
 RETURNS TABLE(horario_id uuid, instructor_id uuid, nombre_clase text, hora_inicio time without time zone, fecha date, confirmadas integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ahora timestamp := (now() - interval '6 hours')::timestamp;
  v_hoy date := v_ahora::date;
begin
  return query
  select h.id, h.instructor_id, h.nombre_clase, h.hora_inicio, v_hoy,
         (select count(*)::int from reservas r where r.horario_id = h.id and r.fecha = v_hoy and r.estado = 'confirmada')
  from horarios h
  where h.activo = true
    and h.dia_semana = extract(dow from v_hoy)
    and (v_hoy + h.hora_inicio) > v_ahora
    and (v_hoy + h.hora_inicio) <= v_ahora + (p_minutos_antes || ' minutes')::interval
    and not exists (
      select 1 from avisos_operativos_enviados a
      where a.horario_id = h.id and a.fecha = v_hoy and a.tipo = 'inicio'
    );
end;
$function$


-- ===== horarios_por_terminar =====
CREATE OR REPLACE FUNCTION public.horarios_por_terminar(p_minutos_antes integer DEFAULT 10)
 RETURNS TABLE(horario_id uuid, instructor_id uuid, nombre_clase text, hora_fin time without time zone, fecha date, sin_marcar integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ahora timestamp := (now() - interval '6 hours')::timestamp;
  v_hoy date := v_ahora::date;
begin
  return query
  select h.id, h.instructor_id, h.nombre_clase, h.hora_fin, v_hoy,
         (select count(*)::int from reservas r where r.horario_id = h.id and r.fecha = v_hoy and r.estado = 'confirmada' and r.asistio is null)
  from horarios h
  where h.activo = true
    and h.dia_semana = extract(dow from v_hoy)
    and (v_hoy + h.hora_fin) > v_ahora
    and (v_hoy + h.hora_fin) <= v_ahora + (p_minutos_antes || ' minutes')::interval
    and not exists (
      select 1 from avisos_operativos_enviados a
      where a.horario_id = h.id and a.fecha = v_hoy and a.tipo = 'fin'
    );
end;
$function$


-- ===== kpi_afluencia_horarios =====
CREATE OR REPLACE FUNCTION public.kpi_afluencia_horarios()
 RETURNS TABLE(horario_id uuid, nombre_clase text, dia_semana integer, hora_inicio time without time zone, cupo_maximo integer, total_reservas bigint, sesiones bigint, ocupacion_pct numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles where id = auth.uid()) then
    raise exception 'No autorizado';
  end if;
  return query select * from public.kpi_afluencia_horarios__interno();
end;
$function$


-- ===== kpi_afluencia_horarios__interno =====
CREATE OR REPLACE FUNCTION public.kpi_afluencia_horarios__interno()
 RETURNS TABLE(horario_id uuid, nombre_clase text, dia_semana integer, hora_inicio time without time zone, cupo_maximo integer, total_reservas bigint, sesiones bigint, ocupacion_pct numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    h.id,
    h.nombre_clase,
    h.dia_semana,
    h.hora_inicio,
    h.cupo_maximo,
    count(r.id) as total_reservas,
    count(distinct r.fecha) as sesiones,
    case when count(distinct r.fecha) = 0 then 0
      else round(100.0 * count(r.id) / (count(distinct r.fecha) * h.cupo_maximo), 1)
    end as ocupacion_pct
  from horarios h
  left join reservas r on r.horario_id = h.id and r.estado = 'confirmada'
  where h.activo = true and h.categoria = 'regular' and h.fecha_especifica is null
  group by h.id, h.nombre_clase, h.dia_semana, h.hora_inicio, h.cupo_maximo
  order by ocupacion_pct desc;
$function$


-- ===== kpi_clientas_paquete_activo_mensual =====
CREATE OR REPLACE FUNCTION public.kpi_clientas_paquete_activo_mensual(p_meses integer DEFAULT 12)
 RETURNS TABLE(mes date, clientas_real bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles where id = auth.uid()) then
    raise exception 'No autorizado';
  end if;
  return query select * from public.kpi_clientas_paquete_activo_mensual__interno(p_meses);
end;
$function$


-- ===== kpi_clientas_paquete_activo_mensual__interno =====
CREATE OR REPLACE FUNCTION public.kpi_clientas_paquete_activo_mensual__interno(p_meses integer DEFAULT 12)
 RETURNS TABLE(mes date, clientas_real bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    gs.mes_ts::date as mes,
    count(distinct mb.cliente_id) as clientas_real
  from generate_series(
    date_trunc('month', (now() - interval '6 hours')) - ((p_meses - 1) || ' months')::interval,
    date_trunc('month', (now() - interval '6 hours')),
    interval '1 month'
  ) as gs(mes_ts)
  left join membresias mb
    on mb.pagada = true
    and mb.estado not in ('rechazada', 'cancelada', 'anulada')
    and mb.fecha_inicio <= (gs.mes_ts + interval '1 month' - interval '1 day')::date
    and mb.fecha_vencimiento >= gs.mes_ts::date
  group by gs.mes_ts
  order by gs.mes_ts desc;
$function$


-- ===== kpi_reservas_lealtad =====
CREATE OR REPLACE FUNCTION public.kpi_reservas_lealtad()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_clientes_unicos int;
  v_total_reservas int;
  v_clientes_repiten int;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return null;
  end if;

  select count(distinct cliente_id), count(*)
    into v_clientes_unicos, v_total_reservas
    from reservas where estado = 'confirmada';

  select count(*) into v_clientes_repiten
    from (
      select cliente_id from reservas where estado = 'confirmada'
      group by cliente_id having count(*) >= 2
    ) t;

  return json_build_object(
    'clientes_unicos', v_clientes_unicos,
    'total_reservas', v_total_reservas,
    'reservas_por_cliente', case when v_clientes_unicos > 0 then round(v_total_reservas::numeric / v_clientes_unicos, 2) else null end,
    'clientes_repiten', v_clientes_repiten,
    'pct_rebooking', case when v_clientes_unicos > 0 then round(100.0 * v_clientes_repiten / v_clientes_unicos, 1) else null end
  );
end;
$function$


-- ===== kpi_reservas_mensual =====
CREATE OR REPLACE FUNCTION public.kpi_reservas_mensual(p_meses integer DEFAULT 12)
 RETURNS TABLE(mes date, reservas_real bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles where id = auth.uid()) then
    raise exception 'No autorizado';
  end if;
  return query select * from public.kpi_reservas_mensual__interno(p_meses);
end;
$function$


-- ===== kpi_reservas_mensual__interno =====
CREATE OR REPLACE FUNCTION public.kpi_reservas_mensual__interno(p_meses integer DEFAULT 12)
 RETURNS TABLE(mes date, reservas_real bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select date_trunc('month', r.fecha)::date as mes, count(*) as reservas_real
  from reservas r
  where r.estado = 'confirmada'
  group by mes
  order by mes desc
  limit p_meses;
$function$


-- ===== kpi_tiempo_confirmacion_cobro =====
CREATE OR REPLACE FUNCTION public.kpi_tiempo_confirmacion_cobro()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_avg numeric;
  v_max numeric;
  v_evaluadas int;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return null;
  end if;

  select avg(extract(epoch from (confirmado_at - created_at)) / 3600.0),
         max(extract(epoch from (confirmado_at - created_at)) / 3600.0),
         count(*)
    into v_avg, v_max, v_evaluadas
  from membresias
  where pagada = true and confirmado_at is not null and origen = 'compra';

  return json_build_object(
    'horas_promedio', round(coalesce(v_avg, 0), 1),
    'horas_maximo', round(coalesce(v_max, 0), 1),
    'cobros_evaluados', v_evaluadas
  );
end;
$function$


-- ===== lista_espera_vencida =====
CREATE OR REPLACE FUNCTION public.lista_espera_vencida()
 RETURNS TABLE(lista_espera_id uuid, cliente_id uuid, nombre text, email text, user_id uuid, nombre_clase text, hora_inicio time without time zone, fecha date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ahora timestamp := (now() - interval '6 hours')::timestamp;
  v_reg record;
begin
  for v_reg in
    select le.id as le_id, c.id as c_id, c.nombre as c_nombre, c.email as c_email, c.user_id as c_user_id,
           h.nombre_clase as h_nombre, h.hora_inicio as h_hora, le.fecha as le_fecha
    from lista_espera le
    join horarios h on h.id = le.horario_id
    join clientes c on c.id = le.cliente_id
    where (le.fecha + h.hora_inicio) <= v_ahora
  loop
    delete from lista_espera where id = v_reg.le_id;
    lista_espera_id := v_reg.le_id;
    cliente_id := v_reg.c_id;
    nombre := v_reg.c_nombre;
    email := v_reg.c_email;
    user_id := v_reg.c_user_id;
    nombre_clase := v_reg.h_nombre;
    hora_inicio := v_reg.h_hora;
    fecha := v_reg.le_fecha;
    return next;
  end loop;
end;
$function$


-- ===== marcar_membresia_pagada =====
CREATE OR REPLACE FUNCTION public.marcar_membresia_pagada(p_membresia_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_membresia record;
  v_num_clases int;
  v_vigencia_dias int;
begin
  if not exists (select 1 from perfiles where id = auth.uid() and rol in ('duena', 'empleada')) then
    raise exception 'No autorizado';
  end if;

  select cliente_id, paquete_id, origen, clases_totales into v_membresia
    from membresias where id = p_membresia_id and pagada = false;

  if v_membresia is null then
    raise exception 'Membresía no encontrada o ya pagada';
  end if;

  select num_clases, vigencia_dias into v_num_clases, v_vigencia_dias
    from paquetes where id = v_membresia.paquete_id;

  if v_membresia.origen = 'compra' then
    update membresias set
      pagada = true,
      clases_totales = case when v_num_clases is null then null else greatest(v_membresia.clases_totales, v_num_clases) end,
      fecha_inicio = ((now() - interval '6 hours')::date),
      fecha_vencimiento = ((now() - interval '6 hours')::date) + coalesce(v_vigencia_dias, 30),
      confirmado_at = now(),
      confirmado_por = auth.uid()
    where id = p_membresia_id;
  else
    update membresias set
      pagada = true,
      fecha_inicio = ((now() - interval '6 hours')::date),
      fecha_vencimiento = ((now() - interval '6 hours')::date) + coalesce(v_vigencia_dias, 30),
      confirmado_at = now(),
      confirmado_por = auth.uid()
    where id = p_membresia_id;
  end if;

  perform otorgar_bono_referido_si_corresponde(v_membresia.cliente_id, v_membresia.paquete_id);

  return json_build_object('ok', true);
end;
$function$


-- ===== membresias_para_recordatorio_inactividad =====
CREATE OR REPLACE FUNCTION public.membresias_para_recordatorio_inactividad(p_dias integer DEFAULT 14)
 RETURNS TABLE(membresia_id uuid, cliente_id uuid, user_id uuid, nombre text, email text, clases_restantes integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
  select
    m.id,
    c.id,
    c.user_id,
    c.nombre,
    c.email,
    case when m.clases_totales is null then null else m.clases_totales - m.clases_usadas end
  from membresias m
  join clientes c on c.id = m.cliente_id
  where m.estado = 'activa'
    and m.congelada_desde is null
    and m.fecha_vencimiento >= ((now() - interval '6 hours')::date)
    and (m.clases_totales is null or m.clases_usadas < m.clases_totales)
    and m.recordatorio_inactividad_enviado_at is null
    and m.created_at <= now() - (p_dias || ' days')::interval
    and not exists (
      select 1 from reservas r
      where r.cliente_id = c.id and r.estado = 'confirmada' and r.fecha >= ((now() - interval '6 hours')::date) - p_dias
    );
end;
$function$


-- ===== membresias_para_recordatorio_vencimiento =====
CREATE OR REPLACE FUNCTION public.membresias_para_recordatorio_vencimiento(p_dias integer DEFAULT 3)
 RETURNS TABLE(membresia_id uuid, cliente_id uuid, user_id uuid, nombre text, email text, fecha_vencimiento date, paquete_nombre text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
  select m.id, c.id, c.user_id, c.nombre, c.email, m.fecha_vencimiento, p.nombre
  from membresias m
  join clientes c on c.id = m.cliente_id
  join paquetes p on p.id = m.paquete_id
  where m.estado = 'activa'
    and m.congelada_desde is null
    and m.recordatorio_vencimiento_enviado = false
    and m.fecha_vencimiento >= ((now() - interval '6 hours')::date)
    and m.fecha_vencimiento <= ((now() - interval '6 hours')::date) + p_dias
    and (m.clases_totales is null or m.clases_usadas < m.clases_totales);
end;
$function$


-- ===== membresias_por_vencer =====
CREATE OR REPLACE FUNCTION public.membresias_por_vencer(p_dias integer DEFAULT 7)
 RETURNS TABLE(cliente_id uuid, nombre text, email text, telefono text, fecha_vencimiento date, paquete_nombre text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return;
  end if;

  return query
  select c.id, c.nombre, c.email, c.telefono, m.fecha_vencimiento, p.nombre
  from membresias m
  join clientes c on c.id = m.cliente_id
  join paquetes p on p.id = m.paquete_id
  where m.estado = 'activa'
    and m.fecha_vencimiento >= ((now() - interval '6 hours')::date)
    and m.fecha_vencimiento <= ((now() - interval '6 hours')::date) + p_dias
  order by m.fecha_vencimiento asc;
end;
$function$


-- ===== mi_lista_espera =====
CREATE OR REPLACE FUNCTION public.mi_lista_espera()
 RETURNS TABLE(id uuid, fecha date, hora_inicio time without time zone, nombre_clase text, cliente_id uuid, cliente_nombre text, es_propia boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_propio_id uuid;
begin
  select clientes.id into v_propio_id from clientes where user_id = auth.uid();
  if v_propio_id is null then
    return;
  end if;

  return query
  select le.id, le.fecha, h.hora_inicio, h.nombre_clase, c.id, c.nombre, (c.id = v_propio_id)
  from lista_espera le
  join horarios h on h.id = le.horario_id
  join clientes c on c.id = le.cliente_id
  where c.id = v_propio_id or c.tutor_id = v_propio_id
  order by le.fecha, h.hora_inicio;
end;
$function$


-- ===== mis_proximas_reservas_instructora =====
CREATE OR REPLACE FUNCTION public.mis_proximas_reservas_instructora()
 RETURNS TABLE(id uuid, fecha date, horario_id uuid, cliente_nombre text, cuidados_especiales text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'instructora') then
    return;
  end if;

  return query
  select r.id, r.fecha, r.horario_id, c.nombre, c.cuidados_especiales
  from reservas r
  join horarios h on h.id = r.horario_id
  join clientes c on c.id = r.cliente_id
  where h.instructor_id = auth.uid()
    and r.estado = 'confirmada'
    and r.fecha >= ((now() - interval '6 hours')::date)
  order by r.fecha asc;
end;
$function$


-- ===== pagos_pasarela_pendientes =====
CREATE OR REPLACE FUNCTION public.pagos_pasarela_pendientes()
 RETURNS TABLE(id uuid, cliente_nombre text, cliente_telefono text, paquete_nombre text, monto numeric, proveedor text, proveedor_transaccion_id text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return;
  end if;

  return query
  select pt.id, c.nombre, c.telefono, p.nombre, pt.monto, pt.proveedor, pt.proveedor_transaccion_id, pt.created_at
  from pago_transacciones pt
  join clientes c on c.id = pt.cliente_id
  join paquetes p on p.id = pt.paquete_id
  where pt.estado = 'iniciado'
  order by pt.created_at desc;
end;
$function$


-- ===== pagos_recurrente_historial =====
CREATE OR REPLACE FUNCTION public.pagos_recurrente_historial(p_desde date DEFAULT NULL::date, p_hasta date DEFAULT NULL::date)
 RETURNS TABLE(transaccion_id uuid, fecha timestamp with time zone, cliente_nombre text, tipo text, descripcion text, monto numeric, comision_estimada numeric, neto_estimado numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol in ('duena', 'contadora')) then
    return;
  end if;

  return query
  select
    tx.id, tx.actualizado_at, c.nombre, tx.tipo,
    case
      when tx.tipo = 'paquete' then pq.nombre
      else coalesce((
        select string_agg(pi.cantidad || 'x ' || pi.nombre || coalesce(' (' || pi.variante_nombre || ')', ''), ', ')
        from pedido_items pi where pi.pedido_id = tx.pedido_id
      ), 'Pedido de tienda')
    end,
    tx.monto,
    round(tx.monto * 0.045 + 2, 2),
    round(tx.monto - (tx.monto * 0.045 + 2), 2)
  from pago_transacciones tx
  join clientes c on c.id = tx.cliente_id
  left join paquetes pq on pq.id = tx.paquete_id
  where tx.proveedor = 'recurrente' and tx.estado = 'exitoso'
    and (p_desde is null or tx.actualizado_at::date >= p_desde)
    and (p_hasta is null or tx.actualizado_at::date <= p_hasta)
  order by tx.actualizado_at desc;
end;
$function$


-- ===== privatizar_fecha_horario =====
CREATE OR REPLACE FUNCTION public.privatizar_fecha_horario(p_horario_id uuid, p_fecha date, p_cupo integer DEFAULT 1)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_categoria text;
  v_activo boolean;
  v_otras_reservas int;
  v_id uuid;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol in ('duena', 'empleada')) then
    raise exception 'No autorizado';
  end if;

  if p_fecha < greatest((now() - interval '6 hours')::date, date '2026-09-21') then
    raise exception 'No se pueden privatizar fechas anteriores a la apertura de reservas.';
  end if;

  if coalesce(p_cupo, 0) < 1 then
    raise exception 'El cupo debe ser al menos 1.';
  end if;

  select categoria, activo into v_categoria, v_activo from horarios where id = p_horario_id;
  if v_categoria is null then
    raise exception 'Horario no válido';
  end if;
  if v_categoria <> 'regular' then
    raise exception 'Solo se pueden privatizar fechas de horarios regulares — las clases privadas ya tienen su propio calendario.';
  end if;
  if not v_activo then
    raise exception 'Ese horario está inactivo.';
  end if;

  if exists (select 1 from horario_cancelaciones where horario_id = p_horario_id and fecha = p_fecha) then
    raise exception 'Esa fecha está cancelada — quítale la cancelación primero si quieres privatizarla.';
  end if;

  if exists (select 1 from horario_fechas_privadas where horario_id = p_horario_id and fecha = p_fecha) then
    raise exception 'Esa fecha ya está privatizada.';
  end if;

  select count(*) into v_otras_reservas from reservas
    where horario_id = p_horario_id and fecha = p_fecha and estado = 'confirmada';
  if v_otras_reservas > 0 then
    raise exception 'Ya hay % clienta(s) con reserva confirmada en esa fecha — cancélalas primero o elige otra fecha.', v_otras_reservas;
  end if;

  insert into horario_fechas_privadas (horario_id, fecha, cupo)
    values (p_horario_id, p_fecha, p_cupo)
    returning id into v_id;

  return json_build_object('ok', true, 'privatizacion_id', v_id);
end;
$function$


-- ===== promover_lista_espera =====
CREATE OR REPLACE FUNCTION public.promover_lista_espera()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cupo int;
  v_hora_inicio time;
  v_ocupadas int;
  v_espera record;
  v_reserva_existente uuid;
  v_nueva_reserva_id uuid;
  v_membresia_id uuid;
  v_tutor_familia_id uuid;
begin
  if NEW.estado <> 'cancelada' or OLD.estado = 'cancelada' then
    return NEW;
  end if;

  -- Fecha cancelada o privatizada: no hay clase abierta a la cual promover.
  if exists (select 1 from horario_cancelaciones where horario_id = NEW.horario_id and fecha = NEW.fecha)
     or exists (select 1 from horario_fechas_privadas where horario_id = NEW.horario_id and fecha = NEW.fecha) then
    return NEW;
  end if;

  select cupo_maximo, hora_inicio into v_cupo, v_hora_inicio from horarios where id = NEW.horario_id;

  -- La clase ya empezó (hora de Guatemala) — no tiene sentido confirmar a nadie.
  if v_hora_inicio is null or (NEW.fecha + v_hora_inicio) <= (now() - interval '6 hours')::timestamp then
    return NEW;
  end if;

  select count(*) into v_ocupadas from reservas
    where horario_id = NEW.horario_id and fecha = NEW.fecha and estado = 'confirmada';

  if v_cupo is null or v_ocupadas >= v_cupo then
    return NEW;
  end if;

  for v_espera in
    select * from lista_espera
      where horario_id = NEW.horario_id and fecha = NEW.fecha
      order by created_at asc
  loop
    select id into v_membresia_id from membresias
      where cliente_id = v_espera.cliente_id
        and estado = 'activa'
        and congelada_desde is null
        and fecha_vencimiento >= NEW.fecha
        and (clases_totales is null or clases_usadas < clases_totales)
      order by fecha_vencimiento asc
      limit 1;

    if v_membresia_id is null then
      select coalesce(tutor_id, id) into v_tutor_familia_id from clientes where id = v_espera.cliente_id;

      select m.id into v_membresia_id
        from membresias m
        join paquetes pq on pq.id = m.paquete_id
        where m.cliente_id = v_tutor_familia_id
          and pq.compartido_familiar = true
          and m.estado = 'activa'
          and m.congelada_desde is null
          and m.fecha_vencimiento >= NEW.fecha
          and (m.clases_totales is null or m.clases_usadas < m.clases_totales)
        order by m.fecha_vencimiento asc
        limit 1;
    end if;

    if v_membresia_id is null then
      continue;
    end if;

    select id into v_reserva_existente from reservas
      where horario_id = NEW.horario_id and cliente_id = v_espera.cliente_id and fecha = NEW.fecha;

    if v_reserva_existente is not null then
      update reservas set estado = 'confirmada', tipo = 'regular' where id = v_reserva_existente;
      v_nueva_reserva_id := v_reserva_existente;
    else
      insert into reservas (horario_id, cliente_id, fecha, tipo, estado)
        values (NEW.horario_id, v_espera.cliente_id, NEW.fecha, 'regular', 'confirmada')
        returning id into v_nueva_reserva_id;
    end if;

    update membresias set clases_usadas = clases_usadas + 1 where id = v_membresia_id;

    delete from lista_espera where id = v_espera.id;

    insert into lista_espera_notificaciones (reserva_id, cliente_id)
      values (v_nueva_reserva_id, v_espera.cliente_id);

    exit;
  end loop;

  return NEW;
end;
$function$


-- ===== rechazar_membresia_pendiente =====
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


-- ===== registrar_error_cliente =====
CREATE OR REPLACE FUNCTION public.registrar_error_cliente(p_mensaje text, p_stack text DEFAULT NULL::text, p_url text DEFAULT NULL::text, p_contexto jsonb DEFAULT NULL::jsonb, p_nivel text DEFAULT 'error'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_firma text;
  v_existente_id uuid;
  v_estaba_resuelto boolean;
begin
  if coalesce(trim(p_mensaje), '') = '' then
    return json_build_object('ok', true, 'nuevo', false);
  end if;
  v_firma := md5(left(coalesce(p_mensaje, ''), 500) || '|' || left(coalesce(p_stack, ''), 300));

  select id, resuelto into v_existente_id, v_estaba_resuelto from error_logs
    where firma = v_firma and ultima_vez > now() - interval '7 days'
    order by ultima_vez desc limit 1;

  if v_existente_id is not null and not v_estaba_resuelto then
    update error_logs set veces = veces + 1, ultima_vez = now(), url = coalesce(p_url, url)
      where id = v_existente_id;
    return json_build_object('ok', true, 'nuevo', false);
  end if;

  if v_existente_id is not null and v_estaba_resuelto then
    update error_logs set veces = veces + 1, ultima_vez = now(), url = coalesce(p_url, url),
      resuelto = false, resuelto_por = null, resuelto_at = null
      where id = v_existente_id;
    return json_build_object('ok', true, 'nuevo', true);
  end if;

  insert into error_logs (firma, mensaje, stack, url, contexto, nivel)
    values (v_firma, left(p_mensaje, 2000), left(p_stack, 4000), left(p_url, 500), p_contexto, coalesce(p_nivel, 'error'));

  return json_build_object('ok', true, 'nuevo', true);
end;
$function$


-- ===== reservas_asistencia_por_notificar =====
CREATE OR REPLACE FUNCTION public.reservas_asistencia_por_notificar()
 RETURNS TABLE(reserva_id uuid, user_id uuid, nombre_clase text, fecha date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
  select r.id, c.user_id, h.nombre_clase, r.fecha
  from reservas r
  join horarios h on h.id = r.horario_id
  join clientes c on c.id = r.cliente_id
  where r.asistio = true
    and r.asistencia_notificada = false
    and c.user_id is not null;
end;
$function$


-- ===== reservas_liberadas_no_confirmar =====
CREATE OR REPLACE FUNCTION public.reservas_liberadas_no_confirmar(p_dias integer DEFAULT 30)
 RETURNS TABLE(reserva_id uuid, nombre text, telefono text, email text, nombre_clase text, fecha date, hora_inicio time without time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol in ('duena', 'empleada')) then
    return;
  end if;

  return query
  select r.id, c.nombre, c.telefono, c.email, h.nombre_clase, r.fecha, h.hora_inicio
  from reservas r
  join clientes c on c.id = r.cliente_id
  join horarios h on h.id = r.horario_id
  where r.liberada_por_no_confirmar = true
    and r.fecha >= ((now() - interval '6 hours')::date) - p_dias
  order by r.fecha desc, h.hora_inicio desc;
end;
$function$


-- ===== reservas_para_recordar_confirmacion =====
CREATE OR REPLACE FUNCTION public.reservas_para_recordar_confirmacion()
 RETURNS TABLE(reserva_id uuid, nombre text, email text, user_id uuid, nombre_clase text, hora_inicio time without time zone, fecha date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_horas_confirmacion int;
  v_ahora timestamp := (now() - interval '6 hours')::timestamp;
begin
  select horas_minimas_confirmacion into v_horas_confirmacion from configuracion_reservas where id = true;
  v_horas_confirmacion := coalesce(v_horas_confirmacion, 1);

  return query
  select
    r.id, c.nombre, c.email, c.user_id, h.nombre_clase, h.hora_inicio, r.fecha
  from reservas r
  join horarios h on h.id = r.horario_id
  join clientes c on c.id = r.cliente_id
  where r.estado = 'confirmada'
    and r.tipo = 'regular'
    and r.confirmada_por_clienta_at is null
    and r.confirmacion_recordatorio_enviado = false
    and (r.fecha + h.hora_inicio) > v_ahora
    and (r.fecha + h.hora_inicio) <= v_ahora + (v_horas_confirmacion || ' hours')::interval
    and (
      select count(*) from reservas r2
      where r2.horario_id = r.horario_id and r2.fecha = r.fecha and r2.estado = 'confirmada'
    ) >= h.cupo_maximo;
end;
$function$


-- ===== reservas_para_recordatorio_agendada =====
CREATE OR REPLACE FUNCTION public.reservas_para_recordatorio_agendada()
 RETURNS TABLE(reserva_id uuid, cliente_id uuid, user_id uuid, tutor_id uuid, tutor_user_id uuid, nombre text, email text, tutor_email text, nombre_clase text, fecha date, hora_inicio time without time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ahora timestamp := (now() - interval '6 hours')::timestamp;
begin
  return query
  select
    r.id,
    c.id,
    c.user_id,
    tutor.id,
    tutor.user_id,
    c.nombre,
    c.email,
    tutor.email,
    h.nombre_clase,
    r.fecha,
    h.hora_inicio
  from reservas r
  join horarios h on h.id = r.horario_id
  join clientes c on c.id = r.cliente_id
  left join clientes tutor on tutor.id = c.tutor_id
  where r.estado = 'confirmada'
    and r.recordatorio_agendada_enviado_at is null
    and (r.fecha + h.hora_inicio) > v_ahora
    and v_ahora >= (
      case
        when (r.fecha + h.hora_inicio) - ((r.created_at - interval '6 hours')::timestamp) > interval '24 hours'
          then ((r.created_at - interval '6 hours')::timestamp) + interval '24 hours'
        else (r.fecha + h.hora_inicio) - interval '3 hours'
      end
    );
end;
$function$


-- ===== salir_lista_espera =====
CREATE OR REPLACE FUNCTION public.salir_lista_espera(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_propio_id uuid;
begin
  select id into v_propio_id from clientes where user_id = auth.uid();

  delete from lista_espera
    where id = p_id
      and (cliente_id = v_propio_id or cliente_id in (select id from clientes where tutor_id = v_propio_id));
end;
$function$


-- ===== solicitar_membresia =====
CREATE OR REPLACE FUNCTION public.solicitar_membresia(p_paquete_id uuid, p_referencia_pago text, p_metodo_pago text DEFAULT 'transferencia'::text, p_comprobante_url text DEFAULT NULL::text, p_codigo_descuento text DEFAULT NULL::text, p_cliente_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_propio_id uuid;
  v_cliente_id uuid;
  v_membresia_id uuid;
  v_codigo record;
  v_descuento_pct int := 0;
  v_codigo_id uuid := null;
  v_paquete record;
  v_precio_final numeric;
begin
  select id into v_propio_id from clientes where user_id = auth.uid();
  if v_propio_id is null then
    raise exception 'Primero completa tu registro';
  end if;

  v_cliente_id := v_propio_id;
  if p_cliente_id is not null and p_cliente_id <> v_propio_id then
    if not exists (select 1 from clientes where id = p_cliente_id and tutor_id = v_propio_id) then
      raise exception 'No tienes permiso para comprar un paquete para esa persona.';
    end if;
    v_cliente_id := p_cliente_id;
  end if;

  select num_clases, vigencia_dias, precio into v_paquete
    from paquetes where id = p_paquete_id and activo = true;
  if v_paquete is null then
    raise exception 'Paquete no válido';
  end if;

  if p_metodo_pago not in ('transferencia','tarjeta_estudio') then
    raise exception 'Método de pago no válido';
  end if;

  if p_metodo_pago = 'transferencia' then
    p_referencia_pago := trim(p_referencia_pago);

    if coalesce(p_referencia_pago, '') = '' then
      raise exception 'Ingresa el número de referencia de tu transferencia';
    end if;

    -- No verifica contra el banco (no tenemos acceso a eso) — pero corta
    -- de raíz el caso más tonto y más común: escribir cualquier cosa
    -- ("1111", "11111111", "asdf") solo para poder seguir. Un número de
    -- confirmación real de transferencia en Guatemala nunca es así.
    if length(regexp_replace(p_referencia_pago, '\s', '', 'g')) < 6 then
      raise exception 'Ese número de referencia se ve incompleto — cópialo tal cual aparece en tu comprobante de transferencia.';
    end if;
    if p_referencia_pago ~ '^(.)\1*$' then
      raise exception 'Ese número de referencia no parece real — cópialo tal cual aparece en tu comprobante de transferencia.';
    end if;

    -- Un número de confirmación de transferencia real nunca se repite.
    -- Si ya se usó (aprobado o pendiente, de cualquier clienta), alguien
    -- está reciclando un comprobante viejo o inventando el número.
    if exists (
      select 1 from membresias
        where metodo_pago = 'transferencia' and estado <> 'anulada'
          and referencia_pago = p_referencia_pago
    ) then
      raise exception 'Ese número de referencia ya se usó antes en otra solicitud. Si crees que es un error, contacta al estudio directamente.';
    end if;
  end if;

  if p_codigo_descuento is not null and trim(p_codigo_descuento) <> '' then
    select * into v_codigo from codigos_descuento
      where codigo = upper(trim(p_codigo_descuento)) and activo = true
        and (vigente_hasta is null or vigente_hasta >= ((now() - interval '6 hours')::date))
        and (usos_maximos is null or usos_actuales < usos_maximos);

    if v_codigo is null then
      raise exception 'Código de descuento no válido o vencido';
    end if;

    if exists (select 1 from codigos_descuento_paquetes where codigo_id = v_codigo.id)
       and not exists (select 1 from codigos_descuento_paquetes where codigo_id = v_codigo.id and paquete_id = p_paquete_id) then
      raise exception 'Este código no aplica para el paquete seleccionado';
    end if;

    if exists (select 1 from membresias where cliente_id = v_cliente_id and codigo_descuento_id = v_codigo.id) then
      raise exception 'Ya usaste este código antes — cada código se puede usar una sola vez por cuenta.';
    end if;

    v_descuento_pct := v_codigo.descuento_pct;
    v_codigo_id := v_codigo.id;
    update codigos_descuento set usos_actuales = usos_actuales + 1 where id = v_codigo.id;
  end if;

  v_precio_final := _precio_con_descuento(p_paquete_id, v_paquete.precio, v_codigo_id, v_descuento_pct);

  insert into membresias
    (cliente_id, paquete_id, referencia_pago, metodo_pago, comprobante_url, descuento_pct, precio_final, codigo_descuento_id,
     estado, clases_totales, clases_usadas, fecha_inicio, fecha_vencimiento, pagada)
    values
    (v_cliente_id, p_paquete_id, nullif(trim(p_referencia_pago), ''), p_metodo_pago, p_comprobante_url, v_descuento_pct, v_precio_final, v_codigo_id,
     'activa', 1, 0, ((now() - interval '6 hours')::date), ((now() - interval '6 hours')::date) + v_paquete.vigencia_dias, false)
    returning id into v_membresia_id;

  return json_build_object(
    'ok', true,
    'membresia_id', v_membresia_id,
    'activa_al_instante', true,
    'capada_a_una_clase', true
  );
end;
$function$


-- ===== transferir_membresia =====
CREATE OR REPLACE FUNCTION public.transferir_membresia(p_membresia_id uuid, p_cliente_destino_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_membresia record;
  v_raiz_origen uuid;
  v_raiz_destino uuid;
begin
  if not exists (select 1 from perfiles where id = auth.uid() and rol = 'duena') then
    raise exception 'Solo la dueña puede transferir un paquete';
  end if;

  select id, cliente_id, estado into v_membresia from membresias where id = p_membresia_id;
  if v_membresia is null then
    raise exception 'Paquete no encontrado';
  end if;
  if v_membresia.estado <> 'activa' then
    raise exception 'Solo se pueden transferir paquetes activos';
  end if;
  if v_membresia.cliente_id = p_cliente_destino_id then
    raise exception 'Ese paquete ya es de esa persona';
  end if;

  if not exists (select 1 from clientes where id = p_cliente_destino_id) then
    raise exception 'Persona destino no encontrada';
  end if;

  select coalesce(tutor_id, id) into v_raiz_origen from clientes where id = v_membresia.cliente_id;
  select coalesce(tutor_id, id) into v_raiz_destino from clientes where id = p_cliente_destino_id;
  if v_raiz_origen is distinct from v_raiz_destino then
    raise exception 'Solo puedes transferir paquetes entre miembros de la misma familia';
  end if;

  update membresias set
    transferida_de_id = v_membresia.cliente_id,
    transferida_at = now(),
    transferida_por = auth.uid(),
    cliente_id = p_cliente_destino_id
  where id = p_membresia_id;

  return json_build_object('ok', true);
end;
$function$


-- ===== unirse_lista_espera =====
CREATE OR REPLACE FUNCTION public.unirse_lista_espera(p_horario_id uuid, p_fecha date, p_cliente_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_propio_id uuid;
  v_cliente_id uuid;
  v_cupo int;
  v_ocupadas int;
begin
  select id into v_propio_id from clientes where user_id = auth.uid();
  if v_propio_id is null then
    raise exception 'Completa tu perfil antes de reservar';
  end if;

  v_cliente_id := v_propio_id;
  if p_cliente_id is not null and p_cliente_id <> v_propio_id then
    if not exists (select 1 from clientes where id = p_cliente_id and tutor_id = v_propio_id) then
      raise exception 'No tienes permiso para reservar por esa persona.';
    end if;
    v_cliente_id := p_cliente_id;
  end if;

  select cupo_maximo into v_cupo from horarios where id = p_horario_id and activo = true and categoria = 'regular';
  if v_cupo is null then
    raise exception 'Horario no válido';
  end if;

  if not _fecha_coincide_horario(p_horario_id, p_fecha) then
    raise exception 'Esa fecha no corresponde a ese horario.';
  end if;

  if exists (select 1 from horario_fechas_privadas where horario_id = p_horario_id and fecha = p_fecha) then
    raise exception 'Ese horario no tiene cupo disponible en esa fecha';
  end if;

  if exists (select 1 from horario_cancelaciones where horario_id = p_horario_id and fecha = p_fecha) then
    raise exception 'Ese horario no tiene clase en esa fecha.';
  end if;

  select count(*) into v_ocupadas from reservas
    where horario_id = p_horario_id and fecha = p_fecha and estado = 'confirmada';

  if v_ocupadas < v_cupo then
    raise exception 'Esta clase todavía tiene cupo — resérvala directo.';
  end if;

  if exists (select 1 from reservas where cliente_id = v_cliente_id and horario_id = p_horario_id and fecha = p_fecha and estado = 'confirmada') then
    raise exception 'Ya tiene una reserva confirmada en esa clase.';
  end if;

  insert into lista_espera (horario_id, cliente_id, fecha)
    values (p_horario_id, v_cliente_id, p_fecha)
    on conflict (horario_id, cliente_id, fecha) do nothing;

  return json_build_object('ok', true);
end;
$function$

