-- Cierra las 5 funciones que quedaron diferidas en el núcleo (Hito C) porque dependían de tablas del
-- módulo "resto" que en ese momento no existían — ya existen (batch "resto tablas"), se portan ahora.

create or replace function public.codigos_activos_por_paquete(p_tenant_id uuid)
returns table(id uuid, codigo text, descuento_pct integer, paquete_ids uuid[])
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then return; end if;
  return query
  select cd.id, cd.codigo, cd.descuento_pct, coalesce(array_agg(cdp.paquete_id) filter (where cdp.paquete_id is not null), '{}')
  from public.codigos_descuento cd
  left join public.codigos_descuento_paquetes cdp on cdp.codigo_id = cd.id
  where cd.tenant_id = p_tenant_id and cd.activo = true
    and (cd.vigente_hasta is null or cd.vigente_hasta >= public.hoy_en_sede(null))
    and (cd.usos_maximos is null or cd.usos_actuales < cd.usos_maximos)
  group by cd.id, cd.codigo, cd.descuento_pct
  order by cd.codigo asc;
end;
$$;
revoke all on function public.codigos_activos_por_paquete(uuid) from public;
grant execute on function public.codigos_activos_por_paquete(uuid) to authenticated;

-- Trigger: si se borra una membresía con código de descuento aplicado, libera ese uso.
create or replace function public._decrementar_uso_codigo_al_borrar_membresia()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
begin
  if old.codigo_descuento_id is not null then
    update public.codigos_descuento set usos_actuales = greatest(usos_actuales - 1, 0) where id = old.codigo_descuento_id;
  end if;
  return old;
end;
$$;
create trigger membresias_decrementar_uso_codigo before delete on public.membresias
  for each row execute function public._decrementar_uso_codigo_al_borrar_membresia();

create or replace function public.agregar_cobro_personalizado(p_tenant_id uuid, p_sede_id uuid, p_cliente_id uuid, p_concepto text, p_monto numeric, p_metodo_pago text)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_cobro_id uuid;
begin
  if not public.staff_puede_en_sede(p_tenant_id, p_sede_id, array['duena','gerente_general']) then
    raise exception 'No autorizado para registrar un cobro personalizado';
  end if;
  if p_concepto is null or trim(p_concepto) = '' then raise exception 'Falta el concepto del cobro'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'El monto debe ser mayor a cero'; end if;
  if p_metodo_pago not in ('transferencia', 'tarjeta_estudio', 'efectivo', 'pasarela') then raise exception 'Método de pago no válido'; end if;
  if not exists (select 1 from public.clientes where id = p_cliente_id and tenant_id = p_tenant_id) then raise exception 'Clienta no encontrada'; end if;

  insert into public.cobros_personalizados (tenant_id, sede_id, cliente_id, concepto, monto, metodo_pago, confirmado_por)
    values (p_tenant_id, p_sede_id, p_cliente_id, trim(p_concepto), p_monto, p_metodo_pago, auth.uid())
    returning id into v_cobro_id;

  return json_build_object('ok', true, 'cobro_id', v_cobro_id);
end;
$$;
revoke all on function public.agregar_cobro_personalizado(uuid, uuid, uuid, text, numeric, text) from public;
grant execute on function public.agregar_cobro_personalizado(uuid, uuid, uuid, text, numeric, text) to authenticated;

-- Cron: avisos operativos de inicio/fin de clase (recorre todos los tenants, service_role).
create or replace function public.horarios_por_comenzar(p_minutos_antes integer default 15)
returns table(tenant_id uuid, horario_id uuid, instructor_membership_id uuid, nombre_clase text, hora_inicio time, fecha date, confirmadas integer)
language sql security definer
set search_path to 'public'
as $$
  select h.tenant_id, h.id, h.instructor_membership_id, h.nombre_clase, h.hora_inicio, public.hoy_en_sede(h.sede_id),
    (select count(*)::int from public.reservas r where r.horario_id = h.id and r.fecha = public.hoy_en_sede(h.sede_id) and r.estado = 'confirmada')
  from public.horarios h
  where h.activo = true
    and h.dia_semana = extract(dow from public.hoy_en_sede(h.sede_id))
    and (public.hoy_en_sede(h.sede_id) + h.hora_inicio) > public.ahora_en_sede(h.sede_id)
    and (public.hoy_en_sede(h.sede_id) + h.hora_inicio) <= public.ahora_en_sede(h.sede_id) + (p_minutos_antes || ' minutes')::interval
    and not exists (select 1 from public.avisos_operativos_enviados a where a.horario_id = h.id and a.fecha = public.hoy_en_sede(h.sede_id) and a.tipo = 'inicio');
$$;
revoke all on function public.horarios_por_comenzar(integer) from public;
grant execute on function public.horarios_por_comenzar(integer) to service_role;

create or replace function public.horarios_por_terminar(p_minutos_antes integer default 10)
returns table(tenant_id uuid, horario_id uuid, instructor_membership_id uuid, nombre_clase text, hora_fin time, fecha date, sin_marcar integer)
language sql security definer
set search_path to 'public'
as $$
  select h.tenant_id, h.id, h.instructor_membership_id, h.nombre_clase, h.hora_fin, public.hoy_en_sede(h.sede_id),
    (select count(*)::int from public.reservas r where r.horario_id = h.id and r.fecha = public.hoy_en_sede(h.sede_id) and r.estado = 'confirmada' and r.asistio is null)
  from public.horarios h
  where h.activo = true
    and h.dia_semana = extract(dow from public.hoy_en_sede(h.sede_id))
    and (public.hoy_en_sede(h.sede_id) + h.hora_fin) > public.ahora_en_sede(h.sede_id)
    and (public.hoy_en_sede(h.sede_id) + h.hora_fin) <= public.ahora_en_sede(h.sede_id) + (p_minutos_antes || ' minutes')::interval
    and not exists (select 1 from public.avisos_operativos_enviados a where a.horario_id = h.id and a.fecha = public.hoy_en_sede(h.sede_id) and a.tipo = 'fin');
$$;
revoke all on function public.horarios_por_terminar(integer) from public;
grant execute on function public.horarios_por_terminar(integer) to service_role;
