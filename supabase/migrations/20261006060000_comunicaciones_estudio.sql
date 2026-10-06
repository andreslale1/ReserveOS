-- ST-08: comunicaciones del estudio. Segmentos con criterios visibles, plantillas por canal con variables, campañas y una
-- cola de mensajes con reintentos e idempotencia. No hay proveedor de envío conectado: los mensajes quedan "pendientes" y
-- un proveedor futuro los toma con cola_tomar()/cola_resultado() (solo el servidor). Los mensajes de marketing exigen
-- consentimiento explícito de cada clienta; los transaccionales (reserva, recordatorio de clase) no.

create table if not exists public.comunicacion_preferencias (
  cliente_id uuid primary key references public.clientes(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  marketing_ok boolean not null default false,
  email_ok boolean not null default true,
  whatsapp_ok boolean not null default true,
  updated_at timestamptz not null default now()
);
create table if not exists public.plantillas_mensaje (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  clave text not null,
  nombre text not null,
  canal text not null check (canal in ('email','whatsapp')),
  tipo text not null default 'marketing' check (tipo in ('marketing','transaccional')),
  asunto text,
  cuerpo text not null,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, clave, canal)
);
create table if not exists public.segmentos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nombre text not null,
  criterio jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists public.campanas_estudio (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nombre text not null,
  segmento_id uuid not null references public.segmentos(id),
  plantilla_id uuid not null references public.plantillas_mensaje(id),
  programada_para timestamptz,
  estado text not null default 'encolada' check (estado in ('encolada','cancelada')),
  encolados integer not null default 0,
  omitidos_consentimiento integer not null default 0,
  omitidos_sin_destino integer not null default 0,
  creada_por uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create table if not exists public.cola_mensajes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campana_id uuid references public.campanas_estudio(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete cascade,
  canal text not null,
  destino text not null,
  asunto text,
  cuerpo text not null,
  tipo text not null default 'marketing',
  estado text not null default 'pendiente' check (estado in ('pendiente','enviando','enviado','fallido','cancelado')),
  intentos integer not null default 0,
  ultimo_error text,
  proximo_intento timestamptz not null default now(),
  sent_at timestamptz,
  clave_unica text,
  created_at timestamptz not null default now()
);
create unique index if not exists cola_mensajes_clave_idx on public.cola_mensajes (tenant_id, clave_unica) where clave_unica is not null;
create index if not exists cola_mensajes_pendientes_idx on public.cola_mensajes (proximo_intento) where estado in ('pendiente','fallido');
alter table public.comunicacion_preferencias enable row level security;
alter table public.plantillas_mensaje enable row level security;
alter table public.segmentos enable row level security;
alter table public.campanas_estudio enable row level security;
alter table public.cola_mensajes enable row level security;
revoke all on public.comunicacion_preferencias, public.plantillas_mensaje, public.segmentos, public.campanas_estudio, public.cola_mensajes from anon, authenticated;

-- ---------- Plantillas por defecto ----------
create or replace function public._plantillas_por_defecto(p_tenant uuid)
returns void language sql security definer set search_path to 'public' as $$
  insert into public.plantillas_mensaje (tenant_id, clave, nombre, canal, tipo, asunto, cuerpo) values
   (p_tenant,'reserva_confirmada','Reserva confirmada','email','transaccional','Tu clase está reservada','Hola {{nombre}}, reservaste {{clase}} el {{fecha}} a las {{hora}} en {{sede}}. ¡Te esperamos! — {{estudio}}'),
   (p_tenant,'reserva_confirmada','Reserva confirmada','whatsapp','transaccional',null,'Hola {{nombre}} 👋 reservaste {{clase}} el {{fecha}} a las {{hora}} en {{sede}}. ¡Te esperamos! — {{estudio}}'),
   (p_tenant,'reserva_cancelada','Reserva cancelada','email','transaccional','Cancelamos tu reserva','Hola {{nombre}}, se canceló tu reserva de {{clase}} del {{fecha}} a las {{hora}}. — {{estudio}}'),
   (p_tenant,'paquete_por_vencer','Paquete por vencer','email','transaccional','Tu paquete está por vencer','Hola {{nombre}}, tu paquete {{paquete}} vence el {{vence}}. Reserva tus clases antes o renuévalo. — {{estudio}}'),
   (p_tenant,'paquete_por_vencer','Paquete por vencer','whatsapp','transaccional',null,'Hola {{nombre}}, tu paquete {{paquete}} vence el {{vence}}. ¡Aprovecha tus clases! — {{estudio}}'),
   (p_tenant,'te_extrañamos','Te extrañamos','email','marketing','Te extrañamos en {{estudio}}','Hola {{nombre}}, hace un tiempo que no te vemos. Tenemos clases esperándote. — {{estudio}}'),
   (p_tenant,'te_extrañamos','Te extrañamos','whatsapp','marketing',null,'Hola {{nombre}} 💛 hace tiempo que no te vemos en {{estudio}}. ¿Te animas a volver esta semana?')
  on conflict (tenant_id, clave, canal) do nothing;
$$;
revoke all on function public._plantillas_por_defecto(uuid) from public;
select public._plantillas_por_defecto(id) from public.tenants;
create or replace function public._plantillas_tenant_nuevo() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin perform public._plantillas_por_defecto(new.id); return new; end $$;
drop trigger if exists tenants_plantillas on public.tenants;
create trigger tenants_plantillas after insert on public.tenants for each row execute function public._plantillas_tenant_nuevo();

-- ---------- Segmentos ----------
create or replace function public._segmento_clientes(p_tenant_id uuid, p_criterio jsonb)
returns table(id uuid) language plpgsql stable security definer set search_path to 'public' as $$
declare v_tipo text := p_criterio->>'tipo'; v_dias int := coalesce(nullif(p_criterio->>'dias','')::int, 30);
begin
  if v_dias < 1 or v_dias > 365 then v_dias := 30; end if;
  return query select c.id from public.clientes c where c.tenant_id = p_tenant_id and c.tutor_id is null and (
    v_tipo = 'todas'
    or (v_tipo = 'inactivas' and not exists (select 1 from public.reservas r where r.cliente_id = c.id and r.estado = 'confirmada' and r.fecha >= current_date - v_dias))
    or (v_tipo = 'por_vencer' and exists (select 1 from public.membresias m where m.cliente_id = c.id and m.estado = 'activa' and m.fecha_vencimiento between current_date and current_date + v_dias))
    or (v_tipo = 'sin_paquete' and not exists (select 1 from public.membresias m where m.cliente_id = c.id and m.estado = 'activa' and m.fecha_vencimiento >= current_date))
    or (v_tipo = 'nuevas' and c.created_at >= now() - make_interval(days => v_dias))
    or (v_tipo = 'cumple_mes' and c.fecha_nacimiento is not null and extract(month from c.fecha_nacimiento) = extract(month from current_date)));
end $$;
revoke all on function public._segmento_clientes(uuid, jsonb) from public;

create or replace function public.segmento_guardar(p_tenant_id uuid, p_nombre text, p_tipo text, p_dias integer)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  perform public._exigir_accion(p_tenant_id, null::uuid, 'P41');
  perform public._exigir_modulo(p_tenant_id, 'crm_segmentos');
  if p_tipo not in ('todas','inactivas','por_vencer','sin_paquete','nuevas','cumple_mes') then raise exception 'Tipo de segmento no válido'; end if;
  if p_nombre is null or length(trim(p_nombre)) < 2 then raise exception 'Ponle un nombre al segmento'; end if;
  insert into public.segmentos (tenant_id, nombre, criterio) values (p_tenant_id, trim(p_nombre), jsonb_build_object('tipo', p_tipo, 'dias', p_dias)) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.segmento_guardar(uuid, text, text, integer) from public;
grant execute on function public.segmento_guardar(uuid, text, text, integer) to authenticated;

create or replace function public.segmentos_listar(p_tenant_id uuid)
returns table(id uuid, nombre text, criterio jsonb, personas bigint, con_consentimiento bigint)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  perform public._exigir_accion(p_tenant_id, null::uuid, 'P41');
  return query select s.id, s.nombre, s.criterio,
    (select count(*) from public._segmento_clientes(p_tenant_id, s.criterio)),
    (select count(*) from public._segmento_clientes(p_tenant_id, s.criterio) x join public.comunicacion_preferencias p on p.cliente_id = x.id and p.marketing_ok)
    from public.segmentos s where s.tenant_id = p_tenant_id order by s.created_at desc;
end $$;
revoke all on function public.segmentos_listar(uuid) from public;
grant execute on function public.segmentos_listar(uuid) to authenticated;

-- ---------- Campañas ----------
create or replace function public._render_mensaje(p_texto text, p_cliente public.clientes, p_estudio text)
returns text language sql immutable as $$
  select replace(replace(p_texto, '{{nombre}}', split_part(p_cliente.nombre, ' ', 1)), '{{estudio}}', p_estudio)
$$;

create or replace function public.campana_enviar(p_tenant_id uuid, p_nombre text, p_segmento_id uuid, p_plantilla_id uuid, p_programada timestamptz)
returns json language plpgsql security definer set search_path to 'public' as $$
declare v_seg record; v_pl record; v_estudio text; v_c record; v_id uuid; v_enc int := 0; v_sin_cons int := 0; v_sin_dest int := 0; v_dest text; v_pref record;
begin
  perform public._exigir_accion(p_tenant_id, null::uuid, 'P42');
  perform public._exigir_modulo(p_tenant_id, 'campanas_marketing');
  select * into v_seg from public.segmentos where id = p_segmento_id and tenant_id = p_tenant_id;
  select * into v_pl from public.plantillas_mensaje where id = p_plantilla_id and tenant_id = p_tenant_id and activa;
  if v_seg is null or v_pl is null then raise exception 'Segmento o plantilla no válidos'; end if;
  if v_pl.tipo <> 'marketing' then raise exception 'Las plantillas transaccionales se envían solas; elige una de marketing'; end if;
  if p_nombre is null or length(trim(p_nombre)) < 2 then raise exception 'Ponle un nombre a la campaña'; end if;
  if (select count(*) from public.campanas_estudio where tenant_id = p_tenant_id and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'Máximo 3 campañas cada 24 horas, para no saturar a tus clientas.';
  end if;
  select name into v_estudio from public.tenants where id = p_tenant_id;
  insert into public.campanas_estudio (tenant_id, nombre, segmento_id, plantilla_id, programada_para) values (p_tenant_id, trim(p_nombre), p_segmento_id, p_plantilla_id, p_programada) returning id into v_id;
  for v_c in select c.* from public.clientes c join public._segmento_clientes(p_tenant_id, v_seg.criterio) s on s.id = c.id loop
    exit when v_enc >= 2000;
    select * into v_pref from public.comunicacion_preferencias where cliente_id = v_c.id;
    if v_pref is null or not v_pref.marketing_ok or (v_pl.canal = 'email' and not v_pref.email_ok) or (v_pl.canal = 'whatsapp' and not v_pref.whatsapp_ok) then v_sin_cons := v_sin_cons + 1; continue; end if;
    v_dest := case v_pl.canal when 'email' then nullif(trim(coalesce(v_c.email,'')),'') else nullif(trim(coalesce(v_c.telefono,'')),'') end;
    if v_dest is null then v_sin_dest := v_sin_dest + 1; continue; end if;
    insert into public.cola_mensajes (tenant_id, campana_id, cliente_id, canal, destino, asunto, cuerpo, tipo, proximo_intento, clave_unica)
      values (p_tenant_id, v_id, v_c.id, v_pl.canal, v_dest, public._render_mensaje(v_pl.asunto, v_c, v_estudio), public._render_mensaje(v_pl.cuerpo, v_c, v_estudio), 'marketing', coalesce(p_programada, now()), 'camp:' || v_id || ':' || v_c.id)
      on conflict do nothing;
    v_enc := v_enc + 1;
  end loop;
  update public.campanas_estudio set encolados = v_enc, omitidos_consentimiento = v_sin_cons, omitidos_sin_destino = v_sin_dest where id = v_id;
  return json_build_object('ok', true, 'campana_id', v_id, 'encolados', v_enc, 'omitidos_sin_consentimiento', v_sin_cons, 'omitidos_sin_destino', v_sin_dest);
end $$;
revoke all on function public.campana_enviar(uuid, text, uuid, uuid, timestamptz) from public;
grant execute on function public.campana_enviar(uuid, text, uuid, uuid, timestamptz) to authenticated;

create or replace function public.campana_cancelar(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v record;
begin
  select * into v from public.campanas_estudio where id = p_id;
  if v is null then raise exception 'Campaña no encontrada'; end if;
  perform public._exigir_accion(v.tenant_id, null::uuid, 'P42');
  update public.cola_mensajes set estado = 'cancelado' where campana_id = p_id and estado in ('pendiente','fallido');
  update public.campanas_estudio set estado = 'cancelada' where id = p_id;
end $$;
revoke all on function public.campana_cancelar(uuid) from public;
grant execute on function public.campana_cancelar(uuid) to authenticated;

create or replace function public.campanas_listar(p_tenant_id uuid)
returns table(id uuid, nombre text, segmento text, plantilla text, canal text, estado text, programada_para timestamptz, encolados integer, omitidos_consentimiento integer, omitidos_sin_destino integer,
  enviados bigint, pendientes bigint, fallidos bigint, created_at timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  perform public._exigir_accion(p_tenant_id, null::uuid, 'P42');
  return query select c.id, c.nombre, s.nombre, p.nombre, p.canal, c.estado, c.programada_para, c.encolados, c.omitidos_consentimiento, c.omitidos_sin_destino,
    (select count(*) from public.cola_mensajes m where m.campana_id = c.id and m.estado = 'enviado'),
    (select count(*) from public.cola_mensajes m where m.campana_id = c.id and m.estado in ('pendiente','enviando')),
    (select count(*) from public.cola_mensajes m where m.campana_id = c.id and m.estado = 'fallido'), c.created_at
    from public.campanas_estudio c join public.segmentos s on s.id = c.segmento_id join public.plantillas_mensaje p on p.id = c.plantilla_id
    where c.tenant_id = p_tenant_id order by c.created_at desc limit 50;
end $$;
revoke all on function public.campanas_listar(uuid) from public;
grant execute on function public.campanas_listar(uuid) to authenticated;

create or replace function public.plantillas_listar(p_tenant_id uuid)
returns setof public.plantillas_mensaje language plpgsql stable security definer set search_path to 'public' as $$
begin
  perform public._exigir_accion(p_tenant_id, null::uuid, 'P42');
  return query select * from public.plantillas_mensaje where tenant_id = p_tenant_id order by tipo, nombre, canal;
end $$;
revoke all on function public.plantillas_listar(uuid) from public;
grant execute on function public.plantillas_listar(uuid) to authenticated;

create or replace function public.plantilla_guardar(p_id uuid, p_tenant_id uuid, p_clave text, p_nombre text, p_canal text, p_asunto text, p_cuerpo text, p_activa boolean)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  perform public._exigir_accion(p_tenant_id, null::uuid, 'P42');
  if p_cuerpo is null or length(trim(p_cuerpo)) < 5 then raise exception 'Escribe el mensaje'; end if;
  if p_canal = 'email' and (p_asunto is null or length(trim(p_asunto)) < 3) then raise exception 'El correo necesita un asunto'; end if;
  if p_id is null then
    insert into public.plantillas_mensaje (tenant_id, clave, nombre, canal, tipo, asunto, cuerpo) values (p_tenant_id, lower(regexp_replace(trim(p_clave), '\s+', '_', 'g')), trim(p_nombre), p_canal, 'marketing', p_asunto, trim(p_cuerpo)) returning id into v_id;
  else
    update public.plantillas_mensaje set nombre = trim(p_nombre), asunto = p_asunto, cuerpo = trim(p_cuerpo), activa = coalesce(p_activa, activa) where id = p_id and tenant_id = p_tenant_id returning id into v_id;
    if v_id is null then raise exception 'Plantilla no encontrada'; end if;
  end if;
  return v_id;
end $$;
revoke all on function public.plantilla_guardar(uuid, uuid, text, text, text, text, text, boolean) from public;
grant execute on function public.plantilla_guardar(uuid, uuid, text, text, text, text, text, boolean) to authenticated;

-- ---------- Estado de la cola ----------
create or replace function public.cola_resumen(p_tenant_id uuid)
returns json language plpgsql stable security definer set search_path to 'public' as $$
begin
  perform public._exigir_accion(p_tenant_id, null::uuid, 'P42');
  return json_build_object(
    'pendientes', (select count(*) from public.cola_mensajes where tenant_id = p_tenant_id and estado in ('pendiente','enviando')),
    'enviados', (select count(*) from public.cola_mensajes where tenant_id = p_tenant_id and estado = 'enviado'),
    'fallidos', (select count(*) from public.cola_mensajes where tenant_id = p_tenant_id and estado = 'fallido'),
    'email_conectado', exists (select 1 from public.integracion_email where tenant_id = p_tenant_id and activo),
    'whatsapp_conectado', exists (select 1 from public.integracion_whatsapp where tenant_id = p_tenant_id and activo));
end $$;
revoke all on function public.cola_resumen(uuid) from public;
grant execute on function public.cola_resumen(uuid) to authenticated;

-- ---------- Interfaz para el proveedor de envío (solo servidor) ----------
create or replace function public.cola_tomar(p_lote integer default 50)
returns table(id uuid, tenant_id uuid, canal text, destino text, asunto text, cuerpo text, intentos integer)
language plpgsql security definer set search_path to 'public' as $$
begin
  return query
  with tomados as (
    select m.id from public.cola_mensajes m where m.estado in ('pendiente','fallido') and m.proximo_intento <= now() and m.intentos < 5
    order by m.proximo_intento limit least(greatest(p_lote, 1), 200) for update skip locked)
  update public.cola_mensajes m set estado = 'enviando', intentos = m.intentos + 1 from tomados t where m.id = t.id
  returning m.id, m.tenant_id, m.canal, m.destino, m.asunto, m.cuerpo, m.intentos;
end $$;
revoke all on function public.cola_tomar(integer) from public;
grant execute on function public.cola_tomar(integer) to service_role;

create or replace function public.cola_resultado(p_id uuid, p_ok boolean, p_error text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  update public.cola_mensajes set
    estado = case when p_ok then 'enviado' when intentos >= 5 then 'fallido' else 'pendiente' end,
    sent_at = case when p_ok then now() else sent_at end,
    ultimo_error = case when p_ok then null else left(p_error, 300) end,
    proximo_intento = case when p_ok then proximo_intento else now() + make_interval(mins => power(2, intentos)::int) end
  where id = p_id and estado = 'enviando';
end $$;
revoke all on function public.cola_resultado(uuid, boolean, text) from public;
grant execute on function public.cola_resultado(uuid, boolean, text) to service_role;

-- ---------- Preferencias de la clienta ----------
create or replace function public.mis_preferencias(p_tenant_id uuid)
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare v_c uuid := public.mi_cliente_id(p_tenant_id); p record;
begin
  if v_c is null then return null; end if;
  select * into p from public.comunicacion_preferencias where cliente_id = v_c;
  return json_build_object('marketing_ok', coalesce(p.marketing_ok, false), 'email_ok', coalesce(p.email_ok, true), 'whatsapp_ok', coalesce(p.whatsapp_ok, true));
end $$;
revoke all on function public.mis_preferencias(uuid) from public;
grant execute on function public.mis_preferencias(uuid) to authenticated;

create or replace function public.guardar_mis_preferencias(p_tenant_id uuid, p_marketing boolean, p_email boolean, p_whatsapp boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_c uuid := public.mi_cliente_id(p_tenant_id);
begin
  if v_c is null then raise exception 'No autorizado'; end if;
  insert into public.comunicacion_preferencias (cliente_id, tenant_id, marketing_ok, email_ok, whatsapp_ok) values (v_c, p_tenant_id, p_marketing, p_email, p_whatsapp)
    on conflict (cliente_id) do update set marketing_ok = excluded.marketing_ok, email_ok = excluded.email_ok, whatsapp_ok = excluded.whatsapp_ok, updated_at = now();
end $$;
revoke all on function public.guardar_mis_preferencias(uuid, boolean, boolean, boolean) from public;
grant execute on function public.guardar_mis_preferencias(uuid, boolean, boolean, boolean) to authenticated;

-- ---------- Mensajes automáticos (transaccionales) ----------
create or replace function public._encolar_transaccional(p_tenant uuid, p_cliente uuid, p_clave text, p_vars jsonb, p_unica text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_c public.clientes; v_pl record; v_estudio text; v_pref record; v_dest text; v_cuerpo text; v_asunto text; k text;
begin
  select * into v_c from public.clientes where id = p_cliente;
  if v_c.id is null then return; end if;
  select name into v_estudio from public.tenants where id = p_tenant;
  select * into v_pref from public.comunicacion_preferencias where cliente_id = p_cliente;
  for v_pl in select * from public.plantillas_mensaje where tenant_id = p_tenant and clave = p_clave and tipo = 'transaccional' and activa loop
    if v_pl.canal = 'email' and v_pref.cliente_id is not null and not v_pref.email_ok then continue; end if;
    if v_pl.canal = 'whatsapp' and v_pref.cliente_id is not null and not v_pref.whatsapp_ok then continue; end if;
    v_dest := case v_pl.canal when 'email' then nullif(trim(coalesce(v_c.email,'')),'') else nullif(trim(coalesce(v_c.telefono,'')),'') end;
    if v_dest is null then continue; end if;
    v_cuerpo := public._render_mensaje(v_pl.cuerpo, v_c, v_estudio); v_asunto := public._render_mensaje(coalesce(v_pl.asunto,''), v_c, v_estudio);
    for k in select jsonb_object_keys(p_vars) loop
      v_cuerpo := replace(v_cuerpo, '{{' || k || '}}', coalesce(p_vars->>k, '')); v_asunto := replace(v_asunto, '{{' || k || '}}', coalesce(p_vars->>k, ''));
    end loop;
    insert into public.cola_mensajes (tenant_id, cliente_id, canal, destino, asunto, cuerpo, tipo, clave_unica)
      values (p_tenant, p_cliente, v_pl.canal, v_dest, nullif(v_asunto,''), v_cuerpo, 'transaccional', p_unica || ':' || v_pl.canal) on conflict do nothing;
  end loop;
end $$;
revoke all on function public._encolar_transaccional(uuid, uuid, text, jsonb, text) from public;

create or replace function public._tg_reserva_mensajes()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare h record; v_sede text;
begin
  if new.tipo = 'privada' then return new; end if;
  select h2.nombre_clase, h2.hora_inicio into h from public.horarios h2 where h2.id = new.horario_id;
  select name into v_sede from public.sedes where id = new.sede_id;
  if tg_op = 'INSERT' and new.estado = 'confirmada' then
    perform public._encolar_transaccional(new.tenant_id, new.cliente_id, 'reserva_confirmada',
      jsonb_build_object('clase', h.nombre_clase, 'fecha', to_char(new.fecha, 'DD/MM'), 'hora', to_char(h.hora_inicio, 'HH24:MI'), 'sede', v_sede), 'res-ok:' || new.id);
  elsif tg_op = 'UPDATE' and old.estado = 'confirmada' and new.estado = 'cancelada' then
    perform public._encolar_transaccional(new.tenant_id, new.cliente_id, 'reserva_cancelada',
      jsonb_build_object('clase', h.nombre_clase, 'fecha', to_char(new.fecha, 'DD/MM'), 'hora', to_char(h.hora_inicio, 'HH24:MI'), 'sede', v_sede), 'res-cancel:' || new.id);
  end if;
  return new;
end $$;
drop trigger if exists reservas_mensajes on public.reservas;
create trigger reservas_mensajes after insert or update of estado on public.reservas for each row execute function public._tg_reserva_mensajes();

-- Recordatorio diario: paquetes que vencen en 3 días (una sola vez por paquete).
create or replace function public.encolar_recordatorios()
returns integer language plpgsql security definer set search_path to 'public' as $$
declare r record; n int := 0;
begin
  for r in select m.id, m.tenant_id, m.cliente_id, m.fecha_vencimiento, p.nombre as paquete from public.membresias m join public.paquetes p on p.id = m.paquete_id
      where m.estado = 'activa' and m.fecha_vencimiento = current_date + 3 loop
    perform public._encolar_transaccional(r.tenant_id, r.cliente_id, 'paquete_por_vencer', jsonb_build_object('paquete', r.paquete, 'vence', to_char(r.fecha_vencimiento, 'DD/MM')), 'vence:' || r.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.encolar_recordatorios() from public;
grant execute on function public.encolar_recordatorios() to service_role;
select cron.schedule('encolar_recordatorios', '0 14 * * *', 'select public.encolar_recordatorios()') where not exists (select 1 from cron.job where jobname = 'encolar_recordatorios');
