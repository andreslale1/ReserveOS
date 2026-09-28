CREATE OR REPLACE FUNCTION public.agendar_clase_prueba(p_horario_id uuid, p_fecha date, p_nombre text, p_email text, p_telefono text, p_genero text DEFAULT NULL::text, p_como_se_entero text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cupo int;
  v_ocupadas int;
  v_cliente_id uuid;
  v_reserva_id uuid;
  v_estado_existente text;
  v_cliente_nuevo boolean := false;
  v_email_contacto text;
  v_telefono text;
begin
  if p_fecha < greatest((now() - interval '6 hours')::date, date '2026-09-21') then
    raise exception 'Las reservas abren a partir del 21 de septiembre de 2026.';
  end if;

  if coalesce(trim(p_email), '') = '' then
    raise exception 'Ingresa tu correo para crear tu cuenta';
  end if;

  v_telefono := telefono_normalizado(p_telefono);
  if v_telefono is null then
    raise exception 'Ingresa un teléfono de Guatemala válido (8 dígitos).';
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

  if v_ocupadas >= v_cupo then
    raise exception 'Ese horario ya no tiene cupo disponible';
  end if;

  select id into v_cliente_id from clientes
    where regexp_replace(telefono, '\D', '', 'g') = v_telefono
      and tutor_id is null
    limit 1;

  if v_cliente_id is null then
    v_cliente_nuevo := true;
    insert into clientes (nombre, email, telefono, genero, como_se_entero)
      values (p_nombre, p_email, v_telefono, p_genero, p_como_se_entero)
      returning id, email into v_cliente_id, v_email_contacto;
  else
    -- Fila existente (lead sin reclamar o clienta ya activa): no se
    -- sobreescribe su identidad con lo que se acaba de escribir en este
    -- formulario público sin sesión — solo se completan campos vacíos.
    update clientes set
        nombre = case when coalesce(trim(nombre), '') = '' then p_nombre else nombre end,
        email = coalesce(email, p_email),
        genero = coalesce(genero, p_genero),
        como_se_entero = coalesce(como_se_entero, p_como_se_entero)
      where id = v_cliente_id
      returning email into v_email_contacto;
  end if;

  if exists (select 1 from reservas where cliente_id = v_cliente_id and tipo = 'prueba' and estado <> 'cancelada') then
    raise exception 'Ya tienes una clase de prueba registrada. Elige un paquete para reservar tu próxima clase.';
  end if;

  select id, estado into v_reserva_id, v_estado_existente from reservas
    where horario_id = p_horario_id and cliente_id = v_cliente_id and fecha = p_fecha;

  if v_reserva_id is not null and v_estado_existente = 'confirmada' then
    raise exception 'Ya tienes una reserva confirmada en esa clase.';
  end if;

  if v_reserva_id is not null then
    update reservas set estado = 'confirmada', tipo = 'prueba' where id = v_reserva_id;
  else
    insert into reservas (horario_id, cliente_id, fecha, tipo, estado)
      values (p_horario_id, v_cliente_id, p_fecha, 'prueba', 'confirmada')
      returning id into v_reserva_id;
  end if;

  return json_build_object(
    'ok', true,
    'reserva_id', v_reserva_id,
    'cliente_id', v_cliente_id,
    'cliente_nuevo', v_cliente_nuevo,
    'email_contacto', v_email_contacto
  );
end;
$function$
