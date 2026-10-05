-- Módulo Plataforma: pipeline de ventas de ReserveOS, suscripción de cada estudio y cobros.
-- Todo se accede solo por RPCs (RLS sin políticas, sin grants directos). Roles internos:
-- operador (todo), ventas (solo pipeline), finanzas (solo cobros y suscripciones), soporte (lectura de estudios).

alter table public.plataforma_staff add column if not exists rol text not null default 'operador';
alter table public.plataforma_staff drop constraint if exists plataforma_staff_rol_check;
alter table public.plataforma_staff add constraint plataforma_staff_rol_check check (rol in ('operador','ventas','finanzas','soporte'));

-- soy_staff_plataforma pasa a significar "operador" (lo usan las funciones existentes de la consola).
create or replace function public.soy_staff_plataforma()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists(select 1 from public.plataforma_staff where user_id = auth.uid() and rol = 'operador');
$$;

create or replace function public._plat_ok(p_roles text[])
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists(select 1 from public.plataforma_staff where user_id = auth.uid() and (rol = 'operador' or rol = any(p_roles)));
$$;
revoke all on function public._plat_ok(text[]) from public;
grant execute on function public._plat_ok(text[]) to authenticated;

create table if not exists public.plataforma_leads (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  contacto text,
  telefono text,
  email text,
  ciudad text,
  tipo text not null default 'estudio',
  valor_mensual numeric not null default 0,
  etapa text not null default 'prospecto' check (etapa in ('prospecto','demo','propuesta','negociacion','ganado','perdido')),
  proximo_paso text,
  proximo_paso_fecha date,
  notas text,
  tenant_id uuid references public.tenants(id) on delete set null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.plataforma_suscripciones (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  plan text not null default 'estandar',
  precio_mensual numeric not null default 0 check (precio_mensual >= 0),
  dia_cobro integer not null default 1 check (dia_cobro between 1 and 28),
  estado text not null default 'activa' check (estado in ('activa','pausada','cancelada')),
  fecha_alta date not null default current_date,
  notas text,
  updated_at timestamptz not null default now()
);
create table if not exists public.plataforma_cobros (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  periodo date not null,
  monto numeric not null check (monto >= 0),
  estado text not null default 'pendiente' check (estado in ('pendiente','pagado','anulado')),
  fecha_vencimiento date not null,
  fecha_pago date,
  metodo text,
  referencia text,
  created_at timestamptz not null default now(),
  unique (tenant_id, periodo)
);
alter table public.plataforma_leads enable row level security;
alter table public.plataforma_suscripciones enable row level security;
alter table public.plataforma_cobros enable row level security;
revoke all on public.plataforma_leads, public.plataforma_suscripciones, public.plataforma_cobros from anon, authenticated;

-- ---------- Pipeline ----------
create or replace function public.plataforma_leads_listar()
returns setof public.plataforma_leads language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['ventas']) then raise exception 'No autorizado'; end if;
  return query select * from public.plataforma_leads order by updated_at desc;
end $$;
revoke all on function public.plataforma_leads_listar() from public;
grant execute on function public.plataforma_leads_listar() to authenticated;

create or replace function public.lead_guardar(
  p_id uuid, p_nombre text, p_contacto text, p_telefono text, p_email text, p_ciudad text, p_tipo text,
  p_valor_mensual numeric, p_etapa text, p_proximo_paso text, p_proximo_paso_fecha date, p_notas text
) returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  if not public._plat_ok(array['ventas']) then raise exception 'No autorizado'; end if;
  if p_nombre is null or length(trim(p_nombre)) = 0 then raise exception 'El nombre es obligatorio'; end if;
  if p_etapa not in ('prospecto','demo','propuesta','negociacion','ganado','perdido') then raise exception 'Etapa no válida'; end if;
  if p_id is null then
    insert into public.plataforma_leads (nombre, contacto, telefono, email, ciudad, tipo, valor_mensual, etapa, proximo_paso, proximo_paso_fecha, notas)
    values (trim(p_nombre), p_contacto, p_telefono, p_email, p_ciudad, coalesce(nullif(p_tipo,''),'estudio'), coalesce(p_valor_mensual,0), p_etapa, p_proximo_paso, p_proximo_paso_fecha, p_notas)
    returning id into v_id;
  else
    update public.plataforma_leads set nombre = trim(p_nombre), contacto = p_contacto, telefono = p_telefono, email = p_email,
      ciudad = p_ciudad, tipo = coalesce(nullif(p_tipo,''),'estudio'), valor_mensual = coalesce(p_valor_mensual,0), etapa = p_etapa,
      proximo_paso = p_proximo_paso, proximo_paso_fecha = p_proximo_paso_fecha, notas = p_notas, updated_at = now()
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Prospecto no encontrado'; end if;
  end if;
  return v_id;
end $$;
revoke all on function public.lead_guardar(uuid, text, text, text, text, text, text, numeric, text, text, date, text) from public;
grant execute on function public.lead_guardar(uuid, text, text, text, text, text, text, numeric, text, text, date, text) to authenticated;

create or replace function public.lead_cambiar_etapa(p_id uuid, p_etapa text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['ventas']) then raise exception 'No autorizado'; end if;
  if p_etapa not in ('prospecto','demo','propuesta','negociacion','ganado','perdido') then raise exception 'Etapa no válida'; end if;
  update public.plataforma_leads set etapa = p_etapa, updated_at = now() where id = p_id;
end $$;
revoke all on function public.lead_cambiar_etapa(uuid, text) from public;
grant execute on function public.lead_cambiar_etapa(uuid, text) to authenticated;

create or replace function public.lead_eliminar(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['ventas']) then raise exception 'No autorizado'; end if;
  delete from public.plataforma_leads where id = p_id;
end $$;
revoke all on function public.lead_eliminar(uuid) from public;
grant execute on function public.lead_eliminar(uuid) to authenticated;

-- ---------- Suscripciones y cobros ----------
create or replace function public.suscripcion_guardar(p_tenant_id uuid, p_plan text, p_precio_mensual numeric, p_dia_cobro integer, p_estado text, p_notas text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['finanzas']) then raise exception 'No autorizado'; end if;
  if not exists (select 1 from public.tenants where id = p_tenant_id) then raise exception 'Estudio no encontrado'; end if;
  if p_estado not in ('activa','pausada','cancelada') then raise exception 'Estado no válido'; end if;
  insert into public.plataforma_suscripciones (tenant_id, plan, precio_mensual, dia_cobro, estado, notas)
    values (p_tenant_id, coalesce(nullif(p_plan,''),'estandar'), p_precio_mensual, p_dia_cobro, p_estado, p_notas)
  on conflict (tenant_id) do update set plan = excluded.plan, precio_mensual = excluded.precio_mensual,
    dia_cobro = excluded.dia_cobro, estado = excluded.estado, notas = excluded.notas, updated_at = now();
end $$;
revoke all on function public.suscripcion_guardar(uuid, text, numeric, integer, text, text) from public;
grant execute on function public.suscripcion_guardar(uuid, text, numeric, integer, text, text) to authenticated;

create or replace function public.generar_cobros_mes(p_periodo date)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_n integer; v_per date := date_trunc('month', p_periodo)::date;
begin
  if not public._plat_ok(array['finanzas']) then raise exception 'No autorizado'; end if;
  insert into public.plataforma_cobros (tenant_id, periodo, monto, fecha_vencimiento)
  select s.tenant_id, v_per, s.precio_mensual, v_per + (s.dia_cobro - 1)
  from public.plataforma_suscripciones s
  where s.estado = 'activa' and s.precio_mensual > 0
  on conflict (tenant_id, periodo) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.generar_cobros_mes(date) from public;
grant execute on function public.generar_cobros_mes(date) to authenticated;

create or replace function public.registrar_pago_cobro(p_cobro_id uuid, p_metodo text, p_referencia text, p_fecha date)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['finanzas']) then raise exception 'No autorizado'; end if;
  update public.plataforma_cobros set estado = 'pagado', metodo = p_metodo, referencia = p_referencia,
    fecha_pago = coalesce(p_fecha, current_date) where id = p_cobro_id and estado = 'pendiente';
  if not found then raise exception 'El cobro no existe o ya no está pendiente'; end if;
end $$;
revoke all on function public.registrar_pago_cobro(uuid, text, text, date) from public;
grant execute on function public.registrar_pago_cobro(uuid, text, text, date) to authenticated;

create or replace function public.anular_cobro_plataforma(p_cobro_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['finanzas']) then raise exception 'No autorizado'; end if;
  update public.plataforma_cobros set estado = 'anulado' where id = p_cobro_id and estado = 'pendiente';
  if not found then raise exception 'Solo se anulan cobros pendientes'; end if;
end $$;
revoke all on function public.anular_cobro_plataforma(uuid) from public;
grant execute on function public.anular_cobro_plataforma(uuid) to authenticated;

-- Una fila por estudio: suscripción, saldo y mora.
create or replace function public.plataforma_estudios_cobro()
returns table(tenant_id uuid, nombre text, slug text, status text, plan text, precio_mensual numeric, sub_estado text,
  pendiente numeric, en_mora numeric, dias_mora integer, ultimo_pago date)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['finanzas','soporte']) then raise exception 'No autorizado'; end if;
  return query
  select t.id, t.name, t.slug, t.status, s.plan, s.precio_mensual, s.estado,
    coalesce((select sum(c.monto) from public.plataforma_cobros c where c.tenant_id = t.id and c.estado = 'pendiente'), 0),
    coalesce((select sum(c.monto) from public.plataforma_cobros c where c.tenant_id = t.id and c.estado = 'pendiente' and c.fecha_vencimiento < current_date), 0),
    coalesce((select max(current_date - c.fecha_vencimiento) from public.plataforma_cobros c where c.tenant_id = t.id and c.estado = 'pendiente' and c.fecha_vencimiento < current_date), 0)::integer,
    (select max(c.fecha_pago) from public.plataforma_cobros c where c.tenant_id = t.id and c.estado = 'pagado')
  from public.tenants t left join public.plataforma_suscripciones s on s.tenant_id = t.id
  order by 9 desc, t.name;
end $$;
revoke all on function public.plataforma_estudios_cobro() from public;
grant execute on function public.plataforma_estudios_cobro() to authenticated;

create or replace function public.plataforma_cobros_listar(p_estado text default null)
returns table(id uuid, tenant_id uuid, estudio text, periodo date, monto numeric, estado text, fecha_vencimiento date,
  fecha_pago date, metodo text, referencia text, en_mora boolean)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['finanzas']) then raise exception 'No autorizado'; end if;
  return query
  select c.id, c.tenant_id, t.name, c.periodo, c.monto, c.estado, c.fecha_vencimiento, c.fecha_pago, c.metodo, c.referencia,
    (c.estado = 'pendiente' and c.fecha_vencimiento < current_date)
  from public.plataforma_cobros c join public.tenants t on t.id = c.tenant_id
  where p_estado is null or c.estado = p_estado
  order by c.periodo desc, t.name;
end $$;
revoke all on function public.plataforma_cobros_listar(text) from public;
grant execute on function public.plataforma_cobros_listar(text) to authenticated;

create or replace function public.plataforma_resumen()
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare v json;
begin
  if not public._plat_ok(array['finanzas','ventas','soporte']) then raise exception 'No autorizado'; end if;
  select json_build_object(
    'estudios_activos', (select count(*) from public.tenants where status = 'activo'),
    'mrr', coalesce((select sum(precio_mensual) from public.plataforma_suscripciones where estado = 'activa'), 0),
    'cobrado_mes', coalesce((select sum(monto) from public.plataforma_cobros where estado = 'pagado' and date_trunc('month', fecha_pago) = date_trunc('month', current_date)), 0),
    'por_cobrar', coalesce((select sum(monto) from public.plataforma_cobros where estado = 'pendiente'), 0),
    'en_mora', coalesce((select sum(monto) from public.plataforma_cobros where estado = 'pendiente' and fecha_vencimiento < current_date), 0),
    'estudios_en_mora', (select count(distinct tenant_id) from public.plataforma_cobros where estado = 'pendiente' and fecha_vencimiento < current_date),
    'leads_abiertos', (select count(*) from public.plataforma_leads where etapa not in ('ganado','perdido')),
    'valor_pipeline', coalesce((select sum(valor_mensual) from public.plataforma_leads where etapa not in ('ganado','perdido')), 0)
  ) into v;
  return v;
end $$;
revoke all on function public.plataforma_resumen() from public;
grant execute on function public.plataforma_resumen() to authenticated;

-- ---------- Para la dueña: su propia suscripción ----------
create or replace function public.mi_suscripcion(p_tenant_id uuid)
returns json language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then return null; end if;
  return json_build_object(
    'suscripcion', (select to_json(s) from (select plan, precio_mensual, dia_cobro, estado, fecha_alta from public.plataforma_suscripciones where tenant_id = p_tenant_id) s),
    'cobros', coalesce((select json_agg(c order by c.periodo desc) from (
        select periodo, monto, estado, fecha_vencimiento, fecha_pago
        from public.plataforma_cobros where tenant_id = p_tenant_id and estado <> 'anulado'
        order by periodo desc limit 12) c), '[]'::json)
  );
end $$;
revoke all on function public.mi_suscripcion(uuid) from public;
grant execute on function public.mi_suscripcion(uuid) to authenticated;
