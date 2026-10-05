-- RO-06: catálogo de planes, activación de módulos por estudio con dependencias, límite de sedes y
-- cumplimiento real en la base: cada tabla de un módulo rechaza escrituras (cualquier ruta, incluidas
-- las funciones security definer) y oculta lecturas si el estudio no lo tiene contratado.
-- Desactivar un módulo NUNCA borra su historial.

-- Corrección de un error latente: el disparador de auditoría asumía que toda tabla tiene columna "id",
-- pero tenant_entitlements no la tiene (su clave es tenant_id + module_key), así que cualquier escritura fallaba.
create or replace function public.registrar_accion_admin()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_nombre text;
  v_tenant_id uuid;
  v_row_id text;
  v_j jsonb;
begin
  select nombre into v_actor_nombre from public.tenant_memberships where user_id = v_actor_id
    and tenant_id = coalesce((to_jsonb(new)->>'tenant_id')::uuid, (to_jsonb(old)->>'tenant_id')::uuid);

  if tg_op = 'DELETE' then
    v_j := to_jsonb(old);
    v_tenant_id := (v_j->>'tenant_id')::uuid;
    v_row_id := coalesce(v_j->>'id', v_j->>'module_key', v_j->>'mes');
    insert into public.admin_acciones_log (tenant_id, actor_id, actor_nombre, tabla, operacion, registro_id, detalle)
      values (v_tenant_id, v_actor_id, v_actor_nombre, tg_table_name, 'delete', v_row_id, v_j);
    return old;
  elsif tg_op = 'UPDATE' then
    v_j := to_jsonb(new);
    v_tenant_id := (v_j->>'tenant_id')::uuid;
    v_row_id := coalesce(v_j->>'id', v_j->>'module_key', v_j->>'mes');
    insert into public.admin_acciones_log (tenant_id, actor_id, actor_nombre, tabla, operacion, registro_id, detalle)
      values (v_tenant_id, v_actor_id, v_actor_nombre, tg_table_name, 'update', v_row_id, jsonb_build_object('antes', to_jsonb(old), 'despues', v_j));
    return new;
  else
    v_j := to_jsonb(new);
    v_tenant_id := (v_j->>'tenant_id')::uuid;
    v_row_id := coalesce(v_j->>'id', v_j->>'module_key', v_j->>'mes');
    insert into public.admin_acciones_log (tenant_id, actor_id, actor_nombre, tabla, operacion, registro_id, detalle)
      values (v_tenant_id, v_actor_id, v_actor_nombre, tg_table_name, 'insert', v_row_id, v_j);
    return new;
  end if;
end;
$$;

create table if not exists public.plataforma_planes (
  key text primary key,
  nombre text not null,
  descripcion text,
  precio_mensual numeric not null default 0 check (precio_mensual >= 0),
  max_sedes integer check (max_sedes is null or max_sedes >= 1),
  max_staff integer check (max_staff is null or max_staff >= 1),
  modulos text[] not null default '{}',
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.plataforma_planes enable row level security;
revoke all on public.plataforma_planes from anon, authenticated;

-- Planes propuestos (editables desde la consola; precios en 0 hasta que los definas).
insert into public.plataforma_planes (key, nombre, descripcion, max_sedes, modulos) values
 ('esencial','Esencial','Operación diaria de un estudio.', 1,
   array['nucleo_agenda_reservas','lista_espera','congelacion_membresia','cobros_transferencia','cobros_caja_pos','finanzas_gastos','finanzas_metas','checkin_qr','clases_familia','portal_marca']),
 ('profesional','Profesional','Estudio con tienda, descuentos y CRM.', 3,
   array['nucleo_agenda_reservas','lista_espera','congelacion_membresia','cobros_transferencia','cobros_caja_pos','cobros_reembolsos','finanzas_gastos','finanzas_metas','finanzas_cierre_caja','finanzas_activos_pasivos','checkin_qr','clases_familia','clases_privadas','horario_fijo','portal_marca','calendario_integrado','tienda_inventario','descuentos_gift_cards','crm_segmentos','encuestas','referidos']),
 ('completo','Completo','Todos los módulos, sin límite de sedes.', null,
   (select array_agg(key order by key) from public.module_catalog))
on conflict (key) do nothing;

create or replace function public.modulo_activo(p_tenant_id uuid, p_key text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((select e.enabled and (e.effective_at is null or e.effective_at <= now())
                   from public.tenant_entitlements e where e.tenant_id = p_tenant_id and e.module_key = p_key limit 1), false);
$$;
revoke all on function public.modulo_activo(uuid, text) from public;
grant execute on function public.modulo_activo(uuid, text) to authenticated;

create or replace function public._exigir_modulo(p_tenant_id uuid, p_key text)
returns void language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.modulo_activo(p_tenant_id, p_key) then
    raise exception 'Este estudio no tiene contratado el módulo "%".', coalesce((select name from public.module_catalog where key = p_key), p_key);
  end if;
end $$;
revoke all on function public._exigir_modulo(uuid, text) from public;

-- Módulos activos del estudio del usuario (para que la interfaz oculte lo no contratado).
create or replace function public.mis_modulos(p_tenant_id uuid)
returns text[] language sql stable security definer set search_path to 'public' as $$
  select case when p_tenant_id in (select public.current_tenant_ids())
    then coalesce(array_agg(e.module_key), '{}') else '{}' end
  from public.tenant_entitlements e
  where e.tenant_id = p_tenant_id and e.enabled and (e.effective_at is null or e.effective_at <= now());
$$;
revoke all on function public.mis_modulos(uuid) from public;
grant execute on function public.mis_modulos(uuid) to authenticated;

-- Estado de todos los módulos de un estudio (operador, o dueña/gerente del propio estudio).
create or replace function public.modulos_tenant(p_tenant_id uuid)
returns table(key text, nombre text, descripcion text, depende_de text[], activo boolean)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not (public._plat_ok(array['finanzas','soporte']) or public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general'])) then
    raise exception 'No autorizado';
  end if;
  return query select m.key, m.name, m.description, m.depends_on, public.modulo_activo(p_tenant_id, m.key)
    from public.module_catalog m order by m.name;
end $$;
revoke all on function public.modulos_tenant(uuid) from public;
grant execute on function public.modulos_tenant(uuid) to authenticated;

create or replace function public.set_modulo_tenant(p_tenant_id uuid, p_key text, p_enabled boolean, p_reason text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_dep text; v_dependiente text;
begin
  if not public.soy_staff_plataforma() then raise exception 'No autorizado'; end if;
  if not exists (select 1 from public.module_catalog where key = p_key) then raise exception 'Módulo no existe'; end if;
  if p_reason is null or length(trim(p_reason)) < 3 then raise exception 'Escribe el motivo del cambio'; end if;
  if p_enabled then
    for v_dep in select unnest(depends_on) from public.module_catalog where key = p_key loop
      if not public.modulo_activo(p_tenant_id, v_dep) then
        raise exception 'Primero activa "%" (es requisito de este módulo)', (select name from public.module_catalog where key = v_dep);
      end if;
    end loop;
  else
    select m.name into v_dependiente from public.module_catalog m
      where p_key = any(m.depends_on) and public.modulo_activo(p_tenant_id, m.key) limit 1;
    if v_dependiente is not null then raise exception 'No se puede desactivar: "%" depende de este módulo', v_dependiente; end if;
  end if;
  insert into public.tenant_entitlements (tenant_id, module_key, enabled, actor, reason, effective_at)
    values (p_tenant_id, p_key, p_enabled, auth.uid(), p_reason, now())
  on conflict (tenant_id, module_key) do update set enabled = excluded.enabled, actor = auth.uid(),
    reason = excluded.reason, effective_at = now();
end $$;
revoke all on function public.set_modulo_tenant(uuid, text, boolean, text) from public;
grant execute on function public.set_modulo_tenant(uuid, text, boolean, text) to authenticated;

-- Planes: lectura (operador/finanzas/ventas) y edición (operador).
create or replace function public.planes_listar()
returns setof public.plataforma_planes language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['finanzas','ventas','soporte']) then raise exception 'No autorizado'; end if;
  return query select * from public.plataforma_planes order by precio_mensual, nombre;
end $$;
revoke all on function public.planes_listar() from public;
grant execute on function public.planes_listar() to authenticated;

create or replace function public.plan_guardar(p_key text, p_nombre text, p_descripcion text, p_precio numeric,
  p_max_sedes integer, p_max_staff integer, p_modulos text[], p_activo boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_m text; v_dep text;
begin
  if not public.soy_staff_plataforma() then raise exception 'No autorizado'; end if;
  if p_key !~ '^[a-z0-9_]{2,30}$' then raise exception 'La clave del plan solo admite minúsculas, números y guion bajo'; end if;
  foreach v_m in array coalesce(p_modulos, '{}') loop
    if not exists (select 1 from public.module_catalog where key = v_m) then raise exception 'Módulo desconocido: %', v_m; end if;
    for v_dep in select unnest(depends_on) from public.module_catalog where key = v_m loop
      if not (v_dep = any(p_modulos)) then
        raise exception 'El módulo "%" requiere "%" dentro del mismo plan', v_m, v_dep;
      end if;
    end loop;
  end loop;
  insert into public.plataforma_planes (key, nombre, descripcion, precio_mensual, max_sedes, max_staff, modulos, activo)
    values (p_key, p_nombre, p_descripcion, coalesce(p_precio,0), p_max_sedes, p_max_staff, coalesce(p_modulos,'{}'), coalesce(p_activo,true))
  on conflict (key) do update set nombre = excluded.nombre, descripcion = excluded.descripcion,
    precio_mensual = excluded.precio_mensual, max_sedes = excluded.max_sedes, max_staff = excluded.max_staff,
    modulos = excluded.modulos, activo = excluded.activo;
end $$;
revoke all on function public.plan_guardar(text, text, text, numeric, integer, integer, text[], boolean) from public;
grant execute on function public.plan_guardar(text, text, text, numeric, integer, integer, text[], boolean) to authenticated;

-- Aplicar un plan a un estudio: activa sus módulos, desactiva el resto (sin borrar datos) y sincroniza la suscripción.
create or replace function public.aplicar_plan_tenant(p_tenant_id uuid, p_plan text, p_motivo text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_p record; v_activas integer;
begin
  if not public.soy_staff_plataforma() then raise exception 'No autorizado'; end if;
  select * into v_p from public.plataforma_planes where key = p_plan and activo;
  if v_p is null then raise exception 'Plan no encontrado o inactivo'; end if;
  if p_motivo is null or length(trim(p_motivo)) < 3 then raise exception 'Escribe el motivo del cambio'; end if;
  select count(*) into v_activas from public.sedes where tenant_id = p_tenant_id and status = 'activa';
  if v_p.max_sedes is not null and v_activas > v_p.max_sedes then
    raise exception 'El estudio tiene % sedes activas y el plan % permite %', v_activas, v_p.nombre, v_p.max_sedes;
  end if;
  insert into public.tenant_entitlements (tenant_id, module_key, enabled, actor, reason, effective_at)
    select p_tenant_id, m.key, m.key = any(v_p.modulos), auth.uid(), 'Plan '||v_p.nombre||': '||p_motivo, now()
    from public.module_catalog m
  on conflict (tenant_id, module_key) do update set enabled = excluded.enabled, actor = auth.uid(),
    reason = excluded.reason, effective_at = now();
  insert into public.plataforma_suscripciones (tenant_id, plan, precio_mensual)
    values (p_tenant_id, v_p.key, v_p.precio_mensual)
  on conflict (tenant_id) do update set plan = excluded.plan, updated_at = now();
end $$;
revoke all on function public.aplicar_plan_tenant(uuid, text, text) from public;
grant execute on function public.aplicar_plan_tenant(uuid, text, text) to authenticated;

-- Estudios existentes conservan acceso completo (nada se rompe); los nuevos arrancan con el plan esencial.
insert into public.tenant_entitlements (tenant_id, module_key, enabled, reason, effective_at)
  select t.id, m.key, true, 'Estudio existente: acceso completo al activar planes', now()
  from public.tenants t cross join public.module_catalog m
on conflict (tenant_id, module_key) do nothing;

create or replace function public._plan_inicial_tenant()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.tenant_entitlements (tenant_id, module_key, enabled, reason, effective_at)
    select new.id, m.key, m.key = any(p.modulos), 'Plan inicial Esencial', now()
    from public.module_catalog m, public.plataforma_planes p where p.key = 'esencial'
  on conflict (tenant_id, module_key) do nothing;
  return new;
end $$;
drop trigger if exists tenants_plan_inicial on public.tenants;
create trigger tenants_plan_inicial after insert on public.tenants
  for each row execute function public._plan_inicial_tenant();

-- Límite de sedes según el plan del estudio.
create or replace function public._limite_sedes()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_max integer; v_n integer;
begin
  if new.status <> 'activa' then return new; end if;
  select p.max_sedes into v_max from public.plataforma_suscripciones s
    join public.plataforma_planes p on p.key = s.plan where s.tenant_id = new.tenant_id;
  if v_max is null then return new; end if;
  select count(*) into v_n from public.sedes where tenant_id = new.tenant_id and status = 'activa'
    and id is distinct from new.id;
  if v_n >= v_max then raise exception 'Tu plan permite % sede(s) activa(s). Pide ampliar el plan para abrir otra.', v_max; end if;
  return new;
end $$;
drop trigger if exists sedes_limite on public.sedes;
create trigger sedes_limite before insert or update of status on public.sedes
  for each row execute function public._limite_sedes();

-- Cumplimiento por tabla: escritura bloqueada y lectura oculta sin el módulo.
create or replace function public._guard_modulo()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_t uuid;
begin
  v_t := (to_jsonb(new)->>'tenant_id')::uuid;
  if v_t is not null then perform public._exigir_modulo(v_t, tg_argv[0]); end if;
  return new;
end $$;

do $$
declare
  r record; v_tiene boolean;
begin
  for r in select * from (values
    ('productos','tienda_inventario'),('producto_variantes','tienda_inventario'),('carritos','tienda_inventario'),
    ('carrito_items','tienda_inventario'),('pedidos','tienda_inventario'),('pedido_items','tienda_inventario'),
    ('gift_cards','descuentos_gift_cards'),('codigos_descuento','descuentos_gift_cards'),
    ('codigos_descuento_paquetes','descuentos_gift_cards'),('codigos_descuento_productos','descuentos_gift_cards'),
    ('gastos','finanzas_gastos'),('gasto_marketing','finanzas_gastos'),
    ('activos','finanzas_activos_pasivos'),('pasivos','finanzas_activos_pasivos'),
    ('metas_mensuales','finanzas_metas'),('cierre_caja','cobros_caja_pos'),
    ('lista_espera','lista_espera'),('lista_espera_notificaciones','lista_espera'),
    ('horario_fechas_privadas','clases_privadas'),('horario_fechas_privadas_personas','clases_privadas'),
    ('encuestas_satisfaccion','encuestas'),('comunicados','campanas_marketing'),('whatsapp_mensajes','campanas_marketing'),
    ('horarios','nucleo_agenda_reservas'),('reservas','nucleo_agenda_reservas')
  ) as x(tabla, modulo) loop
    select exists (select 1 from information_schema.columns where table_schema='public' and table_name=r.tabla and column_name='tenant_id') into v_tiene;
    if not v_tiene then continue; end if;
    execute format('drop trigger if exists guard_modulo on public.%I', r.tabla);
    execute format('create trigger guard_modulo before insert or update on public.%I for each row execute function public._guard_modulo(%L)', r.tabla, r.modulo);
    execute format('drop policy if exists modulo_select on public.%I', r.tabla);
    execute format('create policy modulo_select on public.%I as restrictive for select using (public.modulo_activo(tenant_id, %L))', r.tabla, r.modulo);
  end loop;
end $$;
