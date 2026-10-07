-- Flujo comercial con puertas (auditoría owner O-03, O-04, O-09):
--   * fecha de Guatemala centralizada (hoy_gt) y usada en cobros/costos/contratos
--   * planes con estado borrador/publicado/retirado, moneda, versión y prueba gratuita explícita; nada se vende en Q0
--   * suscripciones solo con planes del catálogo; contrato vinculado a la suscripción
--   * contratos con estados (borrador → enviado → firmado → vigente → vencido/cancelado)
--   * "Ganado" exige propuesta aceptada o contrato, o una excepción con motivo
--   * alta guiada desde contrato (resumible, con detección de duplicados) y alta manual excepcional con motivo
--   * puertas para salir en vivo y estados por módulo (contratado/habilitado/configurado/probado/en producción)
--   * vista previa de cobros del mes y generación sin duplicados ni estudios no activos

-- ───────────────────────── Fecha de Guatemala ─────────────────────────
create or replace function public.hoy_gt() returns date language sql stable
as $$ select (now() at time zone 'America/Guatemala')::date $$;
revoke all on function public.hoy_gt() from public, anon;
grant execute on function public.hoy_gt() to authenticated;

do $$
declare r record; v_def text;
begin
  for r in select p.oid, p.proname from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and p.proname in ('plataforma_estudios_cobro','plataforma_cobros_listar','registrar_pago_cobro','cobro_crear','costo_guardar')
             and p.prosrc ilike '%current_date%'
  loop
    v_def := replace(pg_get_functiondef(r.oid), 'current_date', 'public.hoy_gt()');
    execute v_def;
  end loop;
  for r in select table_name, column_name from information_schema.columns
           where table_schema = 'public'
             and table_name in ('plataforma_contratos','plataforma_suscripciones','plataforma_costos','plataforma_pagos','plataforma_cobros','plataforma_propuestas','plataforma_leads')
             and column_default = 'CURRENT_DATE'
  loop
    execute format('alter table public.%I alter column %I set default public.hoy_gt()', r.table_name, r.column_name);
  end loop;
end $$;

-- ───────────────────────── Planes ─────────────────────────
alter table public.plataforma_planes
  add column if not exists estado text not null default 'publicado',
  add column if not exists moneda text not null default 'GTQ',
  add column if not exists prueba_gratuita boolean not null default false,
  add column if not exists version integer not null default 1,
  add column if not exists publicado_at timestamptz;

do $$ begin
  alter table public.plataforma_planes add constraint plataforma_planes_estado_chk check (estado in ('borrador','publicado','retirado'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.plataforma_planes add constraint plataforma_planes_moneda_chk check (moneda in ('GTQ','USD'));
exception when duplicate_object then null; end $$;

-- Los planes que hoy están en Q0 no se pueden vender: pasan a borrador hasta que se les ponga precio.
update public.plataforma_planes set estado = case when precio_mensual > 0 or prueba_gratuita then 'publicado' else 'borrador' end,
  publicado_at = case when precio_mensual > 0 or prueba_gratuita then coalesce(publicado_at, now()) end;
update public.plataforma_planes set activo = (estado = 'publicado');

do $$ begin
  alter table public.plataforma_planes add constraint plataforma_planes_publicado_precio_chk
    check (estado <> 'publicado' or precio_mensual > 0 or prueba_gratuita);
exception when duplicate_object then null; end $$;

create or replace function public._sync_plan_activo() returns trigger language plpgsql as $$
begin
  new.activo := (new.estado = 'publicado');
  return new;
end $$;
drop trigger if exists plataforma_planes_sync_activo on public.plataforma_planes;
create trigger plataforma_planes_sync_activo before insert or update on public.plataforma_planes
  for each row execute function public._sync_plan_activo();

drop function if exists public.plan_guardar(text, text, text, numeric, integer, integer, text[], boolean);
create or replace function public.plan_guardar(
  p_key text, p_nombre text, p_descripcion text, p_precio numeric, p_max_sedes integer, p_max_staff integer, p_modulos text[],
  p_activo boolean default null, p_estado text default null, p_moneda text default 'GTQ',
  p_prueba_gratuita boolean default false, p_crear boolean default false
) returns void language plpgsql security definer set search_path to 'public' as $$
declare v_m text; v_dep text; v_estado text; v_ant record; v_ver integer := 1; v_existe boolean;
begin
  if not public.soy_staff_plataforma() then raise exception 'No autorizado'; end if;
  if p_key !~ '^[a-z0-9_]{2,30}$' then raise exception 'La clave del plan solo admite minúsculas, números y guion bajo'; end if;
  if p_nombre is null or length(trim(p_nombre)) < 2 then raise exception 'El plan necesita un nombre'; end if;
  if p_precio is null or p_precio < 0 then raise exception 'El precio mensual es obligatorio (usa un monto mayor a 0, o marca el plan como prueba gratuita)'; end if;
  if coalesce(p_moneda,'GTQ') not in ('GTQ','USD') then raise exception 'Moneda no válida'; end if;
  foreach v_m in array coalesce(p_modulos, '{}') loop
    if not exists (select 1 from public.module_catalog where key = v_m) then raise exception 'Módulo desconocido: %', v_m; end if;
    for v_dep in select unnest(depends_on) from public.module_catalog where key = v_m loop
      if not (v_dep = any(p_modulos)) then
        raise exception 'El módulo "%" requiere "%" dentro del mismo plan', v_m, v_dep;
      end if;
    end loop;
  end loop;
  select * into v_ant from public.plataforma_planes where key = p_key;
  v_existe := found;
  if v_existe and p_crear then raise exception 'Ya existe un plan con la clave "%". Edítalo desde la lista.', p_key; end if;
  v_estado := coalesce(p_estado, case when p_activo is false then 'retirado'
                                       when p_precio > 0 or coalesce(p_prueba_gratuita,false) then 'publicado' else 'borrador' end);
  if v_estado not in ('borrador','publicado','retirado') then raise exception 'Estado de plan no válido'; end if;
  if v_estado = 'publicado' and p_precio <= 0 and not coalesce(p_prueba_gratuita,false) then
    raise exception 'No se puede publicar un plan en Q0. Define el precio o márcalo explícitamente como prueba gratuita.';
  end if;
  if v_existe then
    v_ver := v_ant.version + case when v_ant.precio_mensual is distinct from p_precio or v_ant.modulos is distinct from coalesce(p_modulos,'{}')
                                    or v_ant.max_sedes is distinct from p_max_sedes or v_ant.max_staff is distinct from p_max_staff then 1 else 0 end;
  end if;
  insert into public.plataforma_planes (key, nombre, descripcion, precio_mensual, max_sedes, max_staff, modulos, estado, moneda, prueba_gratuita, version, publicado_at)
    values (p_key, trim(p_nombre), p_descripcion, p_precio, p_max_sedes, p_max_staff, coalesce(p_modulos,'{}'), v_estado, coalesce(p_moneda,'GTQ'),
            coalesce(p_prueba_gratuita,false), v_ver, case when v_estado = 'publicado' then now() end)
  on conflict (key) do update set nombre = excluded.nombre, descripcion = excluded.descripcion,
    precio_mensual = excluded.precio_mensual, max_sedes = excluded.max_sedes, max_staff = excluded.max_staff,
    modulos = excluded.modulos, estado = excluded.estado, moneda = excluded.moneda, prueba_gratuita = excluded.prueba_gratuita,
    version = excluded.version,
    publicado_at = case when excluded.estado = 'publicado' then coalesce(public.plataforma_planes.publicado_at, now()) else public.plataforma_planes.publicado_at end;
end $$;
revoke all on function public.plan_guardar(text, text, text, numeric, integer, integer, text[], boolean, text, text, boolean, boolean) from public, anon;
grant execute on function public.plan_guardar(text, text, text, numeric, integer, integer, text[], boolean, text, text, boolean, boolean) to authenticated;

create or replace function public.plan_impacto(p_key text) returns json
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['finanzas','ventas','soporte']) then raise exception 'No autorizado'; end if;
  return (select json_build_object(
    'suscripciones_activas', count(*) filter (where s.estado = 'activa'),
    'estudios', count(*),
    'mrr', coalesce(sum(s.precio_mensual) filter (where s.estado = 'activa'), 0),
    'propuestas_abiertas', (select count(*) from public.plataforma_propuestas where plan_key = p_key and estado in ('borrador','enviada','negociando')))
    from public.plataforma_suscripciones s where s.plan = p_key);
end $$;
revoke all on function public.plan_impacto(text) from public, anon;
grant execute on function public.plan_impacto(text) to authenticated;

-- ───────────────────────── Suscripciones y propuestas: solo con plan del catálogo ─────────────────────────
alter table public.plataforma_suscripciones add column if not exists contrato_id uuid references public.plataforma_contratos(id) on delete set null;

create or replace function public._valida_suscripcion() returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_p record;
begin
  select * into v_p from public.plataforma_planes where key = new.plan;
  if v_p is null then raise exception 'El plan "%" no está en el catálogo. Elige uno de la lista de Planes.', new.plan; end if;
  if (tg_op = 'INSERT' or new.plan is distinct from old.plan) and v_p.estado <> 'publicado' then
    raise exception 'El plan "%" está en estado % y no se puede asignar. Publícalo primero en Planes.', v_p.nombre, v_p.estado;
  end if;
  if new.estado = 'activa' and new.precio_mensual <= 0 and not v_p.prueba_gratuita then
    raise exception 'No se puede activar una suscripción en Q0: el plan "%" no es de prueba gratuita.', v_p.nombre;
  end if;
  return new;
end $$;
drop trigger if exists plataforma_suscripciones_valida on public.plataforma_suscripciones;
create trigger plataforma_suscripciones_valida before insert or update on public.plataforma_suscripciones
  for each row execute function public._valida_suscripcion();

create or replace function public._valida_propuesta() returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_p record;
begin
  if new.estado in ('enviada','negociando','aceptada') then
    if new.plan_key is null then raise exception 'La propuesta necesita un plan del catálogo antes de enviarse'; end if;
    select * into v_p from public.plataforma_planes where key = new.plan_key;
    if v_p is null then raise exception 'El plan "%" no existe en el catálogo', new.plan_key; end if;
    if (tg_op = 'INSERT' or new.plan_key is distinct from old.plan_key) and v_p.estado <> 'publicado' then
      raise exception 'El plan "%" no está publicado: no se puede ofrecer en una propuesta', v_p.nombre;
    end if;
    if new.mensualidad <= 0 and not v_p.prueba_gratuita then
      raise exception 'La mensualidad no puede ser Q0 salvo en un plan de prueba gratuita';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists plataforma_propuestas_valida on public.plataforma_propuestas;
create trigger plataforma_propuestas_valida before insert or update on public.plataforma_propuestas
  for each row execute function public._valida_propuesta();

create or replace function public.suscripcion_guardar(p_tenant_id uuid, p_plan text, p_precio_mensual numeric, p_dia_cobro integer, p_estado text, p_notas text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['finanzas']) then raise exception 'No autorizado'; end if;
  if not exists (select 1 from public.tenants where id = p_tenant_id) then raise exception 'Estudio no encontrado'; end if;
  if p_estado not in ('activa','pausada','cancelada') then raise exception 'Estado no válido'; end if;
  if p_plan is null or length(trim(p_plan)) = 0 then raise exception 'Elige un plan del catálogo'; end if;
  insert into public.plataforma_suscripciones (tenant_id, plan, precio_mensual, dia_cobro, estado, notas)
    values (p_tenant_id, p_plan, p_precio_mensual, p_dia_cobro, p_estado, p_notas)
  on conflict (tenant_id) do update set plan = excluded.plan, precio_mensual = excluded.precio_mensual,
    dia_cobro = excluded.dia_cobro, estado = excluded.estado, notas = excluded.notas, updated_at = now();
end $$;

-- ───────────────────────── Contratos con estados ─────────────────────────
alter table public.plataforma_contratos
  add column if not exists version_terminos text,
  add column if not exists firmantes text,
  add column if not exists alcance_sedes integer,
  add column if not exists alcance_modulos text[] not null default '{}';
alter table public.plataforma_contratos drop constraint if exists plataforma_contratos_estado_check;
do $$ begin
  alter table public.plataforma_contratos add constraint plataforma_contratos_estado_chk
    check (estado in ('borrador','enviado','firmado','vigente','vencido','cancelado'));
exception when duplicate_object then null; end $$;

drop function if exists public.contrato_crear(uuid, date, integer, boolean, text, text);
create or replace function public.contrato_crear(p_propuesta_id uuid, p_fecha_firma date, p_vigencia_meses integer, p_renovacion_auto boolean,
  p_documento_url text, p_notas text, p_version_terminos text default null, p_firmantes text default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_p record; v_pl record; v_id uuid;
begin
  if not public._plat_ok(array['ventas','finanzas']) then raise exception 'No autorizado'; end if;
  select * into v_p from public.plataforma_propuestas where id = p_propuesta_id;
  if v_p is null or v_p.estado <> 'aceptada' then raise exception 'Solo se crea contrato desde una propuesta aceptada'; end if;
  if exists (select 1 from public.plataforma_contratos where propuesta_id = p_propuesta_id and estado <> 'cancelado') then raise exception 'Esa propuesta ya tiene contrato'; end if;
  select * into v_pl from public.plataforma_planes where key = v_p.plan_key;
  if v_pl is null then raise exception 'La propuesta no tiene un plan del catálogo'; end if;
  insert into public.plataforma_contratos (lead_id, propuesta_id, estado, fecha_firma, vigencia_meses, renovacion_auto, mensualidad, setup_monto, documento_url, notas,
      version_terminos, firmantes, alcance_sedes, alcance_modulos)
    values (v_p.lead_id, p_propuesta_id, 'borrador', coalesce(p_fecha_firma, public.hoy_gt()), coalesce(p_vigencia_meses,12), coalesce(p_renovacion_auto,true),
      v_p.mensualidad, v_p.setup_monto, p_documento_url, p_notas, p_version_terminos, p_firmantes,
      coalesce(v_p.num_sedes,1) + coalesce(v_p.sedes_extra,0),
      (select coalesce(array_agg(distinct m), '{}') from unnest(v_pl.modulos || coalesce(v_p.modulos_extra,'{}')) m))
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.contrato_estado(p_id uuid, p_estado text, p_fecha_firma date default null, p_firmantes text default null, p_motivo text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_c record; v_ok boolean;
begin
  if not public._plat_ok(array['ventas','finanzas']) then raise exception 'No autorizado'; end if;
  select * into v_c from public.plataforma_contratos where id = p_id for update;
  if v_c is null then raise exception 'Contrato no encontrado'; end if;
  v_ok := (v_c.estado, p_estado) in (('borrador','enviado'),('enviado','firmado'),('firmado','vigente'),('vigente','vencido'),
                                    ('borrador','cancelado'),('enviado','cancelado'),('firmado','cancelado'),('vigente','cancelado'));
  if not v_ok then raise exception 'Un contrato en estado "%" no puede pasar a "%"', v_c.estado, p_estado; end if;
  if p_estado = 'firmado' and length(trim(coalesce(p_firmantes, v_c.firmantes, ''))) < 3 then
    raise exception 'Para marcarlo como firmado indica quiénes firmaron (firmantes)';
  end if;
  if p_estado = 'cancelado' and length(trim(coalesce(p_motivo,''))) < 3 then raise exception 'Indica el motivo de la cancelación'; end if;
  update public.plataforma_contratos set estado = p_estado,
    fecha_firma = case when p_estado = 'firmado' then coalesce(p_fecha_firma, public.hoy_gt()) else fecha_firma end,
    firmantes = coalesce(nullif(trim(p_firmantes),''), firmantes),
    notas = case when p_estado = 'cancelado' then coalesce(notas || E'\n','') || 'Cancelado: ' || p_motivo else notas end
  where id = p_id;
end $$;
revoke all on function public.contrato_estado(uuid, text, date, text, text) from public, anon;
grant execute on function public.contrato_estado(uuid, text, date, text, text) to authenticated;

create or replace function public.contrato_actualizar(p_id uuid, p_estado text, p_tenant_id uuid, p_renovacion_auto boolean, p_documento_url text, p_notas text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_c record;
begin
  if not public._plat_ok(array['ventas','finanzas']) then raise exception 'No autorizado'; end if;
  select * into v_c from public.plataforma_contratos where id = p_id;
  if v_c is null then raise exception 'Contrato no encontrado'; end if;
  update public.plataforma_contratos set tenant_id = p_tenant_id, renovacion_auto = coalesce(p_renovacion_auto, renovacion_auto),
    documento_url = p_documento_url, notas = p_notas where id = p_id;
  if p_estado is distinct from v_c.estado then
    perform public.contrato_estado(p_id, p_estado, null, null, p_notas);
  end if;
end $$;

create or replace function public._aplicar_contrato(p_id uuid, p_activa boolean) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_c record; v_p record;
begin
  select * into v_c from public.plataforma_contratos where id = p_id;
  if v_c is null or v_c.tenant_id is null then raise exception 'Vincula primero el estudio al contrato'; end if;
  if v_c.estado <> 'vigente' then raise exception 'El contrato está en estado "%": solo un contrato vigente se aplica a la suscripción', v_c.estado; end if;
  select * into v_p from public.plataforma_propuestas where id = v_c.propuesta_id;
  if v_p is null or v_p.plan_key is null then raise exception 'La propuesta del contrato no tiene un plan del catálogo'; end if;
  insert into public.plataforma_suscripciones (tenant_id, plan, precio_mensual, estado, contrato_id)
    values (v_c.tenant_id, v_p.plan_key, v_c.mensualidad, case when p_activa then 'activa' else 'pausada' end, p_id)
  on conflict (tenant_id) do update set plan = excluded.plan, precio_mensual = excluded.precio_mensual, contrato_id = excluded.contrato_id,
    estado = case when p_activa then 'activa' else public.plataforma_suscripciones.estado end, updated_at = now();
end $$;
revoke all on function public._aplicar_contrato(uuid, boolean) from public, anon, authenticated;

create or replace function public.contrato_aplicar_suscripcion(p_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_t uuid;
begin
  if not public._plat_ok(array['finanzas']) then raise exception 'No autorizado'; end if;
  select tenant_id into v_t from public.plataforma_contratos where id = p_id;
  perform public._aplicar_contrato(p_id, not exists (select 1 from public.plataforma_proyectos where tenant_id = v_t and estado = 'en_curso'));
end $$;

drop function if exists public.contratos_listar();
create or replace function public.contratos_listar()
returns table(id uuid, lead_id uuid, empresa text, tenant_id uuid, estudio text, estado text, fecha_firma date, vigencia_meses integer, fecha_vencimiento date,
  dias_para_vencer integer, renovacion_auto boolean, mensualidad numeric, setup_monto numeric, documento_url text, notas text, version_propuesta integer,
  plan_key text, version_terminos text, firmantes text, alcance_sedes integer, alcance_modulos text[], con_suscripcion boolean)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['ventas','finanzas']) then raise exception 'No autorizado'; end if;
  return query
  select c.id, c.lead_id, l.nombre, c.tenant_id, t.name,
    case when c.estado = 'vigente' and (c.fecha_firma + make_interval(months => c.vigencia_meses))::date < public.hoy_gt() then 'vencido' else c.estado end,
    c.fecha_firma, c.vigencia_meses, (c.fecha_firma + make_interval(months => c.vigencia_meses))::date,
    ((c.fecha_firma + make_interval(months => c.vigencia_meses))::date - public.hoy_gt()),
    c.renovacion_auto, c.mensualidad, c.setup_monto, c.documento_url, c.notas, p.version,
    p.plan_key, c.version_terminos, c.firmantes, c.alcance_sedes, c.alcance_modulos,
    exists (select 1 from public.plataforma_suscripciones s where s.contrato_id = c.id)
  from public.plataforma_contratos c
  left join public.plataforma_leads l on l.id = c.lead_id
  left join public.tenants t on t.id = c.tenant_id
  left join public.plataforma_propuestas p on p.id = c.propuesta_id
  order by (c.estado in ('cancelado','vencido')), c.created_at desc;
end $$;
revoke all on function public.contratos_listar() from public, anon;
grant execute on function public.contratos_listar() to authenticated;

-- ───────────────────────── Pipeline: "Ganado" con respaldo ─────────────────────────
alter table public.plataforma_leads
  add column if not exists ganado_excepcion text,
  add column if not exists ganado_excepcion_por uuid,
  add column if not exists ganado_excepcion_at timestamptz;

create or replace function public._lead_respaldado(p_lead uuid) returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.plataforma_propuestas where lead_id = p_lead and estado = 'aceptada')
      or exists (select 1 from public.plataforma_contratos where lead_id = p_lead and estado <> 'cancelado');
$$;
revoke all on function public._lead_respaldado(uuid) from public, anon, authenticated;

drop function if exists public.lead_cambiar_etapa(uuid, text);
create or replace function public.lead_cambiar_etapa(p_id uuid, p_etapa text, p_excepcion text default null) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_l record;
begin
  if not public._plat_ok(array['ventas']) then raise exception 'No autorizado'; end if;
  if p_etapa not in ('prospecto','demo','propuesta','negociacion','ganado','perdido') then raise exception 'Etapa no válida'; end if;
  select * into v_l from public.plataforma_leads where id = p_id;
  if v_l is null then raise exception 'Oportunidad no encontrada'; end if;
  if p_etapa = 'perdido' and (v_l.motivo_perdida is null or length(trim(v_l.motivo_perdida)) < 3) then
    raise exception 'Para marcarla como perdida, abre la oportunidad y escribe el motivo';
  end if;
  if p_etapa = 'ganado' and not public._lead_respaldado(p_id) then
    if p_excepcion is null or length(trim(p_excepcion)) < 10 then
      raise exception 'No se puede marcar como Ganado sin una propuesta aceptada o un contrato. Acepta la propuesta o registra una excepción con motivo (mínimo 10 caracteres).';
    end if;
    update public.plataforma_leads set ganado_excepcion = trim(p_excepcion), ganado_excepcion_por = auth.uid(), ganado_excepcion_at = now() where id = p_id;
  end if;
  update public.plataforma_leads set etapa = p_etapa, updated_at = now() where id = p_id;
  if p_etapa = 'ganado' and not exists (select 1 from public.plataforma_proyectos where lead_id = p_id) then
    insert into public.plataforma_proyectos (empresa_id, lead_id, nombre, etapas)
      values (v_l.empresa_id, p_id, 'Alta de ' || v_l.nombre, public._plantilla_etapas_alta());
  end if;
end $$;
revoke all on function public.lead_cambiar_etapa(uuid, text, text) from public, anon;
grant execute on function public.lead_cambiar_etapa(uuid, text, text) to authenticated;

drop function if exists public.oportunidad_guardar(uuid, uuid, numeric, text, text, integer, integer, text, date, text, text, text);
create or replace function public.oportunidad_guardar(p_id uuid, p_empresa_id uuid, p_valor_mensual numeric, p_etapa text, p_plan_interes text,
  p_num_sedes integer, p_probabilidad integer, p_proximo_paso text, p_proximo_paso_fecha date, p_fuente text, p_motivo_perdida text, p_notas text,
  p_excepcion text default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; v_e record; v_ant record;
begin
  if not public._plat_ok(array['ventas']) then raise exception 'No autorizado'; end if;
  select * into v_e from public.plataforma_empresas where id = p_empresa_id;
  if v_e is null then raise exception 'Empresa no encontrada'; end if;
  if p_etapa not in ('prospecto','demo','propuesta','negociacion','ganado','perdido') then raise exception 'Etapa no válida'; end if;
  if p_etapa = 'perdido' and (p_motivo_perdida is null or length(trim(p_motivo_perdida)) < 3) then
    raise exception 'Indica el motivo por el que se perdió';
  end if;
  if p_etapa in ('prospecto','demo','propuesta','negociacion')
     and (p_proximo_paso is null or length(trim(p_proximo_paso)) < 3 or p_proximo_paso_fecha is null) then
    raise exception 'Toda oportunidad abierta necesita su próxima acción y la fecha en que se hará';
  end if;
  if p_id is not null then
    select * into v_ant from public.plataforma_leads where id = p_id;
    if v_ant is null then raise exception 'Oportunidad no encontrada'; end if;
  end if;
  if p_etapa = 'ganado' and (p_id is null or not public._lead_respaldado(p_id)) and (p_excepcion is null or length(trim(p_excepcion)) < 10) then
    raise exception 'No se puede marcar como Ganado sin una propuesta aceptada o un contrato. Registra una excepción con motivo (mínimo 10 caracteres).';
  end if;
  if p_id is null then
    insert into public.plataforma_leads (nombre, tipo, ciudad, empresa_id, valor_mensual, etapa, plan_interes, num_sedes, probabilidad,
        proximo_paso, proximo_paso_fecha, fuente, motivo_perdida, notas, responsable_id)
      values (v_e.nombre, v_e.tipo, v_e.ciudad, p_empresa_id, coalesce(p_valor_mensual,0), p_etapa, p_plan_interes, p_num_sedes, p_probabilidad,
        p_proximo_paso, p_proximo_paso_fecha, p_fuente, p_motivo_perdida, p_notas, auth.uid())
      returning id into v_id;
  else
    update public.plataforma_leads set empresa_id = p_empresa_id, nombre = v_e.nombre, valor_mensual = coalesce(p_valor_mensual,0),
      etapa = p_etapa, plan_interes = p_plan_interes, num_sedes = p_num_sedes, probabilidad = p_probabilidad,
      proximo_paso = p_proximo_paso, proximo_paso_fecha = p_proximo_paso_fecha, fuente = p_fuente,
      motivo_perdida = p_motivo_perdida, notas = p_notas, updated_at = now()
      where id = p_id returning id into v_id;
  end if;
  if p_etapa = 'ganado' and not public._lead_respaldado(v_id) then
    update public.plataforma_leads set ganado_excepcion = trim(p_excepcion), ganado_excepcion_por = auth.uid(), ganado_excepcion_at = now() where id = v_id;
  end if;
  if p_etapa = 'ganado' and not exists (select 1 from public.plataforma_proyectos where lead_id = v_id) then
    insert into public.plataforma_proyectos (empresa_id, lead_id, nombre, etapas)
      values (p_empresa_id, v_id, 'Alta de ' || v_e.nombre, public._plantilla_etapas_alta());
  end if;
  return v_id;
end $$;
revoke all on function public.oportunidad_guardar(uuid, uuid, numeric, text, text, integer, integer, text, date, text, text, text, text) from public, anon;
grant execute on function public.oportunidad_guardar(uuid, uuid, numeric, text, text, integer, integer, text, date, text, text, text, text) to authenticated;

-- ───────────────────────── Estados por módulo ─────────────────────────
create table if not exists public.tenant_modulo_estado (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  module_key text not null references public.module_catalog(key) on delete cascade,
  configurado_at timestamptz, configurado_por uuid,
  probado_at timestamptz, probado_por uuid, evidencia text,
  produccion_at timestamptz, produccion_por uuid,
  primary key (tenant_id, module_key)
);
alter table public.tenant_modulo_estado enable row level security;
revoke all on public.tenant_modulo_estado from anon, authenticated;

create or replace function public._modulos_estado(p_tenant uuid)
returns table(module_key text, nombre text, contratado boolean, habilitado boolean, configurado boolean, probado boolean, produccion boolean,
              estado text, falta text, evidencia text)
language sql stable security definer set search_path to 'public' as $$
  with contratados as (
    select unnest(coalesce((select p.modulos from public.plataforma_suscripciones s join public.plataforma_planes p on p.key = s.plan
                            where s.tenant_id = p_tenant and s.estado <> 'cancelada'), '{}')
                  || coalesce((select c.alcance_modulos from public.plataforma_contratos c where c.tenant_id = p_tenant and c.estado = 'vigente'
                               order by c.created_at desc limit 1), '{}')) as k
  ), base as (
    select m.key, m.name,
      exists (select 1 from contratados c where c.k = m.key) as contratado,
      coalesce((select e.enabled from public.tenant_entitlements e where e.tenant_id = p_tenant and e.module_key = m.key), false) as habilitado,
      (s.configurado_at is not null) as configurado, (s.probado_at is not null) as probado, (s.produccion_at is not null) as produccion, s.evidencia
    from public.module_catalog m left join public.tenant_modulo_estado s on s.tenant_id = p_tenant and s.module_key = m.key
  )
  select b.key, b.name, b.contratado, b.habilitado, b.configurado, b.probado, b.produccion,
    case when b.produccion then 'en_produccion' when b.probado then 'probado' when b.configurado then 'configurado'
         when b.habilitado then 'habilitado' when b.contratado then 'contratado' else 'no_contratado' end,
    case when b.habilitado and not b.contratado then 'Está encendido pero no figura en el plan ni en el contrato: regularízalo o apágalo'
         when b.contratado and not b.habilitado then 'Contratado pero apagado: falta habilitarlo'
         when not b.contratado then null
         when not b.configurado then 'Falta configurarlo (ajustes y proveedor si aplica)'
         when not b.probado then 'Falta una prueba con evidencia'
         when not b.produccion then 'Probado: falta la aprobación para producción'
         else null end,
    b.evidencia
  from base b order by b.name;
$$;
revoke all on function public._modulos_estado(uuid) from public, anon, authenticated;

create or replace function public.modulos_estado_listar(p_tenant_id uuid)
returns table(module_key text, nombre text, contratado boolean, habilitado boolean, configurado boolean, probado boolean, produccion boolean,
              estado text, falta text, evidencia text)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['soporte','ventas','finanzas']) then raise exception 'No autorizado'; end if;
  return query select * from public._modulos_estado(p_tenant_id) e where e.contratado or e.habilitado;
end $$;
revoke all on function public.modulos_estado_listar(uuid) from public, anon;
grant execute on function public.modulos_estado_listar(uuid) to authenticated;

create or replace function public.modulo_hito_marcar(p_tenant_id uuid, p_module text, p_hito text, p_hecho boolean, p_evidencia text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_e record;
begin
  if not public._plat_ok(array['soporte']) then raise exception 'No autorizado'; end if;
  if p_hito not in ('configurado','probado','produccion') then raise exception 'Hito no válido'; end if;
  select * into v_e from public._modulos_estado(p_tenant_id) e where e.module_key = p_module;
  if v_e is null then raise exception 'Módulo desconocido'; end if;
  insert into public.tenant_modulo_estado (tenant_id, module_key) values (p_tenant_id, p_module) on conflict do nothing;
  if p_hecho then
    if not v_e.habilitado then raise exception 'Primero habilita el módulo en el estudio'; end if;
    if p_hito = 'configurado' then
      update public.tenant_modulo_estado set configurado_at = now(), configurado_por = auth.uid() where tenant_id = p_tenant_id and module_key = p_module;
    elsif p_hito = 'probado' then
      if not v_e.configurado then raise exception 'Primero marca el módulo como configurado'; end if;
      if p_evidencia is null or length(trim(p_evidencia)) < 5 then raise exception 'Describe la evidencia de la prueba (qué se probó y el resultado)'; end if;
      update public.tenant_modulo_estado set probado_at = now(), probado_por = auth.uid(), evidencia = trim(p_evidencia) where tenant_id = p_tenant_id and module_key = p_module;
    else
      if not v_e.probado then raise exception 'No se puede pasar a producción un módulo sin prueba'; end if;
      if not v_e.contratado then raise exception 'El módulo no está contratado'; end if;
      update public.tenant_modulo_estado set produccion_at = now(), produccion_por = auth.uid() where tenant_id = p_tenant_id and module_key = p_module;
    end if;
  else
    update public.tenant_modulo_estado set
      configurado_at = case when p_hito = 'configurado' then null else configurado_at end,
      probado_at = case when p_hito in ('configurado','probado') then null else probado_at end,
      produccion_at = null,
      evidencia = case when p_hito in ('configurado','probado') then null else evidencia end
    where tenant_id = p_tenant_id and module_key = p_module;
  end if;
end $$;
revoke all on function public.modulo_hito_marcar(uuid, text, text, boolean, text) from public, anon;
grant execute on function public.modulo_hito_marcar(uuid, text, text, boolean, text) to authenticated;

-- ───────────────────────── Puertas para salir en vivo ─────────────────────────
alter table public.plataforma_proyectos
  add column if not exists excepcion_motivo text,
  add column if not exists excepcion_por uuid,
  add column if not exists excepcion_at timestamptz,
  add column if not exists email_duena text;

create or replace function public.proyecto_gates(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare v_p record; v_g jsonb := '[]'::jsonb; v_ok boolean; v_det text; v_s record; v_pl record; v_falta text; v_mods text; v_tiene_s boolean; v_tiene_p boolean;
begin
  if not public._plat_ok(array['ventas','soporte']) then raise exception 'No autorizado'; end if;
  select * into v_p from public.plataforma_proyectos where id = p_id;
  if v_p is null then raise exception 'Proyecto no encontrado'; end if;

  v_ok := v_p.tenant_id is not null and exists (select 1 from public.plataforma_contratos where tenant_id = v_p.tenant_id and estado = 'vigente');
  v_det := case when v_ok then 'Contrato vigente vinculado'
                when v_p.excepcion_motivo is not null then 'Sin contrato; excepción registrada: ' || v_p.excepcion_motivo
                else 'No hay un contrato vigente vinculado a este estudio' end;
  v_g := v_g || jsonb_build_object('key','contrato','nombre','Contrato vigente','ok', v_ok or v_p.excepcion_motivo is not null,'bloquea',true,'detalle',v_det);

  select * into v_s from public.plataforma_suscripciones where tenant_id = v_p.tenant_id;
  v_tiene_s := found;
  select * into v_pl from public.plataforma_planes where key = v_s.plan;
  v_tiene_p := found;
  v_ok := v_tiene_s and v_tiene_p and (v_s.precio_mensual > 0 or v_pl.prueba_gratuita);
  v_g := v_g || jsonb_build_object('key','suscripcion','nombre','Plan del catálogo y precio','ok', v_ok,'bloquea',true,
    'detalle', case when not v_tiene_s then 'El estudio no tiene suscripción' when not v_tiene_p then 'El plan no está en el catálogo'
                    when v_ok then 'Plan ' || v_pl.nombre || ' · Q' || v_s.precio_mensual || '/mes' else 'La suscripción está en Q0 y el plan no es de prueba gratuita' end);

  select string_agg(e->>'nombre', ', ') into v_falta from jsonb_array_elements(v_p.etapas) e where (e->>'obligatoria')::boolean and not (e->>'hecha')::boolean;
  v_g := v_g || jsonb_build_object('key','etapas','nombre','Etapas obligatorias del checklist','ok', v_falta is null,'bloquea',true,
    'detalle', coalesce('Faltan: ' || v_falta, 'Completas'));

  v_ok := v_p.tenant_id is not null and exists (select 1 from public.tenant_memberships where tenant_id = v_p.tenant_id and role = 'duena');
  v_g := v_g || jsonb_build_object('key','duena','nombre','Dueña con acceso','ok', v_ok,'bloquea',true,
    'detalle', case when v_ok then 'La dueña ya entró' else 'La dueña aún no aceptó la invitación' end);

  v_ok := v_p.tenant_id is not null and exists (select 1 from public.sedes where tenant_id = v_p.tenant_id and status = 'activa');
  v_g := v_g || jsonb_build_object('key','sedes','nombre','Al menos una sede activa','ok', v_ok,'bloquea',true,
    'detalle', case when v_ok then 'Con sede activa' else 'No hay sedes activas' end);

  if v_p.tenant_id is not null then
    select string_agg(e.nombre, ', ') into v_mods from public._modulos_estado(v_p.tenant_id) e where e.contratado and not e.probado;
  end if;
  v_g := v_g || jsonb_build_object('key','modulos','nombre','Módulos contratados probados','ok', v_mods is null,'bloquea',false,
    'detalle', coalesce('Sin prueba registrada: ' || v_mods, 'Todos probados'));
  return v_g;
end $$;
revoke all on function public.proyecto_gates(uuid) from public, anon;
grant execute on function public.proyecto_gates(uuid) to authenticated;

drop function if exists public.proyecto_publicar(uuid);
create or replace function public.proyecto_publicar(p_id uuid, p_excepcion text default null) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_p record; v_falta text; v_fallan text;
begin
  if not public.soy_staff_plataforma() then raise exception 'Solo el operador puede aprobar la salida en vivo'; end if;
  select * into v_p from public.plataforma_proyectos where id = p_id;
  if v_p is null then raise exception 'Proyecto no encontrado'; end if;
  if v_p.tenant_id is null then raise exception 'Vincula primero el estudio creado'; end if;
  select string_agg(e->>'nombre', ', ') into v_falta from jsonb_array_elements(v_p.etapas) e
    where (e->>'obligatoria')::boolean and not (e->>'hecha')::boolean;
  if v_falta is not null then raise exception 'Faltan etapas obligatorias: %', v_falta; end if;
  select string_agg(g->>'nombre' || ' (' || (g->>'detalle') || ')', '; ') into v_fallan
    from jsonb_array_elements(public.proyecto_gates(p_id)) g where (g->>'bloquea')::boolean and not (g->>'ok')::boolean;
  if v_fallan is not null then
    if p_excepcion is null or length(trim(p_excepcion)) < 10 then
      raise exception 'No puede salir en vivo: %. Resuélvelo o registra una excepción con motivo.', v_fallan;
    end if;
    update public.plataforma_proyectos set excepcion_motivo = coalesce(excepcion_motivo || ' | ', '') || 'Salida en vivo: ' || trim(p_excepcion) ||
      ' (faltaba: ' || v_fallan || ')', excepcion_por = auth.uid(), excepcion_at = now() where id = p_id;
  end if;
  update public.plataforma_proyectos set estado = 'en_vivo', en_vivo_at = now() where id = p_id;
  update public.tenants set status = 'activo' where id = v_p.tenant_id;
  update public.plataforma_suscripciones set estado = 'activa', updated_at = now()
    where tenant_id = v_p.tenant_id and estado = 'pausada' and precio_mensual > 0;
end $$;
revoke all on function public.proyecto_publicar(uuid, text) from public, anon;
grant execute on function public.proyecto_publicar(uuid, text) to authenticated;

-- ───────────────────────── Alta guiada ─────────────────────────
create or replace function public._status_borrador() returns text language sql stable as $$
  select case when exists (select 1 from pg_constraint where conrelid = 'public.tenants'::regclass and contype = 'c'
                           and pg_get_constraintdef(oid) like '%borrador%') then 'borrador' else 'activo' end;
$$;
revoke all on function public._status_borrador() from public, anon;
grant execute on function public._status_borrador() to authenticated;

create or replace function public.alta_detectar_duplicados(p_slug text, p_nombre text, p_email text default null, p_dominio text default null)
returns table(tipo text, detalle text, bloquea boolean)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['soporte','ventas']) then raise exception 'No autorizado'; end if;
  return query
    select 'slug'::text, 'Ya existe un estudio con el enlace "' || t.slug || '" (' || t.name || ')', true
      from public.tenants t where t.slug = lower(trim(p_slug))
    union all
    select 'nombre', 'Ya existe un estudio llamado "' || t.name || '"', false
      from public.tenants t where lower(trim(t.name)) = lower(trim(p_nombre))
    union all
    select 'correo', 'El correo ya está en la ficha comercial de un estudio existente (' || e.nombre || ')', false
      from public.plataforma_contactos c join public.plataforma_empresas e on e.id = c.empresa_id
      where p_email is not null and lower(c.email) = lower(trim(p_email)) and e.tenant_id is not null
    union all
    select 'correo', 'El correo ya tiene una invitación de personal en otro estudio', false
      from public.invitaciones_personal i where p_email is not null and lower(i.email) = lower(trim(p_email))
    union all
    select 'dominio', 'El dominio ya está asignado a otro estudio', true
      from public.tenant_domains d where p_dominio is not null and lower(d.domain) = lower(trim(p_dominio));
end $$;
revoke all on function public.alta_detectar_duplicados(text, text, text, text) from public, anon;
grant execute on function public.alta_detectar_duplicados(text, text, text, text) to authenticated;

create or replace function public._alta_validar(p_slug text, p_name text, p_email text, p_confirmar boolean) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_d record; v_blando text;
begin
  if lower(trim(p_slug)) !~ '^[a-z0-9][a-z0-9-]{1,38}$' then raise exception 'El enlace solo admite minúsculas, números y guiones (2 a 39 caracteres)'; end if;
  if p_name is null or length(trim(p_name)) < 2 then raise exception 'Escribe el nombre comercial del estudio'; end if;
  for v_d in select * from public.alta_detectar_duplicados(p_slug, p_name, p_email) loop
    if v_d.bloquea then raise exception 'Duplicado: %', v_d.detalle; end if;
    v_blando := coalesce(v_blando || '; ', '') || v_d.detalle;
  end loop;
  if v_blando is not null and not coalesce(p_confirmar,false) then
    raise exception 'Posible duplicado: %. Si es correcto, confirma el alta.', v_blando;
  end if;
end $$;
revoke all on function public._alta_validar(text, text, text, boolean) from public, anon, authenticated;

create or replace function public.alta_estudio_desde_contrato(p_contrato_id uuid, p_slug text, p_name text, p_sede_nombre text,
  p_timezone text default 'America/Guatemala', p_email_duena text default null, p_nombre_duena text default null, p_confirmar_duplicado boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_c record; v_tenant uuid; v_sede uuid; v_proy uuid; v_token uuid; v_reanudado boolean := false; v_plan text;
begin
  if not public._plat_ok(array['soporte']) then raise exception 'No autorizado'; end if;
  select * into v_c from public.plataforma_contratos where id = p_contrato_id for update;
  if v_c is null then raise exception 'Contrato no encontrado'; end if;
  if v_c.estado <> 'vigente' then raise exception 'El contrato está en estado "%": el alta se hace con un contrato vigente', v_c.estado; end if;

  if v_c.tenant_id is not null then
    v_tenant := v_c.tenant_id; v_reanudado := true;
    select id into v_sede from public.sedes where tenant_id = v_tenant order by created_at limit 1;
  else
    perform public._alta_validar(p_slug, p_name, p_email_duena, p_confirmar_duplicado);
    if p_sede_nombre is null or length(trim(p_sede_nombre)) < 2 then raise exception 'Escribe el nombre de la primera sede'; end if;
    insert into public.tenants (slug, name, status) values (lower(trim(p_slug)), trim(p_name), public._status_borrador()) returning id into v_tenant;
    insert into public.sedes (tenant_id, name, timezone) values (v_tenant, trim(p_sede_nombre), coalesce(p_timezone,'America/Guatemala')) returning id into v_sede;
    update public.plataforma_contratos set tenant_id = v_tenant where id = p_contrato_id;
  end if;

  select id into v_proy from public.plataforma_proyectos where lead_id = v_c.lead_id order by created_at limit 1;
  if v_proy is null then
    insert into public.plataforma_proyectos (empresa_id, lead_id, nombre, etapas)
      values ((select empresa_id from public.plataforma_leads where id = v_c.lead_id), v_c.lead_id,
              'Alta de ' || coalesce((select nombre from public.plataforma_leads where id = v_c.lead_id), p_name), public._plantilla_etapas_alta())
      returning id into v_proy;
  end if;
  update public.plataforma_proyectos set tenant_id = v_tenant, email_duena = coalesce(nullif(lower(trim(p_email_duena)),''), email_duena) where id = v_proy;
  update public.plataforma_empresas set tenant_id = v_tenant where id = (select empresa_id from public.plataforma_proyectos where id = v_proy);

  -- plan y suscripción en pausa hasta salir en vivo; módulos del plan habilitados
  perform public._aplicar_contrato(p_contrato_id, false);
  select plan into v_plan from public.plataforma_suscripciones where tenant_id = v_tenant;
  perform public.aplicar_plan_tenant(v_tenant, v_plan, 'Alta desde contrato');
  perform public.proyecto_etapa(v_proy, 'contrato', true);
  perform public.proyecto_etapa(v_proy, 'plan', true);

  if nullif(trim(coalesce(p_email_duena,'')),'') is not null
     and not exists (select 1 from public.tenant_memberships where tenant_id = v_tenant)
     and not exists (select 1 from public.invitaciones_personal where tenant_id = v_tenant and role = 'duena' and lower(email) = lower(trim(p_email_duena))) then
    v_token := public.invitar_primera_duena_plataforma(v_tenant, p_email_duena, coalesce(nullif(trim(p_nombre_duena),''), 'Dueña'));
    perform public.proyecto_etapa(v_proy, 'estudio', true);
  end if;
  return jsonb_build_object('tenant_id', v_tenant, 'sede_id', v_sede, 'proyecto_id', v_proy, 'token', v_token, 'reanudado', v_reanudado);
end $$;
revoke all on function public.alta_estudio_desde_contrato(uuid, text, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.alta_estudio_desde_contrato(uuid, text, text, text, text, text, text, boolean) to authenticated;

create or replace function public.alta_estudio_manual(p_slug text, p_name text, p_sede_nombre text, p_motivo text,
  p_timezone text default 'America/Guatemala', p_email_duena text default null, p_nombre_duena text default null, p_confirmar_duplicado boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_tenant uuid; v_sede uuid; v_proy uuid; v_token uuid;
begin
  if not public.soy_staff_plataforma() then raise exception 'No autorizado'; end if;
  if p_motivo is null or length(trim(p_motivo)) < 10 then raise exception 'El alta manual es excepcional: explica el motivo (mínimo 10 caracteres)'; end if;
  perform public._alta_validar(p_slug, p_name, p_email_duena, p_confirmar_duplicado);
  if p_sede_nombre is null or length(trim(p_sede_nombre)) < 2 then raise exception 'Escribe el nombre de la primera sede'; end if;
  insert into public.tenants (slug, name, status) values (lower(trim(p_slug)), trim(p_name), public._status_borrador()) returning id into v_tenant;
  insert into public.sedes (tenant_id, name, timezone) values (v_tenant, trim(p_sede_nombre), coalesce(p_timezone,'America/Guatemala')) returning id into v_sede;
  insert into public.plataforma_proyectos (tenant_id, nombre, etapas, excepcion_motivo, excepcion_por, excepcion_at, email_duena)
    values (v_tenant, 'Alta manual de ' || trim(p_name), public._plantilla_etapas_alta(), 'Alta manual sin contrato: ' || trim(p_motivo), auth.uid(), now(),
            nullif(lower(trim(coalesce(p_email_duena,''))),''))
    returning id into v_proy;
  if nullif(trim(coalesce(p_email_duena,'')),'') is not null then
    v_token := public.invitar_primera_duena_plataforma(v_tenant, p_email_duena, coalesce(nullif(trim(p_nombre_duena),''), 'Dueña'));
    perform public.proyecto_etapa(v_proy, 'estudio', true);
  end if;
  return jsonb_build_object('tenant_id', v_tenant, 'sede_id', v_sede, 'proyecto_id', v_proy, 'token', v_token, 'reanudado', false);
end $$;
revoke all on function public.alta_estudio_manual(text, text, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.alta_estudio_manual(text, text, text, text, text, text, text, boolean) to authenticated;

-- ───────────────────────── Cobros: vista previa y generación segura ─────────────────────────
create or replace function public._periodo_cobro(p_periodo date) returns date language plpgsql stable as $$
declare v_per date := date_trunc('month', coalesce(p_periodo, public.hoy_gt()))::date;
begin
  if v_per > (date_trunc('month', public.hoy_gt()) + interval '1 month')::date then
    raise exception 'No se generan cobros de más de un mes adelante';
  end if;
  return v_per;
end $$;
revoke all on function public._periodo_cobro(date) from public, anon, authenticated;

create or replace function public.generar_cobros_vista_previa(p_periodo date default null) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare v_per date; v_gen jsonb; v_ex jsonb; v_exc jsonb;
begin
  if not public._plat_ok(array['finanzas']) then raise exception 'No autorizado'; end if;
  v_per := public._periodo_cobro(p_periodo);
  select coalesce(jsonb_agg(jsonb_build_object('tenant_id', s.tenant_id, 'estudio', t.name, 'plan', s.plan, 'monto', s.precio_mensual,
           'vence', (v_per + (s.dia_cobro - 1))) order by t.name), '[]') into v_gen
    from public.plataforma_suscripciones s join public.tenants t on t.id = s.tenant_id
   where s.estado = 'activa' and s.precio_mensual > 0 and t.status = 'activo'
     and s.fecha_alta <= (v_per + interval '1 month' - interval '1 day')::date
     and not exists (select 1 from public.plataforma_cobros c where c.tenant_id = s.tenant_id and c.periodo = v_per and c.concepto = 'licencia');
  select coalesce(jsonb_agg(jsonb_build_object('tenant_id', c.tenant_id, 'estudio', t.name, 'monto', c.monto, 'estado', c.estado) order by t.name), '[]') into v_ex
    from public.plataforma_cobros c join public.tenants t on t.id = c.tenant_id where c.periodo = v_per and c.concepto = 'licencia';
  select coalesce(jsonb_agg(jsonb_build_object('tenant_id', s.tenant_id, 'estudio', t.name, 'motivo',
           case when t.status <> 'activo' then 'El estudio está en estado ' || t.status || ': no se cobra'
                when s.estado <> 'activa' then 'Suscripción ' || s.estado
                when s.precio_mensual <= 0 then 'Precio Q0: no se genera cobro'
                else 'La suscripción empieza después de este período' end) order by t.name), '[]') into v_exc
    from public.plataforma_suscripciones s join public.tenants t on t.id = s.tenant_id
   where not exists (select 1 from public.plataforma_cobros c where c.tenant_id = s.tenant_id and c.periodo = v_per and c.concepto = 'licencia')
     and (t.status <> 'activo' or s.estado <> 'activa' or s.precio_mensual <= 0 or s.fecha_alta > (v_per + interval '1 month' - interval '1 day')::date);
  return jsonb_build_object('periodo', v_per, 'cantidad', jsonb_array_length(v_gen),
    'total', coalesce((select sum((x->>'monto')::numeric) from jsonb_array_elements(v_gen) x), 0),
    'a_generar', v_gen, 'ya_existentes', v_ex, 'excepciones', v_exc);
end $$;
revoke all on function public.generar_cobros_vista_previa(date) from public, anon;
grant execute on function public.generar_cobros_vista_previa(date) to authenticated;

drop function if exists public.generar_cobros_mes(date);
create or replace function public.generar_cobros_mes(p_periodo date default null) returns integer
language plpgsql security definer set search_path to 'public' as $$
declare v_n integer; v_per date;
begin
  if not public._plat_ok(array['finanzas']) then raise exception 'No autorizado'; end if;
  v_per := public._periodo_cobro(p_periodo);
  insert into public.plataforma_cobros (tenant_id, periodo, monto, fecha_vencimiento, concepto, plan_snapshot, precio_snapshot)
  select s.tenant_id, v_per, s.precio_mensual, v_per + (s.dia_cobro - 1), 'licencia', s.plan, s.precio_mensual
  from public.plataforma_suscripciones s join public.tenants t on t.id = s.tenant_id
  where s.estado = 'activa' and s.precio_mensual > 0 and t.status = 'activo'
    and s.fecha_alta <= (v_per + interval '1 month' - interval '1 day')::date
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.generar_cobros_mes(date) from public, anon;
grant execute on function public.generar_cobros_mes(date) to authenticated;
