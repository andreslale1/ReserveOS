-- Gobierno de la consola de operador: equipo con invitaciones, auditoría accionable, salud honesta y dominios verificables (O-12 a O-15).

-- ───────────────────────── Equipo (O-12) ─────────────────────────
alter table public.plataforma_staff
  add column if not exists ultimo_cambio_por text,
  add column if not exists ultimo_cambio_at timestamptz;

create table if not exists public.plataforma_invitaciones (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  nombre text,
  rol text not null check (rol in ('operador','ventas','finanzas','soporte','implementacion','ingenieria','marketing','auditor')),
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  estado text not null default 'pendiente' check (estado in ('pendiente','aceptada','revocada')),
  invitado_por uuid default auth.uid(),
  invitado_por_nombre text,
  expira_at timestamptz not null default now() + interval '7 days',
  aceptada_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.plataforma_invitaciones enable row level security;
revoke all on public.plataforma_invitaciones from anon, authenticated;

-- Registro explícito (sin secretos) de acciones de plataforma que no pasan por el trigger genérico.
create or replace function public._plat_log(p_tabla text, p_op text, p_registro text, p_detalle jsonb)
returns void language sql security definer set search_path to 'public' as $$
  insert into public.admin_acciones_log (tenant_id, actor_id, actor_nombre, tabla, operacion, registro_id, detalle)
  values (null, auth.uid(), public._plat_nombre(), p_tabla, p_op, p_registro, p_detalle);
$$;
revoke all on function public._plat_log(text, text, text, jsonb) from public, anon, authenticated;

-- Siempre debe quedar al menos un operador, sin importar quién o cómo se cambie (incluye dos operadores a la vez).
create or replace function public._guardia_ultimo_operador()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if old.rol = 'operador' and (tg_op = 'DELETE' or new.rol <> 'operador') then
    perform pg_advisory_xact_lock(7001);
    if not exists (select 1 from public.plataforma_staff where rol = 'operador' and id <> old.id) then
      raise exception 'Debe quedar al menos un operador';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function public._guardia_ultimo_operador() from public, anon, authenticated;
drop trigger if exists plataforma_staff_guardia_operador on public.plataforma_staff;
create trigger plataforma_staff_guardia_operador before update or delete on public.plataforma_staff
  for each row execute function public._guardia_ultimo_operador();

drop function if exists public.equipo_listar();
create or replace function public.equipo_listar()
returns table(user_id uuid, nombre text, email text, rol text, created_at timestamptz, ultimo_acceso timestamptz, ultimo_cambio_por text, ultimo_cambio_at timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['auditor']) then raise exception 'No autorizado'; end if;
  return query select s.user_id, s.nombre, u.email::text, s.rol, s.created_at, u.last_sign_in_at, s.ultimo_cambio_por, s.ultimo_cambio_at
    from public.plataforma_staff s join auth.users u on u.id = s.user_id order by s.created_at;
end $$;
revoke all on function public.equipo_listar() from public, anon;
grant execute on function public.equipo_listar() to authenticated;

create or replace function public.equipo_guardar(p_email text, p_nombre text, p_rol text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid;
begin
  if not public.soy_staff_plataforma() then raise exception 'Solo el operador gestiona el equipo'; end if;
  if p_rol not in ('operador','ventas','finanzas','soporte','implementacion','ingenieria','marketing','auditor') then raise exception 'Rol no válido'; end if;
  select id into v_uid from auth.users where lower(email) = lower(trim(p_email));
  if v_uid is null then raise exception 'No existe una cuenta con ese correo. Usa una invitación para que la persona cree la suya.'; end if;
  insert into public.plataforma_staff (user_id, nombre, rol, ultimo_cambio_por, ultimo_cambio_at)
    values (v_uid, nullif(trim(coalesce(p_nombre,'')),''), p_rol, public._plat_nombre(), now())
  on conflict (user_id) do update set rol = excluded.rol, nombre = coalesce(excluded.nombre, public.plataforma_staff.nombre),
    ultimo_cambio_por = excluded.ultimo_cambio_por, ultimo_cambio_at = excluded.ultimo_cambio_at;
end $$;
revoke all on function public.equipo_guardar(text, text, text) from public, anon;
grant execute on function public.equipo_guardar(text, text, text) to authenticated;

create or replace function public.equipo_quitar(p_user_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.soy_staff_plataforma() then raise exception 'Solo el operador gestiona el equipo'; end if;
  if p_user_id = auth.uid() then raise exception 'No puedes quitarte a ti misma; pídelo a otro operador'; end if;
  delete from public.plataforma_staff where user_id = p_user_id;
  if not found then raise exception 'Esa persona no está en el equipo'; end if;
end $$;
revoke all on function public.equipo_quitar(uuid) from public, anon;
grant execute on function public.equipo_quitar(uuid) to authenticated;

create or replace function public.equipo_invitar(p_email text, p_nombre text, p_rol text)
returns json language plpgsql security definer set search_path to 'public' as $$
declare v_email text := lower(trim(coalesce(p_email,''))); v_inv public.plataforma_invitaciones;
begin
  if not public.soy_staff_plataforma() then raise exception 'Solo el operador gestiona el equipo'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Escribe un correo válido'; end if;
  if p_rol not in ('operador','ventas','finanzas','soporte','implementacion','ingenieria','marketing','auditor') then raise exception 'Rol no válido'; end if;
  if exists (select 1 from public.plataforma_staff s join auth.users u on u.id = s.user_id where lower(u.email) = v_email) then
    raise exception 'Esa persona ya es parte del equipo';
  end if;
  update public.plataforma_invitaciones set estado = 'revocada' where lower(email) = v_email and estado = 'pendiente';
  insert into public.plataforma_invitaciones (email, nombre, rol, invitado_por_nombre)
    values (v_email, nullif(trim(coalesce(p_nombre,'')),''), p_rol, public._plat_nombre()) returning * into v_inv;
  perform public._plat_log('plataforma_invitaciones', 'insert', v_inv.id::text,
    jsonb_build_object('email', v_inv.email, 'rol', v_inv.rol, 'expira_at', v_inv.expira_at));
  return json_build_object('id', v_inv.id, 'token', v_inv.token, 'expira_at', v_inv.expira_at);
end $$;
revoke all on function public.equipo_invitar(text, text, text) from public, anon;
grant execute on function public.equipo_invitar(text, text, text) to authenticated;

create or replace function public.equipo_invitaciones_listar()
returns table(id uuid, email text, nombre text, rol text, estado text, expira_at timestamptz, created_at timestamptz, invitado_por text, token text)
language plpgsql stable security definer set search_path to 'public' as $$
declare v_op boolean := public.soy_staff_plataforma();
begin
  if not public._plat_ok(array['auditor']) then raise exception 'No autorizado'; end if;
  return query select i.id, i.email, i.nombre, i.rol,
      case when i.estado = 'pendiente' and i.expira_at < now() then 'vencida' else i.estado end,
      i.expira_at, i.created_at, i.invitado_por_nombre,
      case when v_op and i.estado = 'pendiente' and i.expira_at >= now() then i.token else null end
    from public.plataforma_invitaciones i order by i.created_at desc limit 50;
end $$;
revoke all on function public.equipo_invitaciones_listar() from public, anon;
grant execute on function public.equipo_invitaciones_listar() to authenticated;

create or replace function public.equipo_invitacion_revocar(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v public.plataforma_invitaciones;
begin
  if not public.soy_staff_plataforma() then raise exception 'Solo el operador gestiona el equipo'; end if;
  update public.plataforma_invitaciones set estado = 'revocada' where id = p_id and estado = 'pendiente' returning * into v;
  if v.id is null then raise exception 'La invitación no está pendiente'; end if;
  perform public._plat_log('plataforma_invitaciones', 'update', v.id::text, jsonb_build_object('email', v.email, 'estado', 'revocada'));
end $$;
revoke all on function public.equipo_invitacion_revocar(uuid) from public, anon;
grant execute on function public.equipo_invitacion_revocar(uuid) to authenticated;

-- Quien recibe el enlace debe haber iniciado sesión; el correo de la invitación y el de la cuenta deben coincidir.
create or replace function public.equipo_invitacion_por_token(p_token text)
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare v public.plataforma_invitaciones; v_mail text; v_est text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select * into v from public.plataforma_invitaciones where token = p_token;
  if v.id is null then return null; end if;
  v_est := case when v.estado = 'pendiente' and v.expira_at < now() then 'vencida' else v.estado end;
  select lower(email) into v_mail from auth.users where id = auth.uid();
  if v_mail is distinct from lower(v.email) then return json_build_object('estado', v_est, 'coincide', false); end if;
  return json_build_object('estado', v_est, 'coincide', true, 'email', v.email, 'rol', v.rol, 'nombre', v.nombre, 'expira_at', v.expira_at);
end $$;
revoke all on function public.equipo_invitacion_por_token(text) from public, anon;
grant execute on function public.equipo_invitacion_por_token(text) to authenticated;

create or replace function public.equipo_invitacion_aceptar(p_token text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v public.plataforma_invitaciones; v_mail text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select * into v from public.plataforma_invitaciones where token = p_token for update;
  if v.id is null then raise exception 'Invitación no válida'; end if;
  if v.estado <> 'pendiente' then raise exception 'Esta invitación ya no está vigente'; end if;
  if v.expira_at < now() then raise exception 'La invitación venció; pide una nueva'; end if;
  select lower(email) into v_mail from auth.users where id = auth.uid();
  if v_mail is distinct from lower(v.email) then raise exception 'Esta invitación es para otro correo'; end if;
  if exists (select 1 from public.plataforma_staff where user_id = auth.uid()) then raise exception 'Ya eres parte del equipo'; end if;
  insert into public.plataforma_staff (user_id, nombre, rol, ultimo_cambio_por, ultimo_cambio_at)
    values (auth.uid(), coalesce(v.nombre, split_part(v_mail, '@', 1)), v.rol, v.invitado_por_nombre, now());
  update public.plataforma_invitaciones set estado = 'aceptada', aceptada_at = now() where id = v.id;
  perform public._plat_log('plataforma_invitaciones', 'update', v.id::text, jsonb_build_object('email', v.email, 'estado', 'aceptada'));
  return v.rol;
end $$;
revoke all on function public.equipo_invitacion_aceptar(text) from public, anon;
grant execute on function public.equipo_invitacion_aceptar(text) to authenticated;

-- ───────────────────────── Auditoría (O-13) ─────────────────────────
create or replace function public._audit_redactar(p_key text, p_val jsonb)
returns jsonb language sql immutable as $$
  select case
    when p_val is null or jsonb_typeof(p_val) = 'null' then p_val
    when p_key ~* '(secret|token|password|passwd|api_?key|hash|credential|webhook|private|signature)' then '"[oculto]"'::jsonb
    when p_key ~* '(email|correo)' and jsonb_typeof(p_val) = 'string'
      then to_jsonb(regexp_replace(p_val #>> '{}', '^(.).*(@.*)$', '\1***\2'))
    when p_key ~* '(tel|phone|whatsapp|celular)' and jsonb_typeof(p_val) = 'string'
      then to_jsonb('***' || right(p_val #>> '{}', 2))
    else p_val end
$$;
revoke all on function public._audit_redactar(text, jsonb) from public, anon, authenticated;

create or replace function public._audit_diff(p_op text, p_detalle jsonb)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(c), '[]'::jsonb) from (
    select jsonb_build_object('campo', k.key,
      'antes', case when p_op = 'insert' then null else public._audit_redactar(k.key, case when p_op = 'update' then p_detalle->'antes'->k.key else p_detalle->k.key end) end,
      'despues', case when p_op = 'delete' then null else public._audit_redactar(k.key, case when p_op = 'update' then p_detalle->'despues'->k.key else p_detalle->k.key end) end) c
    from jsonb_each(case when p_op = 'update' then p_detalle->'despues' else p_detalle end) k
    where k.key not in ('updated_at','actualizado_at','created_at')
      and (p_op <> 'update' or (p_detalle->'antes'->k.key) is distinct from (p_detalle->'despues'->k.key))
    limit 25) s
$$;
revoke all on function public._audit_diff(text, jsonb) from public, anon, authenticated;

create or replace function public.plataforma_auditoria_buscar(
  p_desde date default null, p_hasta date default null, p_tenant_id uuid default null, p_actor text default null,
  p_tabla text default null, p_operacion text default null, p_q text default null, p_limite integer default 50, p_offset integer default 0)
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare v_lim int := least(greatest(coalesce(p_limite, 50), 1), 200); v_off int := greatest(coalesce(p_offset, 0), 0); v_total int; v_filas json;
begin
  if not public._plat_ok(array['auditor']) then raise exception 'No autorizado'; end if;
  return (
    with base as (
      select l.*, coalesce(l.actor_nombre, (select s.nombre from public.plataforma_staff s where s.user_id = l.actor_id),
               case when l.actor_id is null then 'Sistema' else 'Cuenta sin nombre' end) as actor, t.name as estudio
      from public.admin_acciones_log l left join public.tenants t on t.id = l.tenant_id
      where (l.tabla like 'plataforma\_%' or l.tabla = 'tenant_entitlements')
        and (p_desde is null or l.created_at >= (p_desde::timestamp at time zone 'America/Guatemala'))
        and (p_hasta is null or l.created_at < ((p_hasta + 1)::timestamp at time zone 'America/Guatemala'))
        and (p_tenant_id is null or l.tenant_id = p_tenant_id)
        and (p_tabla is null or p_tabla = '' or l.tabla = p_tabla)
        and (p_operacion is null or p_operacion = '' or l.operacion = p_operacion)
    ), filtrada as (
      select b.* from base b
      where (p_actor is null or p_actor = '' or b.actor ilike '%' || p_actor || '%')
        and (p_q is null or p_q = '' or b.actor ilike '%' || p_q || '%' or b.tabla ilike '%' || p_q || '%' or coalesce(b.registro_id,'') ilike '%' || p_q || '%'
             or coalesce(b.estudio,'') ilike '%' || p_q || '%' or coalesce(b.detalle->>'module_key','') ilike '%' || p_q || '%')
    ), grupos as (
      select f.created_at, f.actor, f.tabla, f.operacion, f.estudio, count(*)::int as n,
        jsonb_agg(jsonb_build_object('registro', coalesce(f.detalle->>'module_key', f.registro_id), 'cambios', public._audit_diff(f.operacion, f.detalle)) order by f.id) as items
      from filtrada f group by f.created_at, f.actor_id, f.actor, f.tabla, f.operacion, f.estudio, f.tenant_id
    ), pagina as (select * from grupos order by created_at desc limit v_lim offset v_off)
    select json_build_object('total', (select count(*) from grupos),
      'filas', coalesce((select json_agg(json_build_object('created_at', p.created_at, 'actor', p.actor, 'tabla', p.tabla, 'operacion', p.operacion,
          'estudio', p.estudio, 'n', p.n, 'items', (select jsonb_agg(x) from (select x from jsonb_array_elements(p.items) x limit 20) q)) order by p.created_at desc) from pagina p), '[]'::json))
  );
end $$;
revoke all on function public.plataforma_auditoria_buscar(date, date, uuid, text, text, text, text, integer, integer) from public, anon;
grant execute on function public.plataforma_auditoria_buscar(date, date, uuid, text, text, text, text, integer, integer) to authenticated;

-- ───────────────────────── Salud (O-14) ─────────────────────────
create table if not exists public.plataforma_salud_verificaciones (
  id uuid primary key default gen_random_uuid(),
  medido_at timestamptz not null default now(),
  por text,
  resumen jsonb not null
);
alter table public.plataforma_salud_verificaciones enable row level security;
revoke all on public.plataforma_salud_verificaciones from anon, authenticated;

create or replace function public._cron_intervalo_min(p text)
returns integer language sql immutable as $$
  select case
    when p ~ '^\*/\d+ \* \* \* \*$' then substring(p from '^\*/(\d+)')::int
    when p ~ '^\d+ \* \* \* \*$' then 60
    when p ~ '^\d+ \d+ \* \* \*$' then 1440
    when p ~ '^\d+ \d+ \* \* \d+$' then 10080
    else 1440 end
$$;
revoke all on function public._cron_intervalo_min(text) from public, anon, authenticated;

create or replace function public.plataforma_salud()
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare v_cron json; v_estudios json; v_mig text; v_checks json; v_ult timestamptz;
  v_pagos_atr int; v_pagos_mal int; v_pagos_ult timestamptz; v_cola_atr int; v_cola_fall int; v_cola_tot int;
begin
  if not public._plat_ok(array['soporte']) then raise exception 'No autorizado'; end if;
  select max(version) into v_mig from supabase_migrations.schema_migrations;

  select coalesce(json_agg(x order by x.jobname), '[]'::json) into v_cron from (
    select c.*, case
        when c.ultima_ejecucion is null then 'sin_evidencia'
        when c.ultimo_estado = 'failed' then 'caido'
        when c.ultima_ejecucion < now() - make_interval(mins => c.intervalo_min * 2 + 5) then 'caido'
        when c.fallos_24h > 0 then 'degradado'
        else 'sano' end as estado,
      format('Se espera cada %s min; alerta si pasan más de %s min sin ejecutarse', c.intervalo_min, c.intervalo_min * 2 + 5) as umbral
    from (
      select j.jobname, j.schedule, public._cron_intervalo_min(j.schedule) as intervalo_min,
        (select d.status from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1) as ultimo_estado,
        (select d.start_time from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1) as ultima_ejecucion,
        (select count(*) from cron.job_run_details d where d.jobid = j.jobid and d.status = 'failed' and d.start_time > now() - interval '24 hours') as fallos_24h
      from cron.job j) c) x;

  select coalesce(json_agg(e order by e.orden desc, e.estudio), '[]'::json) into v_estudios from (
    select m.*, case m.estado when 'caido' then 3 when 'degradado' then 2 when 'sano' then 1 else 0 end as orden from (
      select q.*, case
          when q.status <> 'activo' then 'sin_evidencia'
          when q.errores_24h >= 10 or q.incidente_sev = 'critico' then 'caido'
          when q.errores_24h > 0 or q.pagos_sin_revisar > 0 or q.mensajes_atrasados > 0 or q.incidente_sev is not null then 'degradado'
          when q.ultima_reserva > now() - interval '7 days' then 'sano'
          else 'sin_evidencia' end as estado,
        case
          when q.status <> 'activo' then 'El estudio no está activo (' || q.status || ')'
          when q.errores_24h >= 10 then q.errores_24h || ' errores sin resolver en 24 h'
          when q.incidente_sev = 'critico' then 'Incidente crítico abierto'
          when q.errores_24h > 0 then q.errores_24h || ' errores sin resolver en 24 h'
          when q.pagos_sin_revisar > 0 then q.pagos_sin_revisar || ' pagos por transferencia sin revisar hace más de 3 días'
          when q.mensajes_atrasados > 0 then q.mensajes_atrasados || ' mensajes sin enviar hace más de 1 hora'
          when q.incidente_sev is not null then 'Incidente abierto'
          when q.ultima_reserva > now() - interval '7 days' then 'Con reservas en los últimos 7 días y sin alertas'
          else 'Sin reservas en 7 días: no hay evidencia de que funcione' end as motivo
      from (
        select t.id as tenant_id, t.name as estudio, t.status,
          (select coalesce(sum(l.veces),0)::int from public.error_logs l where l.tenant_id = t.id and not l.resuelto and l.ultima_vez > now() - interval '24 hours') as errores_24h,
          (select max(l.ultima_vez) from public.error_logs l where l.tenant_id = t.id and not l.resuelto) as ultimo_error,
          (select count(*)::int from public.reservas r where r.tenant_id = t.id and r.created_at > now() - interval '24 hours') as reservas_24h,
          (select count(*)::int from public.membresias m where m.tenant_id = t.id and m.estado = 'pendiente_pago' and m.created_at < now() - interval '3 days') as pagos_sin_revisar,
          (select count(*)::int from public.plataforma_tickets k where k.tenant_id = t.id and k.estado in ('abierto','en_curso')) as tickets_abiertos,
          (select k.id from public.plataforma_tickets k where k.tenant_id = t.id and k.estado in ('abierto','en_curso') order by k.sla_vence limit 1) as ticket_id,
          (select max(r.created_at) from public.reservas r where r.tenant_id = t.id) as ultima_reserva,
          (select count(*)::int from public.cola_mensajes c where c.tenant_id = t.id and c.estado in ('pendiente','enviando') and c.created_at < now() - interval '1 hour') as mensajes_atrasados,
          (select i.severidad from public.plataforma_incidentes i where i.estado <> 'resuelto' and (i.tenant_id = t.id or i.tenant_id is null)
             order by array_position(array['critico','mayor','menor'], i.severidad) limit 1) as incidente_sev,
          (select i.id from public.plataforma_incidentes i where i.estado <> 'resuelto' and (i.tenant_id = t.id or i.tenant_id is null)
             order by array_position(array['critico','mayor','menor'], i.severidad), i.started_at desc limit 1) as incidente_id
        from public.tenants t) q) m) e;

  select count(*) filter (where estado = 'iniciado' and created_at < now() - interval '1 hour'),
         count(*) filter (where estado in ('rechazado','revision') and actualizado_at > now() - interval '24 hours'), max(actualizado_at)
    into v_pagos_atr, v_pagos_mal, v_pagos_ult from public.pago_transacciones;
  select count(*) filter (where estado in ('pendiente','enviando') and created_at < now() - interval '1 hour'),
         count(*) filter (where estado = 'fallido' and created_at > now() - interval '24 hours'), count(*)
    into v_cola_atr, v_cola_fall, v_cola_tot from public.cola_mensajes;
  select max(medido_at) into v_ult from public.plataforma_salud_verificaciones;

  v_checks := json_build_array(
    json_build_object('clave', 'base', 'nombre', 'Base de datos', 'estado', 'sano', 'detalle', 'Responde a consultas (migración ' || coalesce(v_mig, '?') || ')'),
    json_build_object('clave', 'pagos', 'nombre', 'Pagos y webhooks',
      'estado', case when v_pagos_ult is null then 'sin_evidencia' when v_pagos_atr > 0 or v_pagos_mal > 0 then 'degradado' else 'sano' end,
      'detalle', case when v_pagos_ult is null then 'Aún no hay transacciones: no hay evidencia' else v_pagos_atr || ' iniciadas sin confirmar hace más de 1 h · ' || v_pagos_mal || ' rechazadas o en revisión en 24 h' end),
    json_build_object('clave', 'cola', 'nombre', 'Cola de mensajes',
      'estado', case when v_cola_tot = 0 then 'sin_evidencia' when v_cola_atr > 0 or v_cola_fall > 0 then 'degradado' else 'sano' end,
      'detalle', case when v_cola_tot = 0 then 'Aún no se ha encolado ningún mensaje: no hay evidencia' else v_cola_atr || ' atrasados más de 1 h · ' || v_cola_fall || ' fallidos en 24 h' end));

  return json_build_object('base_ok', true, 'ultima_migracion', v_mig, 'cron', v_cron, 'estudios', v_estudios, 'checks', v_checks,
    'ultima_verificacion', v_ult, 'medido_at', now());
end $$;
revoke all on function public.plataforma_salud() from public, anon;
grant execute on function public.plataforma_salud() to authenticated;

-- Guarda una verificación con su resultado, para tener historia y saber cuándo se miró por última vez.
create or replace function public.salud_verificar()
returns json language plpgsql security definer set search_path to 'public' as $$
declare v json;
begin
  if not public._plat_ok(array['soporte']) then raise exception 'No autorizado'; end if;
  v := public.plataforma_salud();
  insert into public.plataforma_salud_verificaciones (por, resumen) values (public._plat_nombre(), jsonb_build_object(
    'cron', (select jsonb_object_agg(e, n) from (select coalesce(x->>'estado','?') e, count(*) n from json_array_elements(v->'cron') x group by 1) z),
    'estudios_caidos', (select count(*) from json_array_elements(v->'estudios') x where x->>'estado' = 'caido'),
    'estudios_degradados', (select count(*) from json_array_elements(v->'estudios') x where x->>'estado' = 'degradado'),
    'estudios_sanos', (select count(*) from json_array_elements(v->'estudios') x where x->>'estado' = 'sano'),
    'estudios_sin_evidencia', (select count(*) from json_array_elements(v->'estudios') x where x->>'estado' = 'sin_evidencia')));
  delete from public.plataforma_salud_verificaciones where id in (select id from public.plataforma_salud_verificaciones order by medido_at desc offset 200);
  return public.plataforma_salud();
end $$;
revoke all on function public.salud_verificar() from public, anon;
grant execute on function public.salud_verificar() to authenticated;

create or replace function public.salud_historial()
returns table(medido_at timestamptz, por text, resumen jsonb)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['soporte']) then raise exception 'No autorizado'; end if;
  return query select v.medido_at, v.por, v.resumen from public.plataforma_salud_verificaciones v order by v.medido_at desc limit 20;
end $$;
revoke all on function public.salud_historial() from public, anon;
grant execute on function public.salud_historial() to authenticated;

-- ───────────────────────── Dominios (O-15) ─────────────────────────
alter table public.tenant_domains
  add column if not exists token_verificacion text not null default replace(gen_random_uuid()::text, '-', ''),
  add column if not exists dns_estado text not null default 'pendiente' check (dns_estado in ('pendiente','ok','error')),
  add column if not exists dns_detalle text,
  add column if not exists dns_comprobado_at timestamptz,
  add column if not exists txt_estado text not null default 'pendiente' check (txt_estado in ('pendiente','ok','error')),
  add column if not exists tls_estado text not null default 'pendiente' check (tls_estado in ('pendiente','ok','error')),
  add column if not exists tls_detalle text,
  add column if not exists tls_comprobado_at timestamptz;

drop function if exists public.dominios_plataforma();
create or replace function public.dominios_plataforma()
returns table(id uuid, estudio text, domain text, verified boolean, solicitado_at timestamptz, verificado_at timestamptz,
  slug text, token_verificacion text, dns_estado text, dns_detalle text, dns_comprobado_at timestamptz, txt_estado text, tls_estado text, tls_detalle text, tls_comprobado_at timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['soporte']) then raise exception 'No autorizado'; end if;
  return query select d.id, t.name, d.domain, d.verified, d.solicitado_at, d.verificado_at, t.slug, d.token_verificacion,
      d.dns_estado, d.dns_detalle, d.dns_comprobado_at, d.txt_estado, d.tls_estado, d.tls_detalle, d.tls_comprobado_at
    from public.tenant_domains d join public.tenants t on t.id = d.tenant_id order by d.verified, d.solicitado_at desc;
end $$;
revoke all on function public.dominios_plataforma() from public, anon;
grant execute on function public.dominios_plataforma() to authenticated;

create or replace function public.dominio_registrar_comprobacion(p_id uuid, p_dns text, p_dns_detalle text, p_txt text, p_tls text, p_tls_detalle text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['soporte']) then raise exception 'No autorizado'; end if;
  if p_dns not in ('pendiente','ok','error') or p_txt not in ('pendiente','ok','error') or p_tls not in ('pendiente','ok','error') then raise exception 'Estado no válido'; end if;
  update public.tenant_domains set dns_estado = p_dns, dns_detalle = left(p_dns_detalle, 300), dns_comprobado_at = now(), txt_estado = p_txt,
    tls_estado = p_tls, tls_detalle = left(p_tls_detalle, 300), tls_comprobado_at = now() where id = p_id;
  if not found then raise exception 'Dominio no encontrado'; end if;
end $$;
revoke all on function public.dominio_registrar_comprobacion(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.dominio_registrar_comprobacion(uuid, text, text, text, text, text) to authenticated;

-- No se publica un dominio hasta que DNS y HTTPS hayan sido comprobados (en las últimas 24 h).
create or replace function public.dominio_verificar(p_id uuid, p_verificado boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v public.tenant_domains;
begin
  if not public.soy_staff_plataforma() then raise exception 'Solo el operador activa dominios'; end if;
  select * into v from public.tenant_domains where id = p_id;
  if v.id is null then raise exception 'Dominio no encontrado'; end if;
  if p_verificado and not (v.dns_estado = 'ok' and v.tls_estado = 'ok'
      and v.dns_comprobado_at > now() - interval '24 hours' and v.tls_comprobado_at > now() - interval '24 hours') then
    raise exception 'Comprueba DNS y HTTPS antes de activar el dominio';
  end if;
  update public.tenant_domains set verified = p_verificado, verificado_at = case when p_verificado then now() else null end where id = p_id;
end $$;
revoke all on function public.dominio_verificar(uuid, boolean) from public, anon;
grant execute on function public.dominio_verificar(uuid, boolean) to authenticated;
