-- Rol "SaaS" de la matriz de permisos (sección 12 del documento maestro, columna "SaaS") -- hasta
-- ahora role_permissions.role ni siquiera aceptaba este valor, y no existia ninguna tabla para
-- identificar a un usuario como operador de la plataforma (distinto de staff de un tenant: un
-- operador no pertenece a ningun tenant_memberships). Cierra P01 (crear/suspender tenant), P02
-- (ver uso tecnico, nunca ventas/datos personales del estudio) y deja la base para P03 (soporte
-- excepcional auditado, no implementado aqui).

alter table public.role_permissions drop constraint role_permissions_role_check;
alter table public.role_permissions add constraint role_permissions_role_check
  check (role in ('saas','duena','gerente_general','admin_sede','recepcion','instructora','contadora','clienta'));

create table public.plataforma_staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  nombre text,
  created_at timestamptz not null default now()
);
alter table public.plataforma_staff enable row level security;
create policy plataforma_staff_select_self on public.plataforma_staff for select using (user_id = auth.uid());
revoke all on public.plataforma_staff from anon, authenticated;
grant select on public.plataforma_staff to authenticated;

create or replace function public.soy_staff_plataforma()
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists(select 1 from public.plataforma_staff where user_id = auth.uid());
$$;
revoke all on function public.soy_staff_plataforma() from public;
grant execute on function public.soy_staff_plataforma() to authenticated;

-- P02: "Sin datos personales, ventas ni ganancias del estudio; agregados tecnicos minimos" --
-- a proposito no se expone ingreso, clientas por nombre ni nada del negocio de cada tenant, solo
-- conteos administrativos (sedes, personal, clientas con cuenta).
create or replace function public.listar_tenants_plataforma()
returns table(
  id uuid, slug text, name text, status text, created_at timestamptz,
  num_sedes bigint, num_staff bigint, num_clientas bigint
)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.soy_staff_plataforma() then raise exception 'No autorizado'; end if;
  return query
  select t.id, t.slug, t.name, t.status, t.created_at,
    (select count(*) from public.sedes s where s.tenant_id = t.id),
    (select count(*) from public.tenant_memberships tm where tm.tenant_id = t.id),
    (select count(*) from public.clientes c where c.tenant_id = t.id and c.user_id is not null)
  from public.tenants t
  order by t.created_at desc;
end;
$$;
revoke all on function public.listar_tenants_plataforma() from public;
grant execute on function public.listar_tenants_plataforma() to authenticated;

create or replace function public.crear_tenant_plataforma(
  p_slug text, p_name text, p_sede_nombre text, p_timezone text default 'America/Guatemala'
)
returns table(tenant_id uuid, sede_id uuid)
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid; v_sede_id uuid;
begin
  if not public.soy_staff_plataforma() then raise exception 'No autorizado'; end if;

  insert into public.tenants (slug, name) values (lower(trim(p_slug)), trim(p_name)) returning id into v_tenant_id;
  insert into public.sedes (tenant_id, name, timezone) values (v_tenant_id, p_sede_nombre, p_timezone) returning id into v_sede_id;

  return query select v_tenant_id, v_sede_id;
end;
$$;
revoke all on function public.crear_tenant_plataforma(text, text, text, text) from public;
grant execute on function public.crear_tenant_plataforma(text, text, text, text) to authenticated;

-- Solo cambia el estado (bandera visible en el panel). Ningun RLS/RPC del resto del sistema
-- consulta todavia tenants.status -- esto NO bloquea el acceso de un tenant suspendido por si
-- solo. Dejar eso para una migracion aparte, bien probada, porque current_tenant_ids() y
-- tengo_rol_en_tenant()/staff_puede_en_sede() son puntos centrales que usa todo el sistema.
create or replace function public.cambiar_estado_tenant_plataforma(p_tenant_id uuid, p_status text)
returns public.tenants
language plpgsql security definer
set search_path to 'public'
as $$
declare v_row public.tenants;
begin
  if not public.soy_staff_plataforma() then raise exception 'No autorizado'; end if;
  if p_status not in ('activo','suspendido','cancelado') then raise exception 'Estado inválido'; end if;
  update public.tenants set status = p_status, updated_at = now() where id = p_tenant_id returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.cambiar_estado_tenant_plataforma(uuid, text) from public;
grant execute on function public.cambiar_estado_tenant_plataforma(uuid, text) to authenticated;
