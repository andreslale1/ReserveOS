-- P35 gastos, P36 activos/pasivos/meta, P04 marca. Las tablas solo tenían política de select
-- (cualquier personal del tenant); ahora la lectura se limita a quienes ven finanzas y toda
-- escritura pasa por RPCs con control de rol.

create or replace function public._nombre_actor(p_tenant_id uuid)
returns text language sql stable security definer set search_path to 'public' as $$
  select nombre from public.tenant_memberships where tenant_id = p_tenant_id and user_id = auth.uid() limit 1
$$;
revoke all on function public._nombre_actor(uuid) from public;

create or replace function public.registrar_gasto(
  p_tenant_id uuid, p_sede_id uuid, p_fecha date, p_categoria text, p_descripcion text,
  p_monto numeric, p_tipo text, p_metodo_pago text default null
) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  if p_sede_id is not null then
    if not exists (select 1 from public.sedes where id = p_sede_id and tenant_id = p_tenant_id) then raise exception 'Sede no válida'; end if;
    if not public.staff_puede_en_sede(p_tenant_id, p_sede_id, array['duena','gerente_general','admin_sede','contadora']) then raise exception 'No autorizado'; end if;
  elsif not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','contadora']) then
    raise exception 'No autorizado';
  end if;
  if p_monto is null or p_monto <= 0 then raise exception 'El monto debe ser mayor a 0'; end if;
  if p_tipo not in ('fijo','variable') then raise exception 'Tipo de gasto no válido'; end if;
  if p_categoria is null or length(trim(p_categoria)) = 0 then raise exception 'La categoría es obligatoria'; end if;
  insert into public.gastos (tenant_id, sede_id, fecha, categoria, descripcion, monto, tipo, metodo_pago)
    values (p_tenant_id, p_sede_id, p_fecha, trim(p_categoria), nullif(trim(coalesce(p_descripcion,'')),''), p_monto, p_tipo, p_metodo_pago)
    returning id into v_id;
  insert into public.admin_acciones_log (tenant_id, actor_id, actor_nombre, tabla, operacion, registro_id, detalle)
    values (p_tenant_id, auth.uid(), public._nombre_actor(p_tenant_id), 'gastos', 'insert', v_id::text,
            jsonb_build_object('monto', p_monto, 'categoria', p_categoria, 'fecha', p_fecha));
  return v_id;
end $$;
revoke all on function public.registrar_gasto(uuid, uuid, date, text, text, numeric, text, text) from public;
grant execute on function public.registrar_gasto(uuid, uuid, date, text, text, numeric, text, text) to authenticated;

create or replace function public.eliminar_gasto(p_gasto_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v record;
begin
  select * into v from public.gastos where id = p_gasto_id;
  if v is null then raise exception 'Gasto no encontrado'; end if;
  if not public.tengo_rol_en_tenant(v.tenant_id, array['duena','gerente_general','contadora']) then raise exception 'No autorizado'; end if;
  delete from public.gastos where id = p_gasto_id;
  insert into public.admin_acciones_log (tenant_id, actor_id, actor_nombre, tabla, operacion, registro_id, detalle)
    values (v.tenant_id, auth.uid(), public._nombre_actor(v.tenant_id), 'gastos', 'delete', p_gasto_id::text, to_jsonb(v));
end $$;
revoke all on function public.eliminar_gasto(uuid) from public;
grant execute on function public.eliminar_gasto(uuid) to authenticated;

-- P36: activos y pasivos (tabla = 'activos' | 'pasivos')
create or replace function public.registrar_activo_pasivo(
  p_tenant_id uuid, p_tabla text, p_descripcion text, p_fecha date, p_monto numeric, p_sede_id uuid default null
) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','contadora']) then raise exception 'No autorizado'; end if;
  if p_tabla not in ('activos','pasivos') then raise exception 'Tipo no válido'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'El monto debe ser mayor a 0'; end if;
  if p_descripcion is null or length(trim(p_descripcion)) = 0 then raise exception 'La descripción es obligatoria'; end if;
  if p_sede_id is not null and not exists (select 1 from public.sedes where id = p_sede_id and tenant_id = p_tenant_id) then raise exception 'Sede no válida'; end if;
  if p_tabla = 'activos' then
    insert into public.activos (tenant_id, sede_id, descripcion, fecha, monto) values (p_tenant_id, p_sede_id, trim(p_descripcion), p_fecha, p_monto) returning id into v_id;
  else
    insert into public.pasivos (tenant_id, sede_id, descripcion, fecha, monto) values (p_tenant_id, p_sede_id, trim(p_descripcion), p_fecha, p_monto) returning id into v_id;
  end if;
  insert into public.admin_acciones_log (tenant_id, actor_id, actor_nombre, tabla, operacion, registro_id, detalle)
    values (p_tenant_id, auth.uid(), public._nombre_actor(p_tenant_id), p_tabla, 'insert', v_id::text, jsonb_build_object('monto', p_monto, 'descripcion', p_descripcion));
  return v_id;
end $$;
revoke all on function public.registrar_activo_pasivo(uuid, text, text, date, numeric, uuid) from public;
grant execute on function public.registrar_activo_pasivo(uuid, text, text, date, numeric, uuid) to authenticated;

create or replace function public.eliminar_activo_pasivo(p_tabla text, p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_tenant uuid;
begin
  if p_tabla = 'activos' then select tenant_id into v_tenant from public.activos where id = p_id;
  elsif p_tabla = 'pasivos' then select tenant_id into v_tenant from public.pasivos where id = p_id;
  else raise exception 'Tipo no válido'; end if;
  if v_tenant is null then raise exception 'Registro no encontrado'; end if;
  if not public.tengo_rol_en_tenant(v_tenant, array['duena','gerente_general','contadora']) then raise exception 'No autorizado'; end if;
  if p_tabla = 'activos' then delete from public.activos where id = p_id; else delete from public.pasivos where id = p_id; end if;
  insert into public.admin_acciones_log (tenant_id, actor_id, actor_nombre, tabla, operacion, registro_id)
    values (v_tenant, auth.uid(), public._nombre_actor(v_tenant), p_tabla, 'delete', p_id::text);
end $$;
revoke all on function public.eliminar_activo_pasivo(text, uuid) from public;
grant execute on function public.eliminar_activo_pasivo(text, uuid) to authenticated;

create or replace function public.definir_meta_mensual(p_tenant_id uuid, p_mes date, p_meta numeric)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then raise exception 'No autorizado'; end if;
  if p_meta is null or p_meta < 0 then raise exception 'La meta no es válida'; end if;
  insert into public.metas_mensuales (tenant_id, mes, tipo, meta, actualizado_por)
    values (p_tenant_id, date_trunc('month', p_mes)::date, 'ingreso', p_meta, auth.uid())
    on conflict (tenant_id, mes, tipo) do update set meta = excluded.meta, actualizado_por = auth.uid();
end $$;
revoke all on function public.definir_meta_mensual(uuid, date, numeric) from public;
grant execute on function public.definir_meta_mensual(uuid, date, numeric) to authenticated;

-- P04: nombre y marca del estudio (colores/logo en branding jsonb).
create or replace function public.actualizar_marca(p_tenant_id uuid, p_nombre text, p_branding jsonb default null)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then raise exception 'No autorizado'; end if;
  if p_nombre is null or length(trim(p_nombre)) = 0 then raise exception 'El nombre es obligatorio'; end if;
  update public.tenants set name = trim(p_nombre),
    branding = case when p_branding is null then branding else branding || p_branding end,
    updated_at = now()
  where id = p_tenant_id;
  insert into public.admin_acciones_log (tenant_id, actor_id, actor_nombre, tabla, operacion, registro_id, detalle)
    values (p_tenant_id, auth.uid(), public._nombre_actor(p_tenant_id), 'tenants', 'update', p_tenant_id::text, jsonb_build_object('nombre', p_nombre, 'branding', p_branding));
end $$;
revoke all on function public.actualizar_marca(uuid, text, jsonb) from public;
grant execute on function public.actualizar_marca(uuid, text, jsonb) to authenticated;

-- Lectura de finanzas: solo roles que ven finanzas (antes: cualquier personal del tenant).
drop policy if exists gastos_select on public.gastos;
create policy gastos_select on public.gastos for select using (public.tengo_rol_en_tenant(tenant_id, array['duena','gerente_general','admin_sede','contadora']));
drop policy if exists activos_select on public.activos;
create policy activos_select on public.activos for select using (public.tengo_rol_en_tenant(tenant_id, array['duena','gerente_general','contadora']));
drop policy if exists pasivos_select on public.pasivos;
create policy pasivos_select on public.pasivos for select using (public.tengo_rol_en_tenant(tenant_id, array['duena','gerente_general','contadora']));
drop policy if exists metas_mensuales_select on public.metas_mensuales;
create policy metas_mensuales_select on public.metas_mensuales for select using (public.tengo_rol_en_tenant(tenant_id, array['duena','gerente_general','admin_sede','contadora']));
