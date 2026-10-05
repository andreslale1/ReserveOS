-- RO-02 / RO-05: CRM B2B de ReserveOS (empresas, contactos, oportunidades, actividades, tareas) y proyecto de
-- activación que nace al ganar una oportunidad. Las oportunidades siguen siendo plataforma_leads (se conserva
-- el historial); cada una ahora cuelga de una empresa. No usa la tabla clientes de ningún estudio.

create table if not exists public.plataforma_empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null default 'estudio',
  ciudad text,
  sitio_web text,
  tamano_sedes integer,
  fuente text,
  notas text,
  tenant_id uuid references public.tenants(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists plataforma_empresas_nombre_uidx on public.plataforma_empresas (lower(nombre));

create table if not exists public.plataforma_contactos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.plataforma_empresas(id) on delete cascade,
  nombre text not null,
  cargo text,
  telefono text,
  email text,
  es_decisor boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.plataforma_leads
  add column if not exists empresa_id uuid references public.plataforma_empresas(id) on delete set null,
  add column if not exists fuente text,
  add column if not exists plan_interes text,
  add column if not exists num_sedes integer,
  add column if not exists probabilidad integer check (probabilidad is null or probabilidad between 0 and 100),
  add column if not exists responsable_id uuid references auth.users(id),
  add column if not exists motivo_perdida text;

create table if not exists public.plataforma_actividades (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.plataforma_leads(id) on delete cascade,
  empresa_id uuid references public.plataforma_empresas(id) on delete cascade,
  tipo text not null check (tipo in ('llamada','email','reunion','demo','nota','whatsapp','otro')),
  resumen text not null,
  fecha timestamptz not null default now(),
  autor_id uuid default auth.uid(),
  autor_nombre text,
  created_at timestamptz not null default now()
);
create table if not exists public.plataforma_tareas (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.plataforma_leads(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  titulo text not null,
  vence date,
  responsable_id uuid references auth.users(id),
  responsable_nombre text,
  estado text not null default 'pendiente' check (estado in ('pendiente','hecha')),
  completada_at timestamptz,
  created_at timestamptz not null default now()
);

-- Proyecto de activación (onboarding) de un estudio nuevo.
create table if not exists public.plataforma_proyectos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.plataforma_empresas(id) on delete set null,
  lead_id uuid references public.plataforma_leads(id) on delete set null,
  tenant_id uuid references public.tenants(id) on delete set null,
  nombre text not null,
  estado text not null default 'en_curso' check (estado in ('en_curso','en_vivo','cancelado')),
  etapas jsonb not null,
  created_at timestamptz not null default now(),
  en_vivo_at timestamptz
);

alter table public.plataforma_empresas enable row level security;
alter table public.plataforma_contactos enable row level security;
alter table public.plataforma_actividades enable row level security;
alter table public.plataforma_tareas enable row level security;
alter table public.plataforma_proyectos enable row level security;
revoke all on public.plataforma_empresas, public.plataforma_contactos, public.plataforma_actividades,
  public.plataforma_tareas, public.plataforma_proyectos from anon, authenticated;

-- Migra las oportunidades existentes: una empresa por cada nombre.
insert into public.plataforma_empresas (nombre, tipo, ciudad)
  select distinct on (lower(nombre)) nombre, tipo, ciudad from public.plataforma_leads
on conflict do nothing;
update public.plataforma_leads l set empresa_id = e.id
  from public.plataforma_empresas e where lower(e.nombre) = lower(l.nombre) and l.empresa_id is null;
insert into public.plataforma_contactos (empresa_id, nombre, telefono, email, es_decisor)
  select l.empresa_id, l.contacto, l.telefono, l.email, true from public.plataforma_leads l
  where l.empresa_id is not null and l.contacto is not null and length(trim(l.contacto)) > 0
    and not exists (select 1 from public.plataforma_contactos c where c.empresa_id = l.empresa_id and c.nombre = l.contacto);

create or replace function public._plantilla_etapas_alta()
returns jsonb language sql immutable as $$
  select jsonb_build_array(
    jsonb_build_object('key','contrato','nombre','Contrato firmado','obligatoria',true,'hecha',false),
    jsonb_build_object('key','estudio','nombre','Estudio creado y dueña invitada','obligatoria',true,'hecha',false),
    jsonb_build_object('key','plan','nombre','Plan y suscripción asignados','obligatoria',true,'hecha',false),
    jsonb_build_object('key','marca','nombre','Marca (nombre, color, logo)','obligatoria',true,'hecha',false),
    jsonb_build_object('key','sedes','nombre','Sedes configuradas','obligatoria',true,'hecha',false),
    jsonb_build_object('key','roles','nombre','Personal y roles invitados','obligatoria',true,'hecha',false),
    jsonb_build_object('key','catalogo','nombre','Clases y paquetes cargados','obligatoria',true,'hecha',false),
    jsonb_build_object('key','dominio','nombre','Dominio o enlace conectado a su web','obligatoria',false,'hecha',false),
    jsonb_build_object('key','importacion','nombre','Clientas existentes importadas','obligatoria',false,'hecha',false),
    jsonb_build_object('key','pagos','nombre','Cobro configurado (transferencia / pasarela)','obligatoria',true,'hecha',false),
    jsonb_build_object('key','capacitacion','nombre','Capacitación al equipo','obligatoria',true,'hecha',false),
    jsonb_build_object('key','pruebas','nombre','Prueba de reserva de punta a punta','obligatoria',true,'hecha',false)
  );
$$;

create or replace function public._plat_nombre()
returns text language sql stable security definer set search_path to 'public' as $$
  select nombre from public.plataforma_staff where user_id = auth.uid() limit 1
$$;

-- ---------- Empresas y contactos ----------
create or replace function public.empresa_guardar(p_id uuid, p_nombre text, p_tipo text, p_ciudad text, p_sitio_web text,
  p_tamano_sedes integer, p_fuente text, p_notas text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  if not public._plat_ok(array['ventas']) then raise exception 'No autorizado'; end if;
  if p_nombre is null or length(trim(p_nombre)) = 0 then raise exception 'El nombre es obligatorio'; end if;
  if p_id is null then
    if exists (select 1 from public.plataforma_empresas where lower(nombre) = lower(trim(p_nombre))) then
      raise exception 'Ya existe una empresa con ese nombre (evita duplicados)';
    end if;
    insert into public.plataforma_empresas (nombre, tipo, ciudad, sitio_web, tamano_sedes, fuente, notas)
      values (trim(p_nombre), coalesce(nullif(p_tipo,''),'estudio'), p_ciudad, p_sitio_web, p_tamano_sedes, p_fuente, p_notas)
      returning id into v_id;
  else
    update public.plataforma_empresas set nombre = trim(p_nombre), tipo = coalesce(nullif(p_tipo,''),'estudio'), ciudad = p_ciudad,
      sitio_web = p_sitio_web, tamano_sedes = p_tamano_sedes, fuente = p_fuente, notas = p_notas
      where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Empresa no encontrada'; end if;
  end if;
  return v_id;
end $$;
revoke all on function public.empresa_guardar(uuid, text, text, text, text, integer, text, text) from public;
grant execute on function public.empresa_guardar(uuid, text, text, text, text, integer, text, text) to authenticated;

create or replace function public.contacto_guardar(p_id uuid, p_empresa_id uuid, p_nombre text, p_cargo text, p_telefono text, p_email text, p_es_decisor boolean)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  if not public._plat_ok(array['ventas']) then raise exception 'No autorizado'; end if;
  if p_nombre is null or length(trim(p_nombre)) = 0 then raise exception 'El nombre es obligatorio'; end if;
  if p_id is null then
    insert into public.plataforma_contactos (empresa_id, nombre, cargo, telefono, email, es_decisor)
      values (p_empresa_id, trim(p_nombre), p_cargo, p_telefono, p_email, coalesce(p_es_decisor,false)) returning id into v_id;
  else
    update public.plataforma_contactos set nombre = trim(p_nombre), cargo = p_cargo, telefono = p_telefono, email = p_email,
      es_decisor = coalesce(p_es_decisor,false) where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;
revoke all on function public.contacto_guardar(uuid, uuid, text, text, text, text, boolean) from public;
grant execute on function public.contacto_guardar(uuid, uuid, text, text, text, text, boolean) to authenticated;

create or replace function public.contacto_eliminar(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['ventas']) then raise exception 'No autorizado'; end if;
  delete from public.plataforma_contactos where id = p_id;
end $$;
revoke all on function public.contacto_eliminar(uuid) from public;
grant execute on function public.contacto_eliminar(uuid) to authenticated;

-- ---------- Oportunidades (extiende lead_guardar sin romper su firma anterior) ----------
create or replace function public.oportunidad_guardar(
  p_id uuid, p_empresa_id uuid, p_valor_mensual numeric, p_etapa text, p_plan_interes text, p_num_sedes integer,
  p_probabilidad integer, p_proximo_paso text, p_proximo_paso_fecha date, p_fuente text, p_motivo_perdida text, p_notas text
) returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; v_e record; v_etapa_ant text;
begin
  if not public._plat_ok(array['ventas']) then raise exception 'No autorizado'; end if;
  select * into v_e from public.plataforma_empresas where id = p_empresa_id;
  if v_e is null then raise exception 'Empresa no encontrada'; end if;
  if p_etapa not in ('prospecto','demo','propuesta','negociacion','ganado','perdido') then raise exception 'Etapa no válida'; end if;
  if p_etapa = 'perdido' and (p_motivo_perdida is null or length(trim(p_motivo_perdida)) < 3) then
    raise exception 'Indica el motivo por el que se perdió';
  end if;
  if p_id is null then
    insert into public.plataforma_leads (nombre, tipo, ciudad, empresa_id, valor_mensual, etapa, plan_interes, num_sedes, probabilidad,
        proximo_paso, proximo_paso_fecha, fuente, motivo_perdida, notas, responsable_id)
      values (v_e.nombre, v_e.tipo, v_e.ciudad, p_empresa_id, coalesce(p_valor_mensual,0), p_etapa, p_plan_interes, p_num_sedes, p_probabilidad,
        p_proximo_paso, p_proximo_paso_fecha, p_fuente, p_motivo_perdida, p_notas, auth.uid())
      returning id into v_id;
  else
    select etapa into v_etapa_ant from public.plataforma_leads where id = p_id;
    update public.plataforma_leads set empresa_id = p_empresa_id, nombre = v_e.nombre, valor_mensual = coalesce(p_valor_mensual,0),
      etapa = p_etapa, plan_interes = p_plan_interes, num_sedes = p_num_sedes, probabilidad = p_probabilidad,
      proximo_paso = p_proximo_paso, proximo_paso_fecha = p_proximo_paso_fecha, fuente = p_fuente,
      motivo_perdida = p_motivo_perdida, notas = p_notas, updated_at = now()
      where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Oportunidad no encontrada'; end if;
  end if;
  -- Al ganar: nace el proyecto de activación (una sola vez por oportunidad).
  if p_etapa = 'ganado' and not exists (select 1 from public.plataforma_proyectos where lead_id = v_id) then
    insert into public.plataforma_proyectos (empresa_id, lead_id, nombre, etapas)
      values (p_empresa_id, v_id, 'Alta de ' || v_e.nombre, public._plantilla_etapas_alta());
  end if;
  return v_id;
end $$;
revoke all on function public.oportunidad_guardar(uuid, uuid, numeric, text, text, integer, integer, text, date, text, text, text) from public;
grant execute on function public.oportunidad_guardar(uuid, uuid, numeric, text, text, integer, integer, text, date, text, text, text) to authenticated;

-- lead_cambiar_etapa (arrastrar entre columnas) también dispara el proyecto y exige motivo si se pierde.
create or replace function public.lead_cambiar_etapa(p_id uuid, p_etapa text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_l record;
begin
  if not public._plat_ok(array['ventas']) then raise exception 'No autorizado'; end if;
  if p_etapa not in ('prospecto','demo','propuesta','negociacion','ganado','perdido') then raise exception 'Etapa no válida'; end if;
  select * into v_l from public.plataforma_leads where id = p_id;
  if v_l is null then raise exception 'Oportunidad no encontrada'; end if;
  if p_etapa = 'perdido' and (v_l.motivo_perdida is null or length(trim(v_l.motivo_perdida)) < 3) then
    raise exception 'Para marcarla como perdida, abre la oportunidad y escribe el motivo';
  end if;
  update public.plataforma_leads set etapa = p_etapa, updated_at = now() where id = p_id;
  if p_etapa = 'ganado' and not exists (select 1 from public.plataforma_proyectos where lead_id = p_id) then
    insert into public.plataforma_proyectos (empresa_id, lead_id, nombre, etapas)
      values (v_l.empresa_id, p_id, 'Alta de ' || v_l.nombre, public._plantilla_etapas_alta());
  end if;
end $$;

-- ---------- Actividades y tareas ----------
create or replace function public.actividad_registrar(p_lead_id uuid, p_empresa_id uuid, p_tipo text, p_resumen text, p_fecha timestamptz default now())
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; v_emp uuid := p_empresa_id;
begin
  if not public._plat_ok(array['ventas']) then raise exception 'No autorizado'; end if;
  if p_resumen is null or length(trim(p_resumen)) = 0 then raise exception 'Escribe qué pasó'; end if;
  if v_emp is null and p_lead_id is not null then select empresa_id into v_emp from public.plataforma_leads where id = p_lead_id; end if;
  insert into public.plataforma_actividades (lead_id, empresa_id, tipo, resumen, fecha, autor_nombre)
    values (p_lead_id, v_emp, p_tipo, trim(p_resumen), coalesce(p_fecha, now()), public._plat_nombre()) returning id into v_id;
  if p_lead_id is not null then update public.plataforma_leads set updated_at = now() where id = p_lead_id; end if;
  return v_id;
end $$;
revoke all on function public.actividad_registrar(uuid, uuid, text, text, timestamptz) from public;
grant execute on function public.actividad_registrar(uuid, uuid, text, text, timestamptz) to authenticated;

create or replace function public.tarea_guardar(p_id uuid, p_lead_id uuid, p_tenant_id uuid, p_titulo text, p_vence date)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  if not public._plat_ok(array['ventas','finanzas','soporte']) then raise exception 'No autorizado'; end if;
  if p_titulo is null or length(trim(p_titulo)) = 0 then raise exception 'Escribe la tarea'; end if;
  if p_id is null then
    insert into public.plataforma_tareas (lead_id, tenant_id, titulo, vence, responsable_id, responsable_nombre)
      values (p_lead_id, p_tenant_id, trim(p_titulo), p_vence, auth.uid(), public._plat_nombre()) returning id into v_id;
  else
    update public.plataforma_tareas set titulo = trim(p_titulo), vence = p_vence where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;
revoke all on function public.tarea_guardar(uuid, uuid, uuid, text, date) from public;
grant execute on function public.tarea_guardar(uuid, uuid, uuid, text, date) to authenticated;

create or replace function public.tarea_completar(p_id uuid, p_hecha boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['ventas','finanzas','soporte']) then raise exception 'No autorizado'; end if;
  update public.plataforma_tareas set estado = case when p_hecha then 'hecha' else 'pendiente' end,
    completada_at = case when p_hecha then now() else null end where id = p_id;
end $$;
revoke all on function public.tarea_completar(uuid, boolean) from public;
grant execute on function public.tarea_completar(uuid, boolean) to authenticated;

create or replace function public.tareas_listar()
returns table(id uuid, titulo text, vence date, estado text, responsable text, lead_id uuid, empresa text, tenant_id uuid, estudio text)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['ventas','finanzas','soporte']) then raise exception 'No autorizado'; end if;
  return query select t.id, t.titulo, t.vence, t.estado, t.responsable_nombre, t.lead_id, l.nombre, t.tenant_id, te.name
    from public.plataforma_tareas t
    left join public.plataforma_leads l on l.id = t.lead_id
    left join public.tenants te on te.id = t.tenant_id
    order by (t.estado = 'hecha'), t.vence nulls last, t.created_at;
end $$;
revoke all on function public.tareas_listar() from public;
grant execute on function public.tareas_listar() to authenticated;

-- Ficha completa de una oportunidad / empresa.
create or replace function public.crm_detalle(p_lead_id uuid)
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare v_l record;
begin
  if not public._plat_ok(array['ventas']) then raise exception 'No autorizado'; end if;
  select * into v_l from public.plataforma_leads where id = p_lead_id;
  if v_l is null then return null; end if;
  return json_build_object(
    'oportunidad', to_json(v_l),
    'empresa', (select to_json(e) from public.plataforma_empresas e where e.id = v_l.empresa_id),
    'contactos', coalesce((select json_agg(c order by c.es_decisor desc, c.nombre) from public.plataforma_contactos c where c.empresa_id = v_l.empresa_id), '[]'::json),
    'actividades', coalesce((select json_agg(a order by a.fecha desc) from (select * from public.plataforma_actividades where lead_id = p_lead_id or empresa_id = v_l.empresa_id order by fecha desc limit 50) a), '[]'::json),
    'tareas', coalesce((select json_agg(t order by (t.estado = 'hecha'), t.vence nulls last) from public.plataforma_tareas t where t.lead_id = p_lead_id), '[]'::json),
    'proyecto_id', (select id from public.plataforma_proyectos where lead_id = p_lead_id limit 1)
  );
end $$;
revoke all on function public.crm_detalle(uuid) from public;
grant execute on function public.crm_detalle(uuid) to authenticated;

create or replace function public.empresas_listar()
returns table(id uuid, nombre text, tipo text, ciudad text, tenant_id uuid, num_contactos bigint, num_oportunidades bigint)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['ventas']) then raise exception 'No autorizado'; end if;
  return query select e.id, e.nombre, e.tipo, e.ciudad, e.tenant_id,
    (select count(*) from public.plataforma_contactos c where c.empresa_id = e.id),
    (select count(*) from public.plataforma_leads l where l.empresa_id = e.id)
    from public.plataforma_empresas e order by e.nombre;
end $$;
revoke all on function public.empresas_listar() from public;
grant execute on function public.empresas_listar() to authenticated;

-- ---------- Proyectos de activación ----------
create or replace function public.proyectos_listar()
returns setof public.plataforma_proyectos language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['ventas','soporte']) then raise exception 'No autorizado'; end if;
  return query select * from public.plataforma_proyectos order by (estado <> 'en_curso'), created_at desc;
end $$;
revoke all on function public.proyectos_listar() from public;
grant execute on function public.proyectos_listar() to authenticated;

create or replace function public.proyecto_etapa(p_id uuid, p_key text, p_hecha boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['ventas','soporte']) then raise exception 'No autorizado'; end if;
  update public.plataforma_proyectos p set etapas = (
    select jsonb_agg(case when e->>'key' = p_key then e || jsonb_build_object('hecha', p_hecha, 'fecha', now()) else e end)
    from jsonb_array_elements(p.etapas) e) where p.id = p_id and p.estado = 'en_curso';
  if not found then raise exception 'Proyecto no encontrado o ya no está en curso'; end if;
end $$;
revoke all on function public.proyecto_etapa(uuid, text, boolean) from public;
grant execute on function public.proyecto_etapa(uuid, text, boolean) to authenticated;

create or replace function public.proyecto_vincular_estudio(p_id uuid, p_tenant_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.soy_staff_plataforma() then raise exception 'No autorizado'; end if;
  update public.plataforma_proyectos set tenant_id = p_tenant_id where id = p_id;
  update public.plataforma_empresas set tenant_id = p_tenant_id where id = (select empresa_id from public.plataforma_proyectos where id = p_id);
end $$;
revoke all on function public.proyecto_vincular_estudio(uuid, uuid) from public;
grant execute on function public.proyecto_vincular_estudio(uuid, uuid) to authenticated;

-- Salida a producción: solo el operador, y solo con las etapas obligatorias completas.
create or replace function public.proyecto_publicar(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_p record; v_falta text;
begin
  if not public.soy_staff_plataforma() then raise exception 'Solo el operador puede aprobar la salida en vivo'; end if;
  select * into v_p from public.plataforma_proyectos where id = p_id;
  if v_p is null then raise exception 'Proyecto no encontrado'; end if;
  if v_p.tenant_id is null then raise exception 'Vincula primero el estudio creado'; end if;
  select string_agg(e->>'nombre', ', ') into v_falta from jsonb_array_elements(v_p.etapas) e
    where (e->>'obligatoria')::boolean and not (e->>'hecha')::boolean;
  if v_falta is not null then raise exception 'Faltan etapas obligatorias: %', v_falta; end if;
  update public.plataforma_proyectos set estado = 'en_vivo', en_vivo_at = now() where id = p_id;
  update public.tenants set status = 'activo' where id = v_p.tenant_id;
end $$;
revoke all on function public.proyecto_publicar(uuid) from public;
grant execute on function public.proyecto_publicar(uuid) to authenticated;
