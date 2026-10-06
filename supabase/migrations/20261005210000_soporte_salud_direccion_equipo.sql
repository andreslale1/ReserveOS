-- RO-01 / RO-08 / RO-09 y roles internos: tickets e incidentes, salud técnica por estudio, tablero de
-- dirección, equipo interno con roles ampliados y auditoría de plataforma.
-- El diagnóstico usa metadatos: ningún ticket ni indicador de salud expone fichas de clientas ni caja del estudio.

-- ---------- Roles internos ----------
alter table public.plataforma_staff drop constraint if exists plataforma_staff_rol_check;
alter table public.plataforma_staff add constraint plataforma_staff_rol_check
  check (rol in ('operador','ventas','finanzas','soporte','implementacion','ingenieria','marketing','auditor'));

-- implementación e ingeniería actúan como soporte (diagnóstico con datos mínimos); el resto es explícito.
create or replace function public._plat_ok(p_roles text[])
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists(select 1 from public.plataforma_staff s where s.user_id = auth.uid() and (
    s.rol = 'operador' or s.rol = any(p_roles)
    or (s.rol in ('implementacion','ingenieria') and 'soporte' = any(p_roles))));
$$;

create or replace function public.mi_rol_plataforma()
returns text language sql stable security definer set search_path to 'public' as $$
  select rol from public.plataforma_staff where user_id = auth.uid() limit 1
$$;
revoke all on function public.mi_rol_plataforma() from public;
grant execute on function public.mi_rol_plataforma() to authenticated;

create or replace function public.equipo_listar()
returns table(user_id uuid, nombre text, email text, rol text, created_at timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['auditor']) then raise exception 'No autorizado'; end if;
  return query select s.user_id, s.nombre, u.email::text, s.rol, s.created_at
    from public.plataforma_staff s join auth.users u on u.id = s.user_id order by s.created_at;
end $$;
revoke all on function public.equipo_listar() from public;
grant execute on function public.equipo_listar() to authenticated;

-- Solo el operador gestiona el equipo. La persona debe tener ya una cuenta (se registra con su correo).
create or replace function public.equipo_guardar(p_email text, p_nombre text, p_rol text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid;
begin
  if not public.soy_staff_plataforma() then raise exception 'Solo el operador gestiona el equipo'; end if;
  if p_rol not in ('operador','ventas','finanzas','soporte','implementacion','ingenieria','marketing','auditor') then raise exception 'Rol no válido'; end if;
  select id into v_uid from auth.users where lower(email) = lower(trim(p_email));
  if v_uid is null then raise exception 'No existe una cuenta con ese correo. La persona debe crear su cuenta primero.'; end if;
  if v_uid = auth.uid() and p_rol <> 'operador'
     and (select count(*) from public.plataforma_staff where rol = 'operador') <= 1 then
    raise exception 'Eres el único operador; no puedes quitarte ese rol';
  end if;
  insert into public.plataforma_staff (user_id, nombre, rol) values (v_uid, nullif(trim(coalesce(p_nombre,'')),''), p_rol)
  on conflict (user_id) do update set rol = excluded.rol, nombre = coalesce(excluded.nombre, public.plataforma_staff.nombre);
end $$;
revoke all on function public.equipo_guardar(text, text, text) from public;
grant execute on function public.equipo_guardar(text, text, text) to authenticated;

create or replace function public.equipo_quitar(p_user_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.soy_staff_plataforma() then raise exception 'Solo el operador gestiona el equipo'; end if;
  if (select rol from public.plataforma_staff where user_id = p_user_id) = 'operador'
     and (select count(*) from public.plataforma_staff where rol = 'operador') <= 1 then
    raise exception 'No puedes quitar al único operador';
  end if;
  delete from public.plataforma_staff where user_id = p_user_id;
end $$;
revoke all on function public.equipo_quitar(uuid) from public;
grant execute on function public.equipo_quitar(uuid) to authenticated;

-- ---------- Tickets ----------
create table if not exists public.plataforma_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  asunto text not null,
  descripcion text,
  prioridad text not null default 'normal' check (prioridad in ('baja','normal','alta','urgente')),
  estado text not null default 'abierto' check (estado in ('abierto','en_curso','esperando','resuelto','cerrado')),
  canal text not null default 'panel',
  sede_nombre text,
  version text,
  causa text,
  abierto_por uuid default auth.uid(),
  abierto_por_nombre text,
  asignado_a text,
  sla_vence timestamptz not null,
  resuelto_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.plataforma_ticket_mensajes (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.plataforma_tickets(id) on delete cascade,
  autor_nombre text,
  es_equipo boolean not null default false,
  interno boolean not null default false,
  mensaje text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.plataforma_incidentes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  severidad text not null default 'menor' check (severidad in ('menor','mayor','critico')),
  estado text not null default 'investigando' check (estado in ('investigando','identificado','monitoreando','resuelto')),
  tenant_id uuid references public.tenants(id) on delete cascade,
  started_at timestamptz not null default now(),
  resolved_at timestamptz,
  updates jsonb not null default '[]'
);
alter table public.plataforma_tickets enable row level security;
alter table public.plataforma_ticket_mensajes enable row level security;
alter table public.plataforma_incidentes enable row level security;
revoke all on public.plataforma_tickets, public.plataforma_ticket_mensajes, public.plataforma_incidentes from anon, authenticated;

create or replace function public._sla_horas(p text)
returns integer language sql immutable as $$ select case p when 'urgente' then 4 when 'alta' then 8 when 'normal' then 24 else 72 end $$;

-- Lado estudio: dueña, gerente y admin de sede abren y siguen sus casos.
create or replace function public.ticket_crear(p_tenant_id uuid, p_asunto text, p_descripcion text, p_prioridad text, p_sede_nombre text, p_version text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; v_nom text;
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','admin_sede']) then raise exception 'No autorizado'; end if;
  if p_asunto is null or length(trim(p_asunto)) < 4 then raise exception 'Escribe un asunto'; end if;
  if p_prioridad not in ('baja','normal','alta','urgente') then raise exception 'Prioridad no válida'; end if;
  select nombre into v_nom from public.tenant_memberships where tenant_id = p_tenant_id and user_id = auth.uid() limit 1;
  insert into public.plataforma_tickets (tenant_id, asunto, descripcion, prioridad, sede_nombre, version, abierto_por_nombre, sla_vence)
    values (p_tenant_id, trim(p_asunto), p_descripcion, p_prioridad, p_sede_nombre, p_version, v_nom,
            now() + make_interval(hours => public._sla_horas(p_prioridad)))
    returning id into v_id;
  if p_descripcion is not null and length(trim(p_descripcion)) > 0 then
    insert into public.plataforma_ticket_mensajes (ticket_id, autor_nombre, es_equipo, mensaje) values (v_id, v_nom, false, trim(p_descripcion));
  end if;
  return v_id;
end $$;
revoke all on function public.ticket_crear(uuid, text, text, text, text, text) from public;
grant execute on function public.ticket_crear(uuid, text, text, text, text, text) to authenticated;

create or replace function public.mis_tickets(p_tenant_id uuid)
returns table(id uuid, asunto text, prioridad text, estado text, created_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','admin_sede']) then raise exception 'No autorizado'; end if;
  return query select t.id, t.asunto, t.prioridad, t.estado, t.created_at, t.updated_at
    from public.plataforma_tickets t where t.tenant_id = p_tenant_id order by t.created_at desc;
end $$;
revoke all on function public.mis_tickets(uuid) from public;
grant execute on function public.mis_tickets(uuid) to authenticated;

create or replace function public.mi_ticket_detalle(p_ticket_id uuid)
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare v_t record;
begin
  select * into v_t from public.plataforma_tickets where id = p_ticket_id;
  if v_t is null or not public.tengo_rol_en_tenant(v_t.tenant_id, array['duena','gerente_general','admin_sede']) then return null; end if;
  return json_build_object('ticket', json_build_object('id', v_t.id, 'asunto', v_t.asunto, 'estado', v_t.estado, 'prioridad', v_t.prioridad, 'created_at', v_t.created_at),
    'mensajes', coalesce((select json_agg(m order by m.created_at) from (select autor_nombre, es_equipo, mensaje, created_at
       from public.plataforma_ticket_mensajes where ticket_id = p_ticket_id and not interno order by created_at) m), '[]'::json));
end $$;
revoke all on function public.mi_ticket_detalle(uuid) from public;
grant execute on function public.mi_ticket_detalle(uuid) to authenticated;

create or replace function public.ticket_mensaje_estudio(p_ticket_id uuid, p_mensaje text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_t record; v_nom text;
begin
  select * into v_t from public.plataforma_tickets where id = p_ticket_id;
  if v_t is null or not public.tengo_rol_en_tenant(v_t.tenant_id, array['duena','gerente_general','admin_sede']) then raise exception 'No autorizado'; end if;
  if p_mensaje is null or length(trim(p_mensaje)) = 0 then raise exception 'Escribe el mensaje'; end if;
  select nombre into v_nom from public.tenant_memberships where tenant_id = v_t.tenant_id and user_id = auth.uid() limit 1;
  insert into public.plataforma_ticket_mensajes (ticket_id, autor_nombre, es_equipo, mensaje) values (p_ticket_id, v_nom, false, trim(p_mensaje));
  update public.plataforma_tickets set updated_at = now(), estado = case when estado in ('esperando','resuelto') then 'abierto' else estado end where id = p_ticket_id;
end $$;
revoke all on function public.ticket_mensaje_estudio(uuid, text) from public;
grant execute on function public.ticket_mensaje_estudio(uuid, text) to authenticated;

-- Lado ReserveOS.
create or replace function public.tickets_listar(p_abiertos boolean default true)
returns table(id uuid, estudio text, asunto text, prioridad text, estado text, asignado_a text, sla_vence timestamptz, sla_vencido boolean, created_at timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['soporte']) then raise exception 'No autorizado'; end if;
  return query select t.id, te.name, t.asunto, t.prioridad, t.estado, t.asignado_a, t.sla_vence,
    (t.estado in ('abierto','en_curso') and t.sla_vence < now()), t.created_at
    from public.plataforma_tickets t join public.tenants te on te.id = t.tenant_id
    where (not p_abiertos) or t.estado not in ('resuelto','cerrado')
    order by (t.estado in ('resuelto','cerrado')), array_position(array['urgente','alta','normal','baja'], t.prioridad), t.sla_vence;
end $$;
revoke all on function public.tickets_listar(boolean) from public;
grant execute on function public.tickets_listar(boolean) to authenticated;

create or replace function public.ticket_detalle(p_id uuid)
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare v_t record;
begin
  if not public._plat_ok(array['soporte']) then raise exception 'No autorizado'; end if;
  select t.*, te.name as estudio into v_t from public.plataforma_tickets t join public.tenants te on te.id = t.tenant_id where t.id = p_id;
  if v_t is null then return null; end if;
  return json_build_object('ticket', to_json(v_t),
    'mensajes', coalesce((select json_agg(m order by m.created_at) from public.plataforma_ticket_mensajes m where m.ticket_id = p_id), '[]'::json));
end $$;
revoke all on function public.ticket_detalle(uuid) from public;
grant execute on function public.ticket_detalle(uuid) to authenticated;

create or replace function public.ticket_responder(p_id uuid, p_mensaje text, p_interno boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['soporte']) then raise exception 'No autorizado'; end if;
  if p_mensaje is null or length(trim(p_mensaje)) = 0 then raise exception 'Escribe el mensaje'; end if;
  insert into public.plataforma_ticket_mensajes (ticket_id, autor_nombre, es_equipo, interno, mensaje)
    values (p_id, public._plat_nombre(), true, coalesce(p_interno,false), trim(p_mensaje));
  update public.plataforma_tickets set updated_at = now(),
    estado = case when not coalesce(p_interno,false) and estado = 'abierto' then 'en_curso' else estado end where id = p_id;
end $$;
revoke all on function public.ticket_responder(uuid, text, boolean) from public;
grant execute on function public.ticket_responder(uuid, text, boolean) to authenticated;

create or replace function public.ticket_actualizar(p_id uuid, p_estado text, p_prioridad text, p_asignado text, p_causa text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['soporte']) then raise exception 'No autorizado'; end if;
  if p_estado not in ('abierto','en_curso','esperando','resuelto','cerrado') then raise exception 'Estado no válido'; end if;
  if p_estado in ('resuelto','cerrado') and (p_causa is null or length(trim(p_causa)) < 3) then raise exception 'Indica la causa antes de resolver'; end if;
  update public.plataforma_tickets set estado = p_estado, prioridad = p_prioridad, asignado_a = nullif(trim(coalesce(p_asignado,'')),''),
    causa = nullif(trim(coalesce(p_causa,'')),''), updated_at = now(),
    resuelto_at = case when p_estado in ('resuelto','cerrado') then coalesce(resuelto_at, now()) else null end where id = p_id;
end $$;
revoke all on function public.ticket_actualizar(uuid, text, text, text, text) from public;
grant execute on function public.ticket_actualizar(uuid, text, text, text, text) to authenticated;

-- ---------- Incidentes ----------
create or replace function public.incidente_guardar(p_id uuid, p_titulo text, p_descripcion text, p_severidad text, p_estado text, p_tenant_id uuid, p_nota text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  if not public._plat_ok(array['soporte']) then raise exception 'No autorizado'; end if;
  if p_titulo is null or length(trim(p_titulo)) < 3 then raise exception 'Escribe el título'; end if;
  if p_id is null then
    insert into public.plataforma_incidentes (titulo, descripcion, severidad, estado, tenant_id)
      values (trim(p_titulo), p_descripcion, p_severidad, p_estado, p_tenant_id) returning id into v_id;
  else
    update public.plataforma_incidentes set titulo = trim(p_titulo), descripcion = p_descripcion, severidad = p_severidad, estado = p_estado,
      resolved_at = case when p_estado = 'resuelto' then coalesce(resolved_at, now()) else null end,
      updates = case when p_nota is not null and length(trim(p_nota)) > 0
        then updates || jsonb_build_array(jsonb_build_object('fecha', now(), 'estado', p_estado, 'nota', trim(p_nota), 'autor', public._plat_nombre())) else updates end
      where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;
revoke all on function public.incidente_guardar(uuid, text, text, text, text, uuid, text) from public;
grant execute on function public.incidente_guardar(uuid, text, text, text, text, uuid, text) to authenticated;

create or replace function public.incidentes_listar()
returns setof public.plataforma_incidentes language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['soporte']) then raise exception 'No autorizado'; end if;
  return query select * from public.plataforma_incidentes order by (estado = 'resuelto'), started_at desc limit 60;
end $$;
revoke all on function public.incidentes_listar() from public;
grant execute on function public.incidentes_listar() to authenticated;

-- Aviso para el personal del estudio: incidentes abiertos globales o que lo afectan.
create or replace function public.incidentes_activos(p_tenant_id uuid)
returns table(titulo text, severidad text, estado text, started_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select i.titulo, i.severidad, i.estado, i.started_at from public.plataforma_incidentes i
  where i.estado <> 'resuelto' and (i.tenant_id is null or i.tenant_id = p_tenant_id)
    and p_tenant_id in (select public.current_tenant_ids()) order by i.started_at desc limit 3;
$$;
revoke all on function public.incidentes_activos(uuid) from public;
grant execute on function public.incidentes_activos(uuid) to authenticated;

-- ---------- Salud técnica ----------
create or replace function public.plataforma_salud()
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare v_cron json; v_estudios json; v_mig text;
begin
  if not public._plat_ok(array['soporte']) then raise exception 'No autorizado'; end if;
  select max(version) into v_mig from supabase_migrations.schema_migrations;
  select coalesce(json_agg(x), '[]'::json) into v_cron from (
    select j.jobname, j.schedule,
      (select d.status from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1) as ultimo_estado,
      (select d.start_time from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1) as ultima_ejecucion,
      (select count(*) from cron.job_run_details d where d.jobid = j.jobid and d.status = 'failed' and d.start_time > now() - interval '24 hours') as fallos_24h
    from cron.job j order by j.jobname) x;
  select coalesce(json_agg(e order by e.orden desc, e.estudio), '[]'::json) into v_estudios from (
    select t.id as tenant_id, t.name as estudio, t.status,
      (select coalesce(sum(l.veces),0) from public.error_logs l where l.tenant_id = t.id and not l.resuelto and l.ultima_vez > now() - interval '24 hours') as errores_24h,
      (select max(l.ultima_vez) from public.error_logs l where l.tenant_id = t.id and not l.resuelto) as ultimo_error,
      (select count(*) from public.reservas r where r.tenant_id = t.id and r.created_at > now() - interval '24 hours') as reservas_24h,
      (select count(*) from public.membresias m where m.tenant_id = t.id and m.estado = 'pendiente_pago' and m.created_at < now() - interval '3 days') as pagos_sin_revisar,
      (select count(*) from public.plataforma_tickets k where k.tenant_id = t.id and k.estado in ('abierto','en_curso')) as tickets_abiertos,
      (select max(r.created_at) from public.reservas r where r.tenant_id = t.id) as ultima_reserva,
      case when t.status <> 'activo' then 0
        when (select coalesce(sum(l.veces),0) from public.error_logs l where l.tenant_id = t.id and not l.resuelto and l.ultima_vez > now() - interval '24 hours') >= 10 then 3
        when (select coalesce(sum(l.veces),0) from public.error_logs l where l.tenant_id = t.id and not l.resuelto and l.ultima_vez > now() - interval '24 hours') > 0
          or (select count(*) from public.membresias m where m.tenant_id = t.id and m.estado = 'pendiente_pago' and m.created_at < now() - interval '3 days') > 0 then 2
        else 1 end as orden
    from public.tenants t) e;
  return json_build_object('base_ok', true, 'ultima_migracion', v_mig, 'cron', v_cron, 'estudios', v_estudios, 'medido_at', now());
end $$;
revoke all on function public.plataforma_salud() from public;
grant execute on function public.plataforma_salud() to authenticated;

-- ---------- Tablero de dirección ----------
create or replace function public.plataforma_direccion()
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare v json;
begin
  if not public._plat_ok(array['ventas','finanzas','soporte']) then raise exception 'No autorizado'; end if;
  select json_build_object(
    'tareas_vencidas', (select count(*) from public.plataforma_tareas where estado = 'pendiente' and vence < current_date),
    'tareas_hoy', (select count(*) from public.plataforma_tareas where estado = 'pendiente' and vence = current_date),
    'seguimientos_vencidos', coalesce((select json_agg(x) from (select id, nombre, proximo_paso, proximo_paso_fecha from public.plataforma_leads
        where etapa not in ('ganado','perdido') and proximo_paso_fecha < current_date order by proximo_paso_fecha limit 5) x), '[]'::json),
    'sin_proxima_accion', (select count(*) from public.plataforma_leads where etapa not in ('ganado','perdido') and (proximo_paso is null or proximo_paso = '')),
    'valor_pipeline', coalesce((select sum(valor_mensual) from public.plataforma_leads where etapa not in ('ganado','perdido')), 0),
    'oportunidades_abiertas', (select count(*) from public.plataforma_leads where etapa not in ('ganado','perdido')),
    'activaciones_en_curso', coalesce((select json_agg(x) from (select id, nombre,
        (select count(*) from jsonb_array_elements(etapas) e where (e->>'obligatoria')::boolean and not (e->>'hecha')::boolean) as faltan
        from public.plataforma_proyectos where estado = 'en_curso' order by created_at limit 6) x), '[]'::json),
    'cobros_en_mora', coalesce((select sum(monto - descuento - monto_pagado) from public.plataforma_cobros where estado in ('pendiente','parcial') and fecha_vencimiento < current_date), 0),
    'estudios_en_mora', (select count(distinct tenant_id) from public.plataforma_cobros where estado in ('pendiente','parcial') and fecha_vencimiento < current_date),
    'cobros_por_vencer_7d', (select count(*) from public.plataforma_cobros where estado in ('pendiente','parcial') and fecha_vencimiento between current_date and current_date + 7),
    'tickets_abiertos', (select count(*) from public.plataforma_tickets where estado in ('abierto','en_curso')),
    'tickets_urgentes', (select count(*) from public.plataforma_tickets where estado in ('abierto','en_curso') and prioridad in ('urgente','alta')),
    'tickets_sla_vencido', (select count(*) from public.plataforma_tickets where estado in ('abierto','en_curso') and sla_vence < now()),
    'incidentes_activos', (select count(*) from public.plataforma_incidentes where estado <> 'resuelto'),
    'estudios_activos', (select count(*) from public.tenants where status = 'activo'),
    'estudios_suspendidos', (select count(*) from public.tenants where status <> 'activo')
  ) into v;
  return v;
end $$;
revoke all on function public.plataforma_direccion() from public;
grant execute on function public.plataforma_direccion() to authenticated;

-- ---------- Auditoría de plataforma ----------
do $$
declare t text;
begin
  foreach t in array array['plataforma_planes','plataforma_suscripciones','plataforma_cobros','plataforma_pagos','plataforma_costos','plataforma_staff','plataforma_proyectos','plataforma_tickets'] loop
    execute format('drop trigger if exists plataforma_registrar_accion on public.%I', t);
    execute format('create trigger plataforma_registrar_accion after insert or update or delete on public.%I for each row execute function public.registrar_accion_admin()', t);
  end loop;
end $$;

create or replace function public.plataforma_auditoria_listar(p_limite integer default 200)
returns table(created_at timestamptz, actor text, tabla text, operacion text, registro text, estudio text)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['auditor']) then raise exception 'No autorizado'; end if;
  return query select l.created_at, l.actor_nombre, l.tabla, l.operacion, l.registro_id, t.name
    from public.admin_acciones_log l left join public.tenants t on t.id = l.tenant_id
    where l.tabla like 'plataforma\_%' or l.tabla = 'tenant_entitlements'
    order by l.created_at desc limit least(coalesce(p_limite,200), 500);
end $$;
revoke all on function public.plataforma_auditoria_listar(integer) from public;
grant execute on function public.plataforma_auditoria_listar(integer) to authenticated;
