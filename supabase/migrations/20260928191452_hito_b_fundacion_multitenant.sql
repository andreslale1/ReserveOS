-- Hito B — fundación multi-tenant de ReserveOS.
-- Orden: identidad/tenants primero, RLS de aislamiento antes que cualquier tabla de negocio
-- (sección 16 del documento maestro). Ninguna tabla de negocio de Forma se porta en esta migración.

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  status text not null default 'activo' check (status in ('activo','suspendido','cancelado')),
  branding jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  domain text unique not null,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.sedes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  timezone text not null default 'America/Guatemala',
  address text,
  status text not null default 'activa' check (status in ('activa','cerrada')),
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('duena','gerente_general','admin_sede','recepcion','instructora','contadora')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table public.staff_sedes (
  tenant_membership_id uuid not null references public.tenant_memberships(id) on delete cascade,
  sede_id uuid not null references public.sedes(id) on delete cascade,
  primary key (tenant_membership_id, sede_id)
);

create table public.module_catalog (
  key text primary key,
  name text not null,
  description text,
  depends_on text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.tenant_entitlements (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  module_key text not null references public.module_catalog(key),
  enabled boolean not null default false,
  params jsonb not null default '{}'::jsonb,
  effective_at timestamptz not null default now(),
  actor uuid references auth.users(id),
  reason text,
  primary key (tenant_id, module_key)
);

create table public.tenant_module_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  module_key text not null references public.module_catalog(key),
  sede_id uuid references public.sedes(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create unique index tenant_module_settings_scope_uidx
  on public.tenant_module_settings (tenant_id, module_key, coalesce(sede_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Una fila por celda de la matriz de permisos (sección 12 del maestro). Estructura lista, sin poblar:
-- las 43 acciones x hasta 8 roles se cargan en el Hito C junto con el servicio de autorización,
-- no se adivinan aquí (regla 5 del maestro: nada se da por hecho sin verificar).
create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('duena','gerente_general','admin_sede','recepcion','instructora','contadora','clienta')),
  action_id text not null,
  scope text not null check (scope in ('P','E','G','S','I','L','C','-')),
  created_at timestamptz not null default now(),
  unique (role, action_id)
);
comment on table public.role_permissions is 'Matriz de permisos (sección 12 del documento maestro), una fila por celda role×action_id (P01..P43). Poblar en Hito C.';

-- updated_at automático solo donde se edita después de creado
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tenants_set_updated_at before update on public.tenants
  for each row execute function public.set_updated_at();
create trigger tenant_module_settings_set_updated_at before update on public.tenant_module_settings
  for each row execute function public.set_updated_at();

-- Aislamiento por tenant: función security definer, propiedad de postgres (bypassa RLS al leer
-- tenant_memberships desde dentro), para que ninguna política tenga que auto-referenciar su propia
-- tabla — el patrón exacto que causó la caída de producción de Forma el 27 de septiembre de 2026.
create or replace function public.current_tenant_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select tenant_id from public.tenant_memberships where user_id = auth.uid();
$$;

revoke all on function public.current_tenant_ids() from public;
grant execute on function public.current_tenant_ids() to authenticated;

-- RLS: habilitado en todas, sin excepción (mismo estándar que Forma real: 46/46 tablas con RLS).
alter table public.tenants enable row level security;
alter table public.tenant_domains enable row level security;
alter table public.sedes enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.staff_sedes enable row level security;
alter table public.module_catalog enable row level security;
alter table public.tenant_entitlements enable row level security;
alter table public.tenant_module_settings enable row level security;
alter table public.role_permissions enable row level security;

-- Catálogo de plataforma (no es dato de tenant): lectura abierta a cualquier usuario autenticado.
create policy module_catalog_read on public.module_catalog for select using (true);
create policy role_permissions_read on public.role_permissions for select using (true);

-- Lectura por pertenencia a tenant. Solo SELECT en este hito — INSERT/UPDATE/DELETE por rol
-- específico se define en el Hito C junto con los flujos reales (alta de sede, invitar personal, etc.),
-- para no escribir política de escritura antes de tener el caso de uso exacto que la ejercita.
create policy tenants_select on public.tenants
  for select using (id in (select public.current_tenant_ids()));
create policy tenant_domains_select on public.tenant_domains
  for select using (tenant_id in (select public.current_tenant_ids()));
create policy sedes_select on public.sedes
  for select using (tenant_id in (select public.current_tenant_ids()));
create policy tenant_memberships_select on public.tenant_memberships
  for select using (tenant_id in (select public.current_tenant_ids()));
create policy staff_sedes_select on public.staff_sedes
  for select using (
    tenant_membership_id in (
      select id from public.tenant_memberships where tenant_id in (select public.current_tenant_ids())
    )
  );
create policy tenant_entitlements_select on public.tenant_entitlements
  for select using (tenant_id in (select public.current_tenant_ids()));
create policy tenant_module_settings_select on public.tenant_module_settings
  for select using (tenant_id in (select public.current_tenant_ids()));

-- GRANT junto con RLS (regla 6 del maestro). El techo de GRANT es amplio a propósito; RLS es la
-- puerta real — sin política de INSERT/UPDATE/DELETE, Postgres deniega esos comandos por defecto
-- aunque el GRANT los permita. Verificado: cero huecos de GRANT en la base real de Forma (ver auditoria/02).
grant select, insert, update, delete on public.tenants to authenticated;
grant select, insert, update, delete on public.tenant_domains to authenticated;
grant select, insert, update, delete on public.sedes to authenticated;
grant select, insert, update, delete on public.tenant_memberships to authenticated;
grant select, insert, update, delete on public.staff_sedes to authenticated;
grant select on public.module_catalog to authenticated;
grant select, insert, update, delete on public.tenant_entitlements to authenticated;
grant select, insert, update, delete on public.tenant_module_settings to authenticated;
grant select on public.role_permissions to authenticated;
