-- Roles nuevos del estudio (gerencia regional, marketing) y delegaciones reales para las acciones marcadas con * en
-- la matriz. Regla única en _exigir_accion(), insertada al inicio de las funciones sensibles. Una delegación nunca
-- es implícita por el nombre del rol: la otorga la dueña, con alcance (persona o rol, sedes) y vencimiento, y se revoca.

-- ---------- Roles nuevos ----------
alter table public.tenant_memberships drop constraint if exists tenant_memberships_role_check;
alter table public.tenant_memberships add constraint tenant_memberships_role_check
  check (role in ('duena','gerente_general','gerente_regional','admin_sede','recepcion','instructora','contadora','marketing'));
alter table public.invitaciones_personal drop constraint if exists invitaciones_personal_role_check;
alter table public.invitaciones_personal add constraint invitaciones_personal_role_check
  check (role in ('gerente_general','gerente_regional','admin_sede','recepcion','instructora','contadora','marketing'));
alter table public.role_permissions drop constraint if exists role_permissions_role_check;

-- Gerencia regional: opera como admin de sede pero sobre un conjunto de sedes asignadas (puede ser varias).
insert into public.role_permissions (role, action_id, scope, requiere_delegacion)
  select 'gerente_regional', action_id, scope, requiere_delegacion from public.role_permissions where role = 'admin_sede'
on conflict do nothing;
-- Marketing del estudio: segmentos y campañas propias; sin finanzas, caja ni edición de fichas.
insert into public.role_permissions (role, action_id, scope, requiere_delegacion) values
  ('marketing','P11','L',false), ('marketing','P41','G',false), ('marketing','P42','G',false), ('marketing','P40','G',true)
on conflict do nothing;

-- Los helpers existentes tratan a la gerencia regional como admin de sede (con sus sedes asignadas).
create or replace function public.tengo_rol_en_tenant(p_tenant_id uuid, p_roles text[])
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.tenant_memberships
      where user_id = auth.uid() and tenant_id = p_tenant_id
        and (role = any(p_roles) or (role = 'gerente_regional' and 'admin_sede' = any(p_roles)))
  );
$$;
create or replace function public.staff_puede_en_sede(p_tenant_id uuid, p_sede_id uuid, p_roles text[])
returns boolean language plpgsql stable security definer set search_path to 'public' as $$
declare v_membership record;
begin
  select id, role into v_membership from public.tenant_memberships
    where user_id = auth.uid() and tenant_id = p_tenant_id
      and (role = any(p_roles) or (role = 'gerente_regional' and 'admin_sede' = any(p_roles)));
  if v_membership is null then return false; end if;
  if v_membership.role in ('duena', 'gerente_general') then return true; end if;
  if p_sede_id is null then return false; end if;
  return exists (select 1 from public.staff_sedes where tenant_membership_id = v_membership.id and sede_id = p_sede_id);
end $$;

-- ---------- Delegaciones ----------
create table if not exists public.delegaciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  otorgada_por uuid not null default auth.uid(),
  beneficiario_membership_id uuid references public.tenant_memberships(id) on delete cascade,
  beneficiario_rol text,
  action_id text not null,
  sede_ids uuid[],
  inicio date not null default current_date,
  vence date,
  motivo text not null,
  revocada_at timestamptz,
  created_at timestamptz not null default now(),
  check ((beneficiario_membership_id is not null) <> (beneficiario_rol is not null))
);
alter table public.delegaciones enable row level security;
create policy delegaciones_select on public.delegaciones for select
  using (public.tengo_rol_en_tenant(tenant_id, array['duena','gerente_general']));
revoke all on public.delegaciones from anon, authenticated;
grant select on public.delegaciones to authenticated;

create or replace function public._delegacion_activa(p_membership uuid, p_rol text, p_tenant uuid, p_sede uuid, p_action text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.delegaciones d
    where d.tenant_id = p_tenant and d.action_id = p_action and d.revocada_at is null
      and d.inicio <= current_date and (d.vence is null or d.vence >= current_date)
      and (d.beneficiario_membership_id = p_membership or d.beneficiario_rol = p_rol)
      and (d.sede_ids is null or p_sede is null or p_sede = any(d.sede_ids)));
$$;

create or replace function public.puede_accion(p_tenant_id uuid, p_sede_id uuid, p_action text)
returns boolean language plpgsql stable security definer set search_path to 'public' as $$
declare m record; rp record;
begin
  select id, role into m from public.tenant_memberships where user_id = auth.uid() and tenant_id = p_tenant_id limit 1;
  if m is null then return false; end if;
  select requiere_delegacion into rp from public.role_permissions where role = m.role and action_id = p_action;
  if not found then return false; end if;
  if rp.requiere_delegacion then return public._delegacion_activa(m.id, m.role, p_tenant_id, p_sede_id, p_action); end if;
  return true;
end $$;
revoke all on function public.puede_accion(uuid, uuid, text) from public;
grant execute on function public.puede_accion(uuid, uuid, text) to authenticated;

create or replace function public._exigir_accion(p_tenant_id uuid, p_sede_id uuid, p_action text)
returns void language plpgsql stable security definer set search_path to 'public' as $$
declare m record; rp record;
begin
  select id, role into m from public.tenant_memberships where user_id = auth.uid() and tenant_id = p_tenant_id limit 1;
  if m is null then raise exception 'No autorizado'; end if;
  select requiere_delegacion into rp from public.role_permissions where role = m.role and action_id = p_action;
  if not found then raise exception 'No autorizado'; end if;
  if rp.requiere_delegacion and not public._delegacion_activa(m.id, m.role, p_tenant_id, p_sede_id, p_action) then
    raise exception 'Esta acción requiere una delegación de la dueña. Pídele que te la otorgue en Delegaciones.';
  end if;
end $$;
revoke all on function public._exigir_accion(uuid, uuid, text) from public;

create or replace function public.delegacion_crear(p_tenant_id uuid, p_membership_id uuid, p_rol text, p_action text, p_sede_ids uuid[], p_vence date, p_motivo text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; v_rol text;
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena']) then raise exception 'Solo la dueña puede delegar'; end if;
  if (p_membership_id is null) = (p_rol is null) then raise exception 'Elige una persona o un rol (no ambos)'; end if;
  if p_motivo is null or length(trim(p_motivo)) < 3 then raise exception 'Escribe el motivo de la delegación'; end if;
  if p_vence is not null and p_vence < current_date then raise exception 'La fecha de vencimiento ya pasó'; end if;
  if p_membership_id is not null then
    select role into v_rol from public.tenant_memberships where id = p_membership_id and tenant_id = p_tenant_id;
    if v_rol is null then raise exception 'Esa persona no pertenece al estudio'; end if;
  else v_rol := p_rol; end if;
  if v_rol = 'duena' then raise exception 'La dueña no necesita delegación'; end if;
  if not exists (select 1 from public.role_permissions where role = v_rol and action_id = p_action and requiere_delegacion) then
    raise exception 'Esa acción no se puede delegar a ese rol (o ya la tiene sin delegación).';
  end if;
  if p_sede_ids is not null and exists (select 1 from unnest(p_sede_ids) s where not exists (select 1 from public.sedes where id = s and tenant_id = p_tenant_id)) then
    raise exception 'Alguna sede no pertenece al estudio';
  end if;
  insert into public.delegaciones (tenant_id, beneficiario_membership_id, beneficiario_rol, action_id, sede_ids, vence, motivo)
    values (p_tenant_id, p_membership_id, p_rol, p_action, p_sede_ids, p_vence, trim(p_motivo)) returning id into v_id;
  insert into public.admin_acciones_log (tenant_id, actor_id, actor_nombre, tabla, operacion, registro_id, detalle)
    values (p_tenant_id, auth.uid(), public._nombre_actor(p_tenant_id), 'delegaciones', 'insert', v_id::text,
            jsonb_build_object('accion', p_action, 'persona', p_membership_id, 'rol', p_rol, 'sedes', p_sede_ids, 'vence', p_vence, 'motivo', p_motivo));
  return v_id;
end $$;
revoke all on function public.delegacion_crear(uuid, uuid, text, text, uuid[], date, text) from public;
grant execute on function public.delegacion_crear(uuid, uuid, text, text, uuid[], date, text) to authenticated;

create or replace function public.delegacion_revocar(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v record;
begin
  select * into v from public.delegaciones where id = p_id;
  if v is null then raise exception 'Delegación no encontrada'; end if;
  if not public.tengo_rol_en_tenant(v.tenant_id, array['duena']) then raise exception 'Solo la dueña puede revocar'; end if;
  update public.delegaciones set revocada_at = now() where id = p_id and revocada_at is null;
  insert into public.admin_acciones_log (tenant_id, actor_id, actor_nombre, tabla, operacion, registro_id, detalle)
    values (v.tenant_id, auth.uid(), public._nombre_actor(v.tenant_id), 'delegaciones', 'revocar', p_id::text, jsonb_build_object('accion', v.action_id));
end $$;
revoke all on function public.delegacion_revocar(uuid) from public;
grant execute on function public.delegacion_revocar(uuid) to authenticated;

-- Acciones delegables por rol (para armar el formulario) y delegaciones vigentes del estudio.
create or replace function public.acciones_delegables()
returns table(role text, action_id text) language sql stable security definer set search_path to 'public' as $$
  select role, action_id from public.role_permissions where requiere_delegacion and role <> 'clienta' order by role, action_id;
$$;
revoke all on function public.acciones_delegables() from public;
grant execute on function public.acciones_delegables() to authenticated;

create or replace function public.delegaciones_listar(p_tenant_id uuid)
returns table(id uuid, persona text, rol text, action_id text, sedes text[], inicio date, vence date, motivo text, revocada_at timestamptz, activa boolean)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then raise exception 'No autorizado'; end if;
  return query select d.id, tm.nombre, coalesce(d.beneficiario_rol, tm.role), d.action_id,
      (select array_agg(s.name order by s.name) from public.sedes s where s.id = any(d.sede_ids)),
      d.inicio, d.vence, d.motivo, d.revocada_at,
      (d.revocada_at is null and d.inicio <= current_date and (d.vence is null or d.vence >= current_date))
    from public.delegaciones d left join public.tenant_memberships tm on tm.id = d.beneficiario_membership_id
    where d.tenant_id = p_tenant_id order by d.created_at desc limit 200;
end $$;
revoke all on function public.delegaciones_listar(uuid) from public;
grant execute on function public.delegaciones_listar(uuid) to authenticated;

-- ---------- Insertar la regla en las funciones sensibles ----------
do $$
declare
  r record; v_oid oid; v_def text; v_m text[]; v_ins text; v_sede text; v_cnt int := 0; v_omit text := '';
begin
  for r in select * from (values
    ('actualizar_marca','P04'), ('crear_sede','P05'), ('cerrar_sede','P05'), ('reabrir_sede','P05'),
    ('crear_invitacion_personal','P06'), ('asignar_sede_personal','P06'), ('quitar_sede_personal','P06'),
    ('crear_paquete','P23'), ('actualizar_paquete','P23'),
    ('ajustar_creditos_membresia','P25'), ('confirmar_pago_membresia','P30'), ('rechazar_membresia_pendiente','P30'),
    ('anular_cobro_membresia','P31'), ('registrar_gasto','P35'), ('registrar_activo_pasivo','P36'),
    ('crear_codigo_descuento','P40'), ('actualizar_codigo_descuento','P40'),
    ('actualizar_horario','P14'), ('cancelar_clase_fecha','P14')
  ) as x(fn, act) loop
    for v_oid in select oid from pg_proc where proname = r.fn and pronamespace = 'public'::regnamespace loop
      v_def := pg_get_functiondef(v_oid);
      if v_def like '%_exigir_accion%' then continue; end if;
      v_m := regexp_match(v_def, 'if not public\.(tengo_rol_en_tenant|staff_puede_en_sede)\(\s*([^,]+?)\s*,\s*([^,]+?)\s*,');
      if v_m is null then v_omit := v_omit || r.fn || ' '; continue; end if;
      v_sede := case when v_m[1] = 'staff_puede_en_sede' then v_m[3] else 'null::uuid' end;
      v_ins := format('perform public._exigir_accion(%s, %s, %L);', v_m[2], v_sede, r.act);
      v_def := regexp_replace(v_def, '(if not public\.(?:tengo_rol_en_tenant|staff_puede_en_sede)\()', v_ins || E'\n  \\1');
      execute v_def;
      v_cnt := v_cnt + 1;
    end loop;
  end loop;
  raise notice 'Funciones protegidas: %, sin patrón reconocido: %', v_cnt, v_omit;
end $$;
