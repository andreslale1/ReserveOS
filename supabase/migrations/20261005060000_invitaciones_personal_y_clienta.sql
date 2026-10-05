-- Invitación de personal (P06) y activación de login de clienta ya creada por alta asistida
-- (P09). Diseñado para no depender de ningún proveedor de email todavía: usa el signUp público
-- normal de Supabase Auth (sin service_role) + el mailer por defecto de Supabase para la
-- confirmación de correo. Cuando se conecte Resend como SMTP personalizado en el dashboard de
-- Supabase, estos mismos correos empiezan a salir por Resend sin tocar una línea de código acá --
-- es justo lo que se pidió: "dejar todo listo para después solo conectar proveedores".

create table public.invitaciones_personal (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  role text not null check (role in ('gerente_general','admin_sede','recepcion','instructora','contadora')),
  nombre text not null,
  sede_ids uuid[] not null default '{}',
  token uuid not null unique default gen_random_uuid(),
  usado boolean not null default false,
  creado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index invitaciones_personal_tenant_idx on public.invitaciones_personal(tenant_id);
alter table public.invitaciones_personal enable row level security;
create policy invitaciones_personal_select on public.invitaciones_personal
  for select using (tenant_id in (select public.current_tenant_ids()));
revoke all on public.invitaciones_personal from anon, authenticated;
grant select on public.invitaciones_personal to authenticated;

create table public.invitaciones_clienta (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  usado boolean not null default false,
  creado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index invitaciones_clienta_cliente_idx on public.invitaciones_clienta(cliente_id);
alter table public.invitaciones_clienta enable row level security;
revoke all on public.invitaciones_clienta from anon, authenticated;

-- Nota: el "deliberadamente sin rol" -- cualquiera con el token exacto (uuid v4, no adivinable)
-- puede leer los datos minimos de su propia invitacion para mostrar la pantalla de aceptar.
-- No es una fuga: el token hace de credencial, igual que un link de invitacion de cualquier SaaS.

create or replace function public.invitacion_personal_por_token(p_token uuid)
returns table(tenant_id uuid, tenant_name text, email text, role text, nombre text, usado boolean)
language sql stable security definer
set search_path to 'public'
as $$
  select ip.tenant_id, t.name, ip.email, ip.role, ip.nombre, ip.usado
  from public.invitaciones_personal ip join public.tenants t on t.id = ip.tenant_id
  where ip.token = p_token;
$$;
revoke all on function public.invitacion_personal_por_token(uuid) from public;
grant execute on function public.invitacion_personal_por_token(uuid) to authenticated, anon;

create or replace function public.invitacion_clienta_por_token(p_token uuid)
returns table(cliente_id uuid, tenant_name text, email text, nombre text, usado boolean)
language sql stable security definer
set search_path to 'public'
as $$
  select ic.cliente_id, t.name, c.email, c.nombre, ic.usado
  from public.invitaciones_clienta ic
    join public.clientes c on c.id = ic.cliente_id
    join public.tenants t on t.id = c.tenant_id
  where ic.token = p_token;
$$;
revoke all on function public.invitacion_clienta_por_token(uuid) from public;
grant execute on function public.invitacion_clienta_por_token(uuid) to authenticated, anon;

create or replace function public.crear_invitacion_personal(
  p_tenant_id uuid, p_email text, p_role text, p_nombre text, p_sede_ids uuid[] default '{}'
)
returns uuid
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_token uuid;
  v_mi_role text;
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','admin_sede']) then
    raise exception 'No autorizado';
  end if;
  if p_role not in ('gerente_general','admin_sede','recepcion','instructora','contadora') then
    raise exception 'Rol inválido';
  end if;

  select role into v_mi_role from public.tenant_memberships where user_id = auth.uid() and tenant_id = p_tenant_id;
  if v_mi_role = 'admin_sede' and p_role in ('gerente_general','admin_sede') then
    raise exception 'Una administradora de sede no puede invitar a otra administradora ni a gerencia general';
  end if;

  if exists (select 1 from public.tenant_memberships tm join auth.users u on u.id = tm.user_id where tm.tenant_id = p_tenant_id and lower(u.email) = lower(p_email)) then
    raise exception 'Ya hay alguien con ese correo en el equipo de este estudio';
  end if;

  insert into public.invitaciones_personal (tenant_id, email, role, nombre, sede_ids, creado_por)
  values (p_tenant_id, lower(trim(p_email)), p_role, trim(p_nombre), p_sede_ids, auth.uid())
  returning token into v_token;

  return v_token;
end;
$$;
revoke all on function public.crear_invitacion_personal(uuid, text, text, text, uuid[]) from public;
grant execute on function public.crear_invitacion_personal(uuid, text, text, text, uuid[]) to authenticated;

create or replace function public.reclamar_invitacion_personal(p_token uuid)
returns uuid
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_inv record;
  v_mi_email text;
  v_membership_id uuid;
  v_sede uuid;
begin
  select * into v_inv from public.invitaciones_personal where token = p_token;
  if v_inv is null then raise exception 'Invitación no encontrada'; end if;
  if v_inv.usado then raise exception 'Esta invitación ya fue usada'; end if;

  select email into v_mi_email from auth.users where id = auth.uid();
  if v_mi_email is null or lower(v_mi_email) <> v_inv.email then
    raise exception 'Esta invitación es para otro correo';
  end if;

  insert into public.tenant_memberships (tenant_id, user_id, role, nombre)
  values (v_inv.tenant_id, auth.uid(), v_inv.role, v_inv.nombre)
  returning id into v_membership_id;

  foreach v_sede in array v_inv.sede_ids loop
    insert into public.staff_sedes (tenant_membership_id, sede_id) values (v_membership_id, v_sede)
    on conflict do nothing;
  end loop;

  update public.invitaciones_personal set usado = true where id = v_inv.id;

  return v_inv.tenant_id;
end;
$$;
revoke all on function public.reclamar_invitacion_personal(uuid) from public;
grant execute on function public.reclamar_invitacion_personal(uuid) to authenticated;

create or replace function public.crear_invitacion_clienta(p_cliente_id uuid)
returns uuid
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid;
  v_token uuid;
begin
  select tenant_id into v_tenant_id from public.clientes where id = p_cliente_id;
  if v_tenant_id is null then raise exception 'Clienta no encontrada'; end if;
  if not public.tengo_rol_en_tenant(v_tenant_id, array['duena','gerente_general','admin_sede','recepcion']) then
    raise exception 'No autorizado';
  end if;
  if exists (select 1 from public.clientes where id = p_cliente_id and user_id is not null) then
    raise exception 'Esta clienta ya tiene acceso activado';
  end if;

  insert into public.invitaciones_clienta (cliente_id, creado_por)
  values (p_cliente_id, auth.uid())
  returning token into v_token;

  return v_token;
end;
$$;
revoke all on function public.crear_invitacion_clienta(uuid) from public;
grant execute on function public.crear_invitacion_clienta(uuid) to authenticated;

create or replace function public.reclamar_invitacion_clienta(p_token uuid)
returns uuid
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_inv record;
  v_cliente record;
  v_mi_email text;
begin
  select * into v_inv from public.invitaciones_clienta where token = p_token;
  if v_inv is null then raise exception 'Invitación no encontrada'; end if;
  if v_inv.usado then raise exception 'Esta invitación ya fue usada'; end if;

  select * into v_cliente from public.clientes where id = v_inv.cliente_id;
  if v_cliente.user_id is not null then raise exception 'Esta clienta ya tiene acceso activado'; end if;

  select email into v_mi_email from auth.users where id = auth.uid();
  if v_mi_email is null or v_cliente.email is null or lower(v_mi_email) <> lower(v_cliente.email) then
    raise exception 'Esta invitación es para otro correo';
  end if;

  update public.clientes set user_id = auth.uid() where id = v_inv.cliente_id;
  update public.invitaciones_clienta set usado = true where id = v_inv.id;

  return v_cliente.tenant_id;
end;
$$;
revoke all on function public.reclamar_invitacion_clienta(uuid) from public;
grant execute on function public.reclamar_invitacion_clienta(uuid) to authenticated;
