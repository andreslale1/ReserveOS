-- RO-03 / RO-04: marketing de ReserveOS (campañas para captar gimnasios), captación desde la web,
-- propuestas versionadas y contratos con renovaciones. Todo es de ReserveOS; las campañas que cada
-- estudio envía a sus clientas son otro módulo con otros permisos.

create table if not exists public.plataforma_campanas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  canal text not null default 'otro' check (canal in ('email','redes','evento','referido','web','alianza','otro')),
  fuente text not null,
  presupuesto numeric not null default 0 check (presupuesto >= 0),
  inicio date,
  fin date,
  estado text not null default 'planificada' check (estado in ('planificada','activa','terminada')),
  notas text,
  created_at timestamptz not null default now()
);
create table if not exists public.plataforma_exclusiones (
  email text primary key,
  motivo text,
  created_at timestamptz not null default now()
);
create table if not exists public.plataforma_captaciones (
  id uuid primary key default gen_random_uuid(),
  email text,
  fuente text,
  created_at timestamptz not null default now()
);
create table if not exists public.plataforma_propuestas (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.plataforma_leads(id) on delete cascade,
  version integer not null,
  estado text not null default 'borrador' check (estado in ('borrador','enviada','negociando','aceptada','perdida','reemplazada')),
  plan_key text,
  num_sedes integer not null default 1 check (num_sedes >= 1),
  sedes_extra integer not null default 0 check (sedes_extra >= 0),
  modulos_extra text[] not null default '{}',
  setup_monto numeric not null default 0 check (setup_monto >= 0),
  mensualidad numeric not null default 0 check (mensualidad >= 0),
  app_propia boolean not null default false,
  soporte_nivel text not null default 'estandar',
  inicio date,
  notas text,
  autor_nombre text,
  created_at timestamptz not null default now(),
  unique (lead_id, version)
);
create table if not exists public.plataforma_contratos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.plataforma_leads(id) on delete set null,
  propuesta_id uuid references public.plataforma_propuestas(id) on delete set null,
  tenant_id uuid references public.tenants(id) on delete set null,
  estado text not null default 'vigente' check (estado in ('vigente','vencido','cancelado')),
  fecha_firma date not null default current_date,
  vigencia_meses integer not null default 12 check (vigencia_meses >= 1),
  renovacion_auto boolean not null default true,
  mensualidad numeric not null default 0,
  setup_monto numeric not null default 0,
  documento_url text,
  notas text,
  created_at timestamptz not null default now()
);
alter table public.plataforma_campanas enable row level security;
alter table public.plataforma_exclusiones enable row level security;
alter table public.plataforma_captaciones enable row level security;
alter table public.plataforma_propuestas enable row level security;
alter table public.plataforma_contratos enable row level security;
revoke all on public.plataforma_campanas, public.plataforma_exclusiones, public.plataforma_captaciones,
  public.plataforma_propuestas, public.plataforma_contratos from anon, authenticated;

-- ---------- Campañas ----------
create or replace function public.campana_guardar(p_id uuid, p_nombre text, p_canal text, p_fuente text, p_presupuesto numeric,
  p_inicio date, p_fin date, p_estado text, p_notas text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  if not public._plat_ok(array['marketing','ventas']) then raise exception 'No autorizado'; end if;
  if p_nombre is null or length(trim(p_nombre)) < 2 then raise exception 'El nombre es obligatorio'; end if;
  if p_fuente is null or length(trim(p_fuente)) < 2 then raise exception 'La fuente identifica de dónde llegan los prospectos (ej. "instagram-oct")'; end if;
  if p_fin is not null and p_inicio is not null and p_fin < p_inicio then raise exception 'La fecha de fin no puede ser anterior al inicio'; end if;
  if p_id is null then
    insert into public.plataforma_campanas (nombre, canal, fuente, presupuesto, inicio, fin, estado, notas)
      values (trim(p_nombre), p_canal, lower(trim(p_fuente)), coalesce(p_presupuesto,0), p_inicio, p_fin, p_estado, p_notas) returning id into v_id;
  else
    update public.plataforma_campanas set nombre = trim(p_nombre), canal = p_canal, fuente = lower(trim(p_fuente)), presupuesto = coalesce(p_presupuesto,0),
      inicio = p_inicio, fin = p_fin, estado = p_estado, notas = p_notas where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;
revoke all on function public.campana_guardar(uuid, text, text, text, numeric, date, date, text, text) from public;
grant execute on function public.campana_guardar(uuid, text, text, text, numeric, date, date, text, text) to authenticated;

-- Atribución por la fuente registrada en cada oportunidad (no se afirma causalidad por una mera visita).
create or replace function public.campanas_listar()
returns table(id uuid, nombre text, canal text, fuente text, presupuesto numeric, inicio date, fin date, estado text, notas text,
  prospectos bigint, demos bigint, propuestas bigint, ganados bigint, valor_ganado numeric, costo_por_prospecto numeric)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['marketing','ventas']) then raise exception 'No autorizado'; end if;
  return query
  select c.id, c.nombre, c.canal, c.fuente, c.presupuesto, c.inicio, c.fin, c.estado, c.notas,
    (select count(*) from public.plataforma_leads l where lower(l.fuente) = c.fuente),
    (select count(*) from public.plataforma_leads l where lower(l.fuente) = c.fuente and l.etapa in ('demo','propuesta','negociacion','ganado')),
    (select count(*) from public.plataforma_leads l where lower(l.fuente) = c.fuente and l.etapa in ('propuesta','negociacion','ganado')),
    (select count(*) from public.plataforma_leads l where lower(l.fuente) = c.fuente and l.etapa = 'ganado'),
    coalesce((select sum(l.valor_mensual) from public.plataforma_leads l where lower(l.fuente) = c.fuente and l.etapa = 'ganado'), 0),
    case when (select count(*) from public.plataforma_leads l where lower(l.fuente) = c.fuente) > 0
         then round(c.presupuesto / (select count(*) from public.plataforma_leads l where lower(l.fuente) = c.fuente), 2) end
  from public.plataforma_campanas c order by c.created_at desc;
end $$;
revoke all on function public.campanas_listar() from public;
grant execute on function public.campanas_listar() to authenticated;

create or replace function public.exclusion_guardar(p_email text, p_motivo text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['marketing','ventas']) then raise exception 'No autorizado'; end if;
  insert into public.plataforma_exclusiones (email, motivo) values (lower(trim(p_email)), p_motivo)
    on conflict (email) do update set motivo = excluded.motivo;
end $$;
revoke all on function public.exclusion_guardar(text, text) from public;
grant execute on function public.exclusion_guardar(text, text) to authenticated;

create or replace function public.exclusiones_listar()
returns setof public.plataforma_exclusiones language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['marketing','ventas']) then raise exception 'No autorizado'; end if;
  return query select * from public.plataforma_exclusiones order by created_at desc;
end $$;
revoke all on function public.exclusiones_listar() from public;
grant execute on function public.exclusiones_listar() to authenticated;

-- ---------- Captación desde la web (pública) ----------
-- Crea o vincula empresa y contacto, conserva la fuente, abre la oportunidad y una tarea para responder hoy.
create or replace function public.captar_lead(p_nombre_empresa text, p_contacto text, p_email text, p_telefono text,
  p_ciudad text, p_mensaje text, p_fuente text, p_trampa text default null)
returns json language plpgsql security definer set search_path to 'public' as $$
declare v_emp uuid; v_con uuid; v_lead uuid; v_email text := lower(trim(coalesce(p_email,''))); v_fuente text := lower(trim(coalesce(nullif(p_fuente,''),'web')));
begin
  if p_trampa is not null and length(p_trampa) > 0 then return json_build_object('ok', true); end if;  -- anti-spam: campo oculto
  if length(coalesce(p_nombre_empresa,'')) < 2 or length(p_nombre_empresa) > 120 then raise exception 'Escribe el nombre de tu gimnasio o estudio'; end if;
  if length(coalesce(p_contacto,'')) < 2 or length(p_contacto) > 120 then raise exception 'Escribe tu nombre'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 160 then raise exception 'Escribe un correo válido'; end if;
  if length(coalesce(p_mensaje,'')) > 1500 or length(coalesce(p_telefono,'')) > 40 or length(coalesce(p_ciudad,'')) > 80 then raise exception 'Algún campo es demasiado largo'; end if;
  if (select count(*) from public.plataforma_captaciones where created_at > now() - interval '1 hour' and (email = v_email)) >= 3
     or (select count(*) from public.plataforma_captaciones where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Recibimos varias solicitudes seguidas. Intenta de nuevo en un rato.';
  end if;
  insert into public.plataforma_captaciones (email, fuente) values (v_email, v_fuente);

  select id into v_emp from public.plataforma_empresas where lower(nombre) = lower(trim(p_nombre_empresa));
  if v_emp is null then
    insert into public.plataforma_empresas (nombre, tipo, ciudad, fuente) values (trim(p_nombre_empresa), 'estudio', nullif(trim(coalesce(p_ciudad,'')),''), v_fuente) returning id into v_emp;
  end if;
  select id into v_con from public.plataforma_contactos where empresa_id = v_emp and lower(email) = v_email;
  if v_con is null then
    insert into public.plataforma_contactos (empresa_id, nombre, telefono, email, es_decisor) values (v_emp, trim(p_contacto), nullif(trim(coalesce(p_telefono,'')),''), v_email, true);
  end if;
  select id into v_lead from public.plataforma_leads where empresa_id = v_emp and etapa not in ('ganado','perdido') order by created_at desc limit 1;
  if v_lead is null then
    insert into public.plataforma_leads (nombre, tipo, ciudad, empresa_id, etapa, fuente, proximo_paso, proximo_paso_fecha)
      values (trim(p_nombre_empresa), 'estudio', nullif(trim(coalesce(p_ciudad,'')),''), v_emp, 'prospecto', v_fuente, 'Responder consulta de la web', current_date)
      returning id into v_lead;
  end if;
  insert into public.plataforma_actividades (lead_id, empresa_id, tipo, resumen, autor_nombre)
    values (v_lead, v_emp, 'nota', 'Consulta desde la web (' || v_fuente || '): ' || coalesce(nullif(trim(p_mensaje),''), 'sin mensaje'), 'Formulario web');
  insert into public.plataforma_tareas (lead_id, titulo, vence, responsable_nombre)
    values (v_lead, 'Responder consulta de ' || trim(p_nombre_empresa), current_date, 'Sin asignar');
  return json_build_object('ok', true);
end $$;
revoke all on function public.captar_lead(text, text, text, text, text, text, text, text) from public;
grant execute on function public.captar_lead(text, text, text, text, text, text, text, text) to anon, authenticated;

-- ---------- Propuestas (versionadas) ----------
create or replace function public.propuesta_guardar(p_lead_id uuid, p_plan_key text, p_num_sedes integer, p_sedes_extra integer, p_modulos_extra text[],
  p_setup numeric, p_mensualidad numeric, p_app_propia boolean, p_soporte text, p_inicio date, p_notas text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_last record; v_id uuid;
begin
  if not public._plat_ok(array['ventas']) then raise exception 'No autorizado'; end if;
  if not exists (select 1 from public.plataforma_leads where id = p_lead_id) then raise exception 'Oportunidad no encontrada'; end if;
  select * into v_last from public.plataforma_propuestas where lead_id = p_lead_id and estado <> 'reemplazada' order by version desc limit 1;
  if v_last.id is not null and v_last.estado = 'borrador' then
    update public.plataforma_propuestas set plan_key = p_plan_key, num_sedes = p_num_sedes, sedes_extra = p_sedes_extra, modulos_extra = coalesce(p_modulos_extra,'{}'),
      setup_monto = p_setup, mensualidad = p_mensualidad, app_propia = coalesce(p_app_propia,false), soporte_nivel = coalesce(p_soporte,'estandar'),
      inicio = p_inicio, notas = p_notas where id = v_last.id returning id into v_id;
  else
    -- Editar una propuesta ya enviada NO la sobrescribe: se crea una versión nueva y la anterior queda como histórico.
    if v_last.id is not null then update public.plataforma_propuestas set estado = 'reemplazada' where id = v_last.id and estado in ('enviada','negociando'); end if;
    insert into public.plataforma_propuestas (lead_id, version, plan_key, num_sedes, sedes_extra, modulos_extra, setup_monto, mensualidad, app_propia, soporte_nivel, inicio, notas, autor_nombre)
      values (p_lead_id, coalesce((select max(version) from public.plataforma_propuestas where lead_id = p_lead_id), 0) + 1, p_plan_key, p_num_sedes, p_sedes_extra,
        coalesce(p_modulos_extra,'{}'), p_setup, p_mensualidad, coalesce(p_app_propia,false), coalesce(p_soporte,'estandar'), p_inicio, p_notas, public._plat_nombre())
      returning id into v_id;
  end if;
  return v_id;
end $$;
revoke all on function public.propuesta_guardar(uuid, text, integer, integer, text[], numeric, numeric, boolean, text, date, text) from public;
grant execute on function public.propuesta_guardar(uuid, text, integer, integer, text[], numeric, numeric, boolean, text, date, text) to authenticated;

create or replace function public.propuesta_estado(p_id uuid, p_estado text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_p record; v_e record;
begin
  if not public._plat_ok(array['ventas']) then raise exception 'No autorizado'; end if;
  if p_estado not in ('enviada','negociando','aceptada','perdida') then raise exception 'Estado no válido'; end if;
  select * into v_p from public.plataforma_propuestas where id = p_id;
  if v_p is null or v_p.estado in ('reemplazada','aceptada','perdida') then raise exception 'La propuesta ya no admite cambios (crea una versión nueva)'; end if;
  update public.plataforma_propuestas set estado = p_estado where id = p_id;
  if p_estado in ('enviada','negociando') then
    update public.plataforma_leads set etapa = case when etapa in ('prospecto','demo') then 'propuesta' else etapa end, updated_at = now() where id = v_p.lead_id;
  elsif p_estado = 'aceptada' then
    -- La aceptación comercial crea el proyecto de activación; NO habilita un estudio ni cobra por sí misma.
    update public.plataforma_leads set etapa = 'ganado', valor_mensual = v_p.mensualidad, updated_at = now() where id = v_p.lead_id;
    select empresa_id, nombre into v_e from public.plataforma_leads where id = v_p.lead_id;
    if not exists (select 1 from public.plataforma_proyectos where lead_id = v_p.lead_id) then
      insert into public.plataforma_proyectos (empresa_id, lead_id, nombre, etapas)
        values (v_e.empresa_id, v_p.lead_id, 'Alta de ' || v_e.nombre, public._plantilla_etapas_alta());
    end if;
  end if;
end $$;
revoke all on function public.propuesta_estado(uuid, text) from public;
grant execute on function public.propuesta_estado(uuid, text) to authenticated;

create or replace function public.propuestas_listar(p_lead_id uuid)
returns setof public.plataforma_propuestas language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['ventas']) then raise exception 'No autorizado'; end if;
  return query select * from public.plataforma_propuestas where lead_id = p_lead_id order by version desc;
end $$;
revoke all on function public.propuestas_listar(uuid) from public;
grant execute on function public.propuestas_listar(uuid) to authenticated;

-- ---------- Contratos ----------
create or replace function public.contrato_crear(p_propuesta_id uuid, p_fecha_firma date, p_vigencia_meses integer, p_renovacion_auto boolean, p_documento_url text, p_notas text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_p record; v_id uuid;
begin
  if not public._plat_ok(array['ventas','finanzas']) then raise exception 'No autorizado'; end if;
  select * into v_p from public.plataforma_propuestas where id = p_propuesta_id;
  if v_p is null or v_p.estado <> 'aceptada' then raise exception 'Solo se crea contrato desde una propuesta aceptada'; end if;
  if exists (select 1 from public.plataforma_contratos where propuesta_id = p_propuesta_id and estado <> 'cancelado') then raise exception 'Esa propuesta ya tiene contrato'; end if;
  insert into public.plataforma_contratos (lead_id, propuesta_id, fecha_firma, vigencia_meses, renovacion_auto, mensualidad, setup_monto, documento_url, notas)
    values (v_p.lead_id, p_propuesta_id, coalesce(p_fecha_firma, current_date), coalesce(p_vigencia_meses,12), coalesce(p_renovacion_auto,true), v_p.mensualidad, v_p.setup_monto, p_documento_url, p_notas)
    returning id into v_id;
  return v_id;
end $$;
revoke all on function public.contrato_crear(uuid, date, integer, boolean, text, text) from public;
grant execute on function public.contrato_crear(uuid, date, integer, boolean, text, text) to authenticated;

create or replace function public.contrato_actualizar(p_id uuid, p_estado text, p_tenant_id uuid, p_renovacion_auto boolean, p_documento_url text, p_notas text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['ventas','finanzas']) then raise exception 'No autorizado'; end if;
  if p_estado not in ('vigente','vencido','cancelado') then raise exception 'Estado no válido'; end if;
  update public.plataforma_contratos set estado = p_estado, tenant_id = p_tenant_id, renovacion_auto = coalesce(p_renovacion_auto, renovacion_auto),
    documento_url = p_documento_url, notas = p_notas where id = p_id;
end $$;
revoke all on function public.contrato_actualizar(uuid, text, uuid, boolean, text, text) from public;
grant execute on function public.contrato_actualizar(uuid, text, uuid, boolean, text, text) to authenticated;

-- Deja la suscripción del estudio (plan, precio) conforme a lo firmado. No toca cobros ya generados.
create or replace function public.contrato_aplicar_suscripcion(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_c record; v_p record;
begin
  if not public._plat_ok(array['finanzas']) then raise exception 'No autorizado'; end if;
  select * into v_c from public.plataforma_contratos where id = p_id;
  if v_c is null or v_c.tenant_id is null then raise exception 'Vincula primero el estudio al contrato'; end if;
  select * into v_p from public.plataforma_propuestas where id = v_c.propuesta_id;
  insert into public.plataforma_suscripciones (tenant_id, plan, precio_mensual)
    values (v_c.tenant_id, coalesce(v_p.plan_key,'estandar'), v_c.mensualidad)
  on conflict (tenant_id) do update set plan = excluded.plan, precio_mensual = excluded.precio_mensual, updated_at = now();
end $$;
revoke all on function public.contrato_aplicar_suscripcion(uuid) from public;
grant execute on function public.contrato_aplicar_suscripcion(uuid) to authenticated;

create or replace function public.contratos_listar()
returns table(id uuid, lead_id uuid, empresa text, tenant_id uuid, estudio text, estado text, fecha_firma date, vigencia_meses integer,
  fecha_vencimiento date, dias_para_vencer integer, renovacion_auto boolean, mensualidad numeric, setup_monto numeric, documento_url text, notas text, version_propuesta integer)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['ventas','finanzas']) then raise exception 'No autorizado'; end if;
  return query select c.id, c.lead_id, l.nombre, c.tenant_id, t.name, c.estado, c.fecha_firma, c.vigencia_meses,
    (c.fecha_firma + make_interval(months => c.vigencia_meses))::date,
    ((c.fecha_firma + make_interval(months => c.vigencia_meses))::date - current_date),
    c.renovacion_auto, c.mensualidad, c.setup_monto, c.documento_url, c.notas, p.version
    from public.plataforma_contratos c
    left join public.plataforma_leads l on l.id = c.lead_id
    left join public.tenants t on t.id = c.tenant_id
    left join public.plataforma_propuestas p on p.id = c.propuesta_id
    order by (c.estado <> 'vigente'), 10;
end $$;
revoke all on function public.contratos_listar() from public;
grant execute on function public.contratos_listar() to authenticated;

-- Dirección: suma renovaciones próximas.
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
    'contratos_por_vencer_60d', (select count(*) from public.plataforma_contratos where estado = 'vigente'
        and (fecha_firma + make_interval(months => vigencia_meses))::date between current_date and current_date + 60),
    'tickets_abiertos', (select count(*) from public.plataforma_tickets where estado in ('abierto','en_curso')),
    'tickets_urgentes', (select count(*) from public.plataforma_tickets where estado in ('abierto','en_curso') and prioridad in ('urgente','alta')),
    'tickets_sla_vencido', (select count(*) from public.plataforma_tickets where estado in ('abierto','en_curso') and sla_vence < now()),
    'incidentes_activos', (select count(*) from public.plataforma_incidentes where estado <> 'resuelto'),
    'estudios_activos', (select count(*) from public.tenants where status = 'activo'),
    'estudios_suspendidos', (select count(*) from public.tenants where status <> 'activo')
  ) into v;
  return v;
end $$;

do $$
declare t text;
begin
  foreach t in array array['plataforma_campanas','plataforma_propuestas','plataforma_contratos'] loop
    execute format('drop trigger if exists plataforma_registrar_accion on public.%I', t);
    execute format('create trigger plataforma_registrar_accion after insert or update or delete on public.%I for each row execute function public.registrar_accion_admin()', t);
  end loop;
end $$;
