-- CLASES, ASISTENCIA E INSTRUCTORAS (réplica de Forma Pilates en ReserveOS, con alcance por rol y sede):
--  · historial de reservas con filtros   · clases por instructora (la instructora real de cada clase: el pasado no cambia al cambiar el horario)
--  · corrección masiva y sustituciones (solo dueña / gerencia general, auditadas)   · corrección de asistencia con devolución exacta del crédito
--  · cancelar la clase de un día con aviso propio   · reto mensual   · agenda de clases privadas 1 a 1

-- ───────────── 1) Quién dio realmente cada clase ─────────────
create table if not exists public.horario_instructora_historial (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  horario_id uuid not null references public.horarios(id) on delete cascade,
  instructor_membership_id uuid references public.tenant_memberships(id) on delete set null,
  desde date not null,
  created_at timestamptz not null default now(),
  unique (horario_id, desde)
);
create index if not exists horario_instructora_historial_h on public.horario_instructora_historial (horario_id, desde desc);
alter table public.horario_instructora_historial enable row level security;
drop policy if exists hih_select on public.horario_instructora_historial;
create policy hih_select on public.horario_instructora_historial for select
  using (tenant_id in (select current_tenant_ids()) and (public._es_g(tenant_id) or public._es_rol_sede(tenant_id)));

create table if not exists public.clase_instructora_ajustes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  horario_id uuid not null references public.horarios(id) on delete cascade,
  fecha date not null,
  instructor_membership_id uuid references public.tenant_memberships(id) on delete set null,
  es_sustitucion boolean not null default false,
  motivo text not null,
  por uuid,
  created_at timestamptz not null default now(),
  unique (horario_id, fecha)
);
alter table public.clase_instructora_ajustes enable row level security;
drop policy if exists cia_select on public.clase_instructora_ajustes;
create policy cia_select on public.clase_instructora_ajustes for select
  using (tenant_id in (select current_tenant_ids()) and (public._es_g(tenant_id) or public._es_rol_sede(tenant_id)));

-- Línea de base: la instructora actual rige desde siempre; los cambios futuros solo valen desde su fecha.
insert into public.horario_instructora_historial (tenant_id, horario_id, instructor_membership_id, desde)
  select tenant_id, id, instructor_membership_id, date '2000-01-01' from public.horarios
  on conflict (horario_id, desde) do nothing;

create or replace function public._tg_horario_instructora_historial() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.horario_instructora_historial (tenant_id, horario_id, instructor_membership_id, desde)
      values (new.tenant_id, new.id, new.instructor_membership_id, date '2000-01-01') on conflict (horario_id, desde) do nothing;
  elsif new.instructor_membership_id is distinct from old.instructor_membership_id then
    insert into public.horario_instructora_historial (tenant_id, horario_id, instructor_membership_id, desde)
      values (new.tenant_id, new.id, new.instructor_membership_id, public.hoy_en_sede(new.sede_id))
      on conflict (horario_id, desde) do update set instructor_membership_id = excluded.instructor_membership_id;
  end if;
  return new;
end $$;
drop trigger if exists tg_horario_instructora_historial on public.horarios;
create trigger tg_horario_instructora_historial after insert or update of instructor_membership_id on public.horarios
  for each row execute function public._tg_horario_instructora_historial();

-- La instructora de una clase concreta: corrección/sustitución > la que regía ese día > la actual.
create or replace function public.instructora_de_clase(p_horario_id uuid, p_fecha date) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select a.instructor_membership_id from public.clase_instructora_ajustes a where a.horario_id = p_horario_id and a.fecha = p_fecha),
    (select hh.instructor_membership_id from public.horario_instructora_historial hh where hh.horario_id = p_horario_id and hh.desde <= p_fecha order by hh.desde desc limit 1),
    (select h.instructor_membership_id from public.horarios h where h.id = p_horario_id));
$$;

-- La instructora que dio la clase (incluida una sustituta) puede marcar asistencia; la titular que fue sustituida, no.
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='registrar_asistencia';
  d := replace(d, 'if v_h.instructor_membership_id is distinct from v_mi then', 'if public.instructora_de_clase(v_r.horario_id, v_r.fecha) is distinct from v_mi then');
  if d not like '%instructora_de_clase%' then raise exception 'no se pudo parchear registrar_asistencia'; end if;
  execute d;
end $$;

-- ───────────── 2) Alcance de lectura de estos reportes ─────────────
-- null = todas las sedes del estudio; un arreglo = solo esas; la instructora ve solo sus clases (no usa sedes).
create or replace function public._alcance_clases(p_tenant_id uuid) returns uuid[]
language plpgsql stable security definer set search_path = public as $$
declare v_rol text := public._mi_rol(p_tenant_id);
begin
  if v_rol is null or v_rol not in ('duena','gerente_general','gerente_regional','admin_sede','recepcion','instructora') then raise exception 'No autorizado'; end if;
  if v_rol in ('duena','gerente_general') then return null; end if;
  return public._mis_sedes(p_tenant_id);
end $$;

-- ───────────── 3) Clases dadas (una fila por clase y fecha) ─────────────
create or replace function public.clases_dictadas(p_tenant_id uuid, p_desde date default null, p_hasta date default null,
  p_sede_id uuid default null, p_instructora uuid default null, p_dia_semana integer default null, p_hora time default null)
returns table (horario_id uuid, fecha date, dia_semana integer, hora_inicio time, nombre_clase text, sede_id uuid, sede text,
  instructora_id uuid, instructora text, es_sustitucion boolean, cupo integer, reservadas integer, asistieron integer, no_vinieron integer,
  sin_marcar integer, canceladas integer, clase_cancelada boolean, ocupacion_pct numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_alc uuid[]; v_rol text := public._mi_rol(p_tenant_id); v_mi uuid; v_hasta date; v_desde date;
begin
  v_alc := public._alcance_clases(p_tenant_id);
  select id into v_mi from public.tenant_memberships where tenant_id = p_tenant_id and user_id = auth.uid() limit 1;
  v_hasta := least(coalesce(p_hasta, current_date), current_date + 1);
  v_desde := greatest(coalesce(p_desde, v_hasta - 30), v_hasta - 92);
  return query
  with ocurrencias as (
    select h.id hid, d::date f, h.dia_semana, h.hora_inicio, h.nombre_clase, h.sede_id, h.cupo_maximo
    from public.horarios h
    cross join lateral generate_series(v_desde::timestamp, v_hasta::timestamp, interval '1 day') d
    where h.tenant_id = p_tenant_id and h.categoria = 'regular'
      and (p_sede_id is null or h.sede_id = p_sede_id)
      and (v_alc is null or h.sede_id = any(v_alc))
      and (p_dia_semana is null or h.dia_semana = p_dia_semana)
      and (p_hora is null or h.hora_inicio = p_hora)
      and ((h.fecha_especifica is not null and h.fecha_especifica = d::date) or (h.fecha_especifica is null and extract(dow from d) = h.dia_semana))
      and (d::date + h.hora_inicio) <= public.ahora_en_sede(h.sede_id)
      and (h.activo or exists (select 1 from public.reservas rr where rr.horario_id = h.id and rr.fecha = d::date))
  ), base as (
    select o.*, public.instructora_de_clase(o.hid, o.f) iid,
      exists (select 1 from public.clase_instructora_ajustes a where a.horario_id = o.hid and a.fecha = o.f and a.es_sustitucion) sust,
      exists (select 1 from public.horario_cancelaciones c where c.horario_id = o.hid and c.fecha = o.f) cancelada
    from ocurrencias o
  )
  select b.hid, b.f, b.dia_semana, b.hora_inicio, b.nombre_clase, b.sede_id, s.name, b.iid, tm.nombre, b.sust, b.cupo_maximo,
    coalesce(x.conf, 0)::int, coalesce(x.asis, 0)::int, coalesce(x.novino, 0)::int, coalesce(x.sinm, 0)::int, coalesce(x.canc, 0)::int, b.cancelada,
    case when b.cupo_maximo > 0 then round(100.0 * coalesce(x.conf, 0) / b.cupo_maximo, 1) else 0 end
  from base b
  join public.sedes s on s.id = b.sede_id
  left join public.tenant_memberships tm on tm.id = b.iid
  left join lateral (
    select count(*) filter (where r.estado = 'confirmada') conf,
           count(*) filter (where r.estado = 'confirmada' and r.asistio is true) asis,
           count(*) filter (where r.estado = 'confirmada' and r.asistio is false) novino,
           count(*) filter (where r.estado = 'confirmada' and r.asistio is null) sinm,
           count(*) filter (where r.estado = 'cancelada') canc
    from public.reservas r where r.horario_id = b.hid and r.fecha = b.f) x on true
  where (p_instructora is null or b.iid = p_instructora)
    and (v_rol <> 'instructora' or b.iid is not distinct from v_mi)
  order by b.f desc, b.hora_inicio, s.name;
end $$;

create or replace function public.resumen_instructoras(p_tenant_id uuid, p_desde date default null, p_hasta date default null,
  p_sede_id uuid default null, p_dia_semana integer default null, p_hora time default null)
returns table (instructora_id uuid, instructora text, clases integer, clases_canceladas integer, alumnas integer, asistieron integer,
  no_vinieron integer, sin_marcar integer, cancelaciones integer, ocupacion_pct numeric, asistencia_pct numeric)
language sql stable security definer set search_path = public as $$
  select c.instructora_id, coalesce(c.instructora, 'Sin asignar'),
    count(*) filter (where not c.clase_cancelada)::int,
    count(*) filter (where c.clase_cancelada)::int,
    coalesce(sum(c.reservadas) filter (where not c.clase_cancelada), 0)::int,
    coalesce(sum(c.asistieron) filter (where not c.clase_cancelada), 0)::int,
    coalesce(sum(c.no_vinieron) filter (where not c.clase_cancelada), 0)::int,
    coalesce(sum(c.sin_marcar) filter (where not c.clase_cancelada), 0)::int,
    coalesce(sum(c.canceladas), 0)::int,
    coalesce(round(avg(c.ocupacion_pct) filter (where not c.clase_cancelada), 1), 0),
    case when coalesce(sum(c.asistieron + c.no_vinieron) filter (where not c.clase_cancelada), 0) > 0
      then round(100.0 * sum(c.asistieron) filter (where not c.clase_cancelada) / sum(c.asistieron + c.no_vinieron) filter (where not c.clase_cancelada), 1) else null end
  from public.clases_dictadas(p_tenant_id, p_desde, p_hasta, p_sede_id, null, p_dia_semana, p_hora) c
  group by c.instructora_id, c.instructora
  order by 3 desc, 2;
$$;

-- ───────────── 4) Corregir quién dio una o varias clases / registrar una sustitución ─────────────
create or replace function public.corregir_instructora_clases(p_tenant_id uuid, p_clases jsonb, p_instructora uuid, p_motivo text, p_sustitucion boolean default false)
returns integer language plpgsql security definer set search_path = public as $$
declare v_it jsonb; v_h record; v_n integer := 0; v_nombre text; v_antes uuid; v_actor text;
begin
  if not public._es_g(p_tenant_id) then raise exception 'Solo la dueña o la gerencia general corrigen quién dio una clase'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'Escribe el motivo (mínimo 5 caracteres)'; end if;
  if jsonb_typeof(p_clases) <> 'array' or jsonb_array_length(p_clases) = 0 then raise exception 'Elige al menos una clase'; end if;
  if jsonb_array_length(p_clases) > 200 then raise exception 'Máximo 200 clases por vez'; end if;
  select nombre into v_nombre from public.tenant_memberships where id = p_instructora and tenant_id = p_tenant_id and role = 'instructora';
  if v_nombre is null then raise exception 'Esa persona no es instructora de este estudio'; end if;
  select coalesce(nombre, 'staff') into v_actor from public.tenant_memberships where tenant_id = p_tenant_id and user_id = auth.uid() limit 1;
  for v_it in select * from jsonb_array_elements(p_clases) loop
    select * into v_h from public.horarios where id = (v_it->>'horario_id')::uuid and tenant_id = p_tenant_id;
    if v_h is null then raise exception 'Una de las clases no existe en este estudio'; end if;
    if not p_sustitucion then perform public._validar_instructora_sede(p_tenant_id, v_h.sede_id, p_instructora); end if;
    v_antes := public.instructora_de_clase(v_h.id, (v_it->>'fecha')::date);
    insert into public.clase_instructora_ajustes (tenant_id, horario_id, fecha, instructor_membership_id, es_sustitucion, motivo, por)
      values (p_tenant_id, v_h.id, (v_it->>'fecha')::date, p_instructora, p_sustitucion, trim(p_motivo), auth.uid())
      on conflict (horario_id, fecha) do update set instructor_membership_id = excluded.instructor_membership_id,
        es_sustitucion = excluded.es_sustitucion, motivo = excluded.motivo, por = excluded.por, created_at = now();
    insert into public.admin_acciones_log (tenant_id, actor_id, actor_nombre, tabla, operacion, registro_id, detalle)
      values (p_tenant_id, auth.uid(), v_actor, 'clase_instructora_ajustes', case when p_sustitucion then 'sustitucion' else 'correccion' end,
        v_h.id::text || ':' || (v_it->>'fecha'), jsonb_build_object('antes', v_antes, 'despues', p_instructora, 'instructora', v_nombre, 'motivo', trim(p_motivo), 'clase', v_h.nombre_clase));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- ───────────── 5) Historial de reservas (por día y clase: quién reservó y quién asistió) ─────────────
create or replace function public.historial_reservas(p_tenant_id uuid, p_desde date default null, p_hasta date default null, p_sede_id uuid default null,
  p_instructora uuid default null, p_dia_semana integer default null, p_hora time default null, p_estado text default null, p_asistencia text default null,
  p_limite integer default 200, p_desplazamiento integer default 0)
returns table (reserva_id uuid, fecha date, dia_semana integer, hora_inicio time, nombre_clase text, sede_id uuid, sede text, instructora_id uuid, instructora text,
  cliente text, tipo text, estado text, asistio boolean, confirmada boolean, total bigint)
language plpgsql stable security definer set search_path = public as $$
declare v_alc uuid[]; v_rol text := public._mi_rol(p_tenant_id); v_mi uuid; v_hasta date; v_desde date;
begin
  v_alc := public._alcance_clases(p_tenant_id);
  select id into v_mi from public.tenant_memberships where tenant_id = p_tenant_id and user_id = auth.uid() limit 1;
  v_hasta := coalesce(p_hasta, current_date + 30); v_desde := greatest(coalesce(p_desde, v_hasta - 60), v_hasta - 366);
  if p_estado is not null and p_estado not in ('confirmada','cancelada') then raise exception 'Estado no válido'; end if;
  if p_asistencia is not null and p_asistencia not in ('asistio','no_vino','sin_marcar') then raise exception 'Filtro de asistencia no válido'; end if;
  return query
  select r.id, r.fecha, h.dia_semana, h.hora_inicio, h.nombre_clase, r.sede_id, s.name, i.iid, tm.nombre, c.nombre, r.tipo, r.estado, r.asistio,
    r.confirmada_por_clienta_at is not null, count(*) over ()
  from public.reservas r
  join public.horarios h on h.id = r.horario_id
  join public.sedes s on s.id = r.sede_id
  join public.clientes c on c.id = r.cliente_id
  cross join lateral (select public.instructora_de_clase(r.horario_id, r.fecha) iid) i
  left join public.tenant_memberships tm on tm.id = i.iid
  where r.tenant_id = p_tenant_id and r.fecha between v_desde and v_hasta
    and (v_alc is null or r.sede_id = any(v_alc))
    and (v_rol <> 'instructora' or i.iid is not distinct from v_mi)
    and (p_sede_id is null or r.sede_id = p_sede_id)
    and (p_instructora is null or i.iid = p_instructora)
    and (p_dia_semana is null or extract(dow from r.fecha) = p_dia_semana)
    and (p_hora is null or h.hora_inicio = p_hora)
    and (p_estado is null or r.estado = p_estado)
    and (p_asistencia is null or (p_asistencia = 'asistio' and r.asistio is true) or (p_asistencia = 'no_vino' and r.asistio is false) or (p_asistencia = 'sin_marcar' and r.asistio is null and r.estado = 'confirmada'))
  order by r.fecha desc, h.hora_inicio, c.nombre
  limit least(coalesce(p_limite, 200), 5000) offset greatest(coalesce(p_desplazamiento, 0), 0);
end $$;

-- ───────────── 6) Corregir una asistencia errónea (con devolución exacta del crédito) ─────────────
create or replace function public.corregir_asistencia(p_reserva_id uuid, p_accion text, p_motivo text default null)
returns json language plpgsql security definer set search_path = public as $$
declare v_r record; v_actor text; v_devuelto boolean := false;
begin
  if p_accion not in ('asistio','no_vino','sin_marcar','anular_y_devolver') then raise exception 'Acción no válida'; end if;
  select * into v_r from public.reservas where id = p_reserva_id for update;
  if v_r is null or v_r.estado <> 'confirmada' then raise exception 'Reserva no encontrada o ya cancelada'; end if;
  if not public.staff_puede_en_sede(v_r.tenant_id, v_r.sede_id, array['duena','gerente_general','admin_sede','recepcion']) then raise exception 'No autorizado'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'Escribe el motivo de la corrección (mínimo 5 caracteres)'; end if;
  if p_accion = 'anular_y_devolver' then
    update public.reservas set estado = 'cancelada', penalizada = false, asistio = null where id = p_reserva_id;
    if v_r.tipo = 'regular' then perform public.devolver_credito_reserva(p_reserva_id); v_devuelto := true; end if;   -- idempotente: nunca dos veces
  else
    if v_r.fecha > public.hoy_en_sede(v_r.sede_id) then raise exception 'No se puede corregir la asistencia de una clase futura'; end if;
    update public.reservas set asistio = case p_accion when 'asistio' then true when 'no_vino' then false else null end where id = p_reserva_id;
  end if;
  select coalesce(nombre, 'staff') into v_actor from public.tenant_memberships where tenant_id = v_r.tenant_id and user_id = auth.uid() limit 1;
  insert into public.admin_acciones_log (tenant_id, actor_id, actor_nombre, tabla, operacion, registro_id, detalle)
    values (v_r.tenant_id, auth.uid(), v_actor, 'reservas', 'correccion_asistencia', p_reserva_id::text,
      jsonb_build_object('antes', v_r.asistio, 'accion', p_accion, 'motivo', trim(p_motivo), 'credito_devuelto', v_devuelto));
  return json_build_object('ok', true, 'credito_devuelto', v_devuelto);
end $$;

-- ───────────── 7) Cancelar la clase de un día: reservas, créditos y un aviso propio ─────────────
create or replace function public._plantillas_clases_por_defecto(p_tenant uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.plantillas_mensaje (tenant_id, clave, nombre, canal, tipo, asunto, cuerpo) values
   (p_tenant,'clase_cancelada','Clase cancelada por el estudio','email','transaccional','Hoy no hay clase: {{clase}}','Hola {{nombre}}, tuvimos que cancelar {{clase}} del {{fecha}} a las {{hora}} en {{sede}}. Tu clase ya fue devuelta a tu paquete. Perdona la molestia. — {{estudio}}'),
   (p_tenant,'clase_cancelada','Clase cancelada por el estudio','whatsapp','transaccional',null,'Hola {{nombre}}, cancelamos {{clase}} del {{fecha}} a las {{hora}} en {{sede}}. Tu clase ya volvió a tu paquete. Perdona la molestia. — {{estudio}}')
  on conflict (tenant_id, clave, canal) do nothing;
$$;
revoke all on function public._plantillas_clases_por_defecto(uuid) from public, anon, authenticated;
select public._plantillas_clases_por_defecto(id) from public.tenants;

do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='_tg_reserva_mensajes';
  d := replace(d, E'  elsif tg_op = ''UPDATE'' and old.estado = ''confirmada'' and new.estado = ''cancelada'' then',
                  E'  elsif tg_op = ''UPDATE'' and old.estado = ''confirmada'' and new.estado = ''cancelada'' and coalesce(current_setting(''app.cancelacion_clase'', true), '''') <> ''on'' then');
  if d not like '%app.cancelacion_clase%' then raise exception 'no se pudo parchear _tg_reserva_mensajes'; end if;
  execute d;
end $$;

create or replace function public.cancelar_clase_fecha(p_horario_id uuid, p_fecha date) returns json
language plpgsql security definer set search_path = public as $$
declare v_h record; v_r record; v_n integer := 0; v_sede text; v_avisos integer := 0;
begin
  select * into v_h from public.horarios where id = p_horario_id;
  if v_h is null then raise exception 'Horario no encontrado'; end if;
  perform public._exigir_accion(v_h.tenant_id, v_h.sede_id, 'P14');
  if not public.staff_puede_en_sede(v_h.tenant_id, v_h.sede_id, array['admin_sede','duena','gerente_general','gerente_regional','recepcion']) then raise exception 'No autorizado'; end if;
  if p_fecha < public.hoy_en_sede(v_h.sede_id) then raise exception 'No se puede cancelar una clase pasada'; end if;
  select name into v_sede from public.sedes where id = v_h.sede_id;
  perform public._plantillas_clases_por_defecto(v_h.tenant_id);
  perform set_config('app.cancelacion_clase', 'on', true);          -- el aviso genérico de «reserva cancelada» se cambia por uno propio de la clase
  insert into public.horario_cancelaciones (tenant_id, horario_id, fecha) values (v_h.tenant_id, p_horario_id, p_fecha) on conflict (horario_id, fecha) do nothing;
  for v_r in select * from public.reservas where horario_id = p_horario_id and fecha = p_fecha and estado = 'confirmada' loop
    update public.reservas set estado = 'cancelada' where id = v_r.id;
    if v_r.tipo = 'regular' then perform public.devolver_credito_reserva(v_r.id); end if;
    perform public._encolar_transaccional(v_h.tenant_id, v_r.cliente_id, 'clase_cancelada',
      jsonb_build_object('clase', v_h.nombre_clase, 'fecha', to_char(p_fecha, 'DD/MM'), 'hora', to_char(v_h.hora_inicio, 'HH24:MI'), 'sede', v_sede), 'clase-cancel:' || v_r.id);
    v_n := v_n + 1;
  end loop;
  perform set_config('app.cancelacion_clase', 'off', true);
  select count(*) into v_avisos from public.cola_mensajes where tenant_id = v_h.tenant_id and clave_unica like 'clase-cancel:%'
    and cliente_id in (select cliente_id from public.reservas where horario_id = p_horario_id and fecha = p_fecha);
  return json_build_object('ok', true, 'reservas_canceladas', v_n, 'avisos_encolados', v_avisos);
end $$;

-- ───────────── 8) Reto mensual ─────────────
alter table public.configuracion_reservas add column if not exists reto_mensual_clases integer not null default 12;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'configuracion_reservas_reto_ck') then
    alter table public.configuracion_reservas add constraint configuracion_reservas_reto_ck check (reto_mensual_clases between 1 and 60);
  end if;
end $$;

create or replace function public.mi_reto_mensual(p_tenant_id uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare v_c record; v_hoy date; v_ini date; v_fin date; v_meta integer; v_asist integer; v_prox integer;
begin
  select * into v_c from public.clientes where user_id = auth.uid() and tenant_id = p_tenant_id limit 1;
  if v_c is null then return null; end if;
  v_hoy := public.hoy_en_sede(coalesce(v_c.sede_habitual_id, (select id from public.sedes where tenant_id = p_tenant_id order by created_at limit 1)));
  v_ini := date_trunc('month', v_hoy)::date; v_fin := (date_trunc('month', v_hoy) + interval '1 month - 1 day')::date;
  select coalesce(reto_mensual_clases, 12) into v_meta from public.configuracion_reservas where tenant_id = p_tenant_id;
  v_meta := coalesce(v_meta, 12);
  select count(*) filter (where asistio is true), count(*) filter (where asistio is null and fecha >= v_hoy)
    into v_asist, v_prox from public.reservas where cliente_id = v_c.id and estado = 'confirmada' and fecha between v_ini and v_fin;
  return json_build_object('meta', v_meta, 'asistidas', v_asist, 'por_asistir', v_prox, 'mes_inicio', v_ini, 'mes_fin', v_fin,
    'porcentaje', least(100, round(100.0 * v_asist / v_meta)), 'cumplido', v_asist >= v_meta);
end $$;

create or replace function public.guardar_reto_mensual(p_tenant_id uuid, p_meta integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public._es_g(p_tenant_id) then raise exception 'No autorizado'; end if;
  if p_meta is null or p_meta < 1 or p_meta > 60 then raise exception 'La meta debe estar entre 1 y 60 clases'; end if;
  insert into public.configuracion_reservas (tenant_id, reto_mensual_clases) values (p_tenant_id, p_meta)
    on conflict (tenant_id) do update set reto_mensual_clases = excluded.reto_mensual_clases, updated_at = now();
end $$;

-- ───────────── 9) Agenda de clases privadas 1 a 1 (staff): con su alcance por sede; la instructora solo ve las suyas ─────────────
create or replace function public.privadas_agenda(p_tenant_id uuid, p_desde date default null, p_hasta date default null, p_sede_id uuid default null)
returns table (horario_id uuid, fecha date, hora_inicio time, hora_fin time, nombre_clase text, sede_id uuid, sede text, instructora_id uuid, instructora text,
  reserva_id uuid, cliente text, asistio boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_alc uuid[]; v_rol text := public._mi_rol(p_tenant_id); v_mi uuid; v_desde date := coalesce(p_desde, current_date); v_hasta date;
begin
  v_alc := public._alcance_clases(p_tenant_id);
  select id into v_mi from public.tenant_memberships where tenant_id = p_tenant_id and user_id = auth.uid() limit 1;
  v_hasta := least(coalesce(p_hasta, v_desde + 14), v_desde + 62);
  return query
  select h.id, d::date, h.hora_inicio, h.hora_fin, h.nombre_clase, h.sede_id, s.name, h.instructor_membership_id, tm.nombre, r.id, c.nombre, r.asistio
  from public.horarios h
  join public.sedes s on s.id = h.sede_id
  left join public.tenant_memberships tm on tm.id = h.instructor_membership_id
  cross join lateral generate_series(v_desde::timestamp, v_hasta::timestamp, interval '1 day') d
  left join public.reservas r on r.horario_id = h.id and r.fecha = d::date and r.estado = 'confirmada'
  left join public.clientes c on c.id = r.cliente_id
  where h.tenant_id = p_tenant_id and h.categoria = 'privado' and h.activo
    and (v_alc is null or h.sede_id = any(v_alc))
    and (p_sede_id is null or h.sede_id = p_sede_id)
    and (v_rol <> 'instructora' or h.instructor_membership_id is not distinct from v_mi)
    and ((h.fecha_especifica is not null and h.fecha_especifica = d::date) or (h.fecha_especifica is null and extract(dow from d) = h.dia_semana))
  order by d::date, h.hora_inicio, s.name;
end $$;

-- ───────────── 10) Permisos: nada para visitantes sin cuenta ─────────────
do $$
declare f text;
begin
  foreach f in array array[
    'instructora_de_clase(uuid,date)','_alcance_clases(uuid)',
    'clases_dictadas(uuid,date,date,uuid,uuid,integer,time)','resumen_instructoras(uuid,date,date,uuid,integer,time)',
    'corregir_instructora_clases(uuid,jsonb,uuid,text,boolean)',
    'historial_reservas(uuid,date,date,uuid,uuid,integer,time,text,text,integer,integer)',
    'corregir_asistencia(uuid,text,text)','cancelar_clase_fecha(uuid,date)','mi_reto_mensual(uuid)','guardar_reto_mensual(uuid,integer)',
    'privadas_agenda(uuid,date,date,uuid)','registrar_asistencia(uuid,boolean)','_tg_reserva_mensajes()','_tg_horario_instructora_historial()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
