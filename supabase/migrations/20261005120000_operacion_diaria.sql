-- Operación diaria del panel: asistencia (P21), ajuste de créditos (P25), edición de ficha (P12)
-- y cancelar/reabrir una clase de una fecha concreta (P14). El tenant nunca llega del cliente:
-- se deriva del recurso y se valida contra tenant_memberships (staff_puede_en_sede).

-- P21: registrar asistencia / no-show. La instructora solo puede en sus propias clases.
create or replace function public.registrar_asistencia(p_reserva_id uuid, p_asistio boolean)
returns void
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_r record; v_h record; v_mi uuid;
begin
  select * into v_r from public.reservas where id = p_reserva_id and estado = 'confirmada';
  if v_r is null then raise exception 'Reserva no encontrada'; end if;

  if not public.staff_puede_en_sede(v_r.tenant_id, v_r.sede_id,
      array['duena','gerente_general','admin_sede','recepcion','instructora']) then
    raise exception 'No autorizado';
  end if;

  if public.tengo_rol_en_tenant(v_r.tenant_id, array['instructora'])
     and not public.tengo_rol_en_tenant(v_r.tenant_id, array['duena','gerente_general','admin_sede','recepcion']) then
    select * into v_h from public.horarios where id = v_r.horario_id;
    select id into v_mi from public.tenant_memberships
      where tenant_id = v_r.tenant_id and user_id = auth.uid() limit 1;
    if v_h.instructor_membership_id is distinct from v_mi then
      raise exception 'Solo puedes registrar asistencia en tus propias clases';
    end if;
  end if;

  if v_r.fecha > public.hoy_en_sede(v_r.sede_id) then
    raise exception 'No se puede registrar asistencia de una clase futura';
  end if;

  update public.reservas set asistio = p_asistio where id = p_reserva_id;
end;
$$;
revoke all on function public.registrar_asistencia(uuid, boolean) from public;
grant execute on function public.registrar_asistencia(uuid, boolean) to authenticated;

-- P25: ajustar créditos de una membresía (solo dueña / gerente general), con motivo auditado.
create or replace function public.ajustar_creditos_membresia(p_membresia_id uuid, p_delta integer, p_motivo text)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_m record; v_nuevo integer;
begin
  select * into v_m from public.membresias where id = p_membresia_id;
  if v_m is null then raise exception 'Membresía no encontrada'; end if;
  if not public.staff_puede_en_sede(v_m.tenant_id, v_m.sede_venta_id, array['duena','gerente_general']) then
    raise exception 'Solo la dueña o gerente general puede ajustar créditos';
  end if;
  if v_m.clases_totales is null then raise exception 'Esta membresía es ilimitada, no tiene créditos que ajustar'; end if;
  if p_delta = 0 then raise exception 'El ajuste no puede ser 0'; end if;
  if p_motivo is null or length(trim(p_motivo)) < 3 then raise exception 'Escribe el motivo del ajuste'; end if;

  v_nuevo := v_m.clases_totales + p_delta;
  if v_nuevo < v_m.clases_usadas then
    raise exception 'No puede quedar con menos clases que las ya usadas (%)', v_m.clases_usadas;
  end if;

  update public.membresias set clases_totales = v_nuevo where id = p_membresia_id;

  insert into public.admin_acciones_log (tenant_id, actor_id, actor_nombre, tabla, operacion, registro_id, detalle)
  values (v_m.tenant_id, auth.uid(),
    (select nombre from public.tenant_memberships where tenant_id = v_m.tenant_id and user_id = auth.uid() limit 1),
    'membresias', 'ajuste_creditos', p_membresia_id::text,
    jsonb_build_object('delta', p_delta, 'antes', v_m.clases_totales, 'despues', v_nuevo, 'motivo', p_motivo));

  return json_build_object('ok', true, 'clases_totales', v_nuevo);
end;
$$;
revoke all on function public.ajustar_creditos_membresia(uuid, integer, text) from public;
grant execute on function public.ajustar_creditos_membresia(uuid, integer, text) to authenticated;

-- P12: editar ficha de la clienta (datos de contacto y salud, no consentimientos firmados).
create or replace function public.actualizar_cliente(
  p_cliente_id uuid, p_nombre text, p_telefono text, p_email text default null,
  p_notas text default null, p_cuidados_especiales text default null,
  p_contacto_emergencia text default null, p_fecha_nacimiento date default null
)
returns void
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_c record;
begin
  select tenant_id, sede_habitual_id into v_c from public.clientes where id = p_cliente_id;
  if v_c is null then raise exception 'Clienta no encontrada'; end if;
  if not public.tengo_rol_en_tenant(v_c.tenant_id, array['duena','gerente_general','admin_sede','recepcion']) then
    raise exception 'No autorizado';
  end if;
  if p_nombre is null or length(trim(p_nombre)) = 0 then raise exception 'El nombre es obligatorio'; end if;
  if p_telefono is null or length(trim(p_telefono)) = 0 then raise exception 'El teléfono es obligatorio'; end if;

  update public.clientes set
    nombre = trim(p_nombre), telefono = trim(p_telefono),
    email = nullif(trim(coalesce(p_email, '')), ''),
    notas = nullif(trim(coalesce(p_notas, '')), ''),
    cuidados_especiales = nullif(trim(coalesce(p_cuidados_especiales, '')), ''),
    contacto_emergencia = nullif(trim(coalesce(p_contacto_emergencia, '')), ''),
    fecha_nacimiento = p_fecha_nacimiento
  where id = p_cliente_id;
end;
$$;
revoke all on function public.actualizar_cliente(uuid, text, text, text, text, text, text, date) from public;
grant execute on function public.actualizar_cliente(uuid, text, text, text, text, text, text, date) to authenticated;

-- P14: cancelar una clase en una fecha concreta (cierre / feriado). Cancela las reservas
-- confirmadas de ese día y devuelve la clase a cada membresía.
create or replace function public.cancelar_clase_fecha(p_horario_id uuid, p_fecha date)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_h record; v_r record; v_n integer := 0;
begin
  select * into v_h from public.horarios where id = p_horario_id;
  if v_h is null then raise exception 'Horario no encontrado'; end if;
  if not public.staff_puede_en_sede(v_h.tenant_id, v_h.sede_id, array['duena','gerente_general','admin_sede']) then
    raise exception 'No autorizado';
  end if;
  if p_fecha < public.hoy_en_sede(v_h.sede_id) then raise exception 'No se puede cancelar una clase pasada'; end if;

  insert into public.horario_cancelaciones (tenant_id, horario_id, fecha)
    values (v_h.tenant_id, p_horario_id, p_fecha) on conflict (horario_id, fecha) do nothing;

  for v_r in select * from public.reservas
      where horario_id = p_horario_id and fecha = p_fecha and estado = 'confirmada' loop
    update public.reservas set estado = 'cancelada' where id = v_r.id;
    if v_r.tipo = 'regular' then perform public.devolver_clase_a_membresia(v_r.cliente_id); end if;
    v_n := v_n + 1;
  end loop;

  return json_build_object('ok', true, 'reservas_canceladas', v_n);
end;
$$;
revoke all on function public.cancelar_clase_fecha(uuid, date) from public;
grant execute on function public.cancelar_clase_fecha(uuid, date) to authenticated;

create or replace function public.reabrir_clase_fecha(p_horario_id uuid, p_fecha date)
returns void
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_h record;
begin
  select * into v_h from public.horarios where id = p_horario_id;
  if v_h is null then raise exception 'Horario no encontrado'; end if;
  if not public.staff_puede_en_sede(v_h.tenant_id, v_h.sede_id, array['duena','gerente_general','admin_sede']) then
    raise exception 'No autorizado';
  end if;
  delete from public.horario_cancelaciones where horario_id = p_horario_id and fecha = p_fecha;
end;
$$;
revoke all on function public.reabrir_clase_fecha(uuid, date) from public;
grant execute on function public.reabrir_clase_fecha(uuid, date) to authenticated;
