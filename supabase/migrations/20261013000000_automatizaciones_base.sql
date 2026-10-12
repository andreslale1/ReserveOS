-- AUTOMATIZACIONES PROGRAMADAS · base. Todo es multi-tenant, usa la hora de la sede (nunca UTC fijo), respeta módulos activos, preferencias y
-- consentimiento, es idempotente y SOLO ENCOLA en cola_mensajes: no hay proveedor conectado, el envío real queda para cuando se conecte.

create table if not exists public.automatizaciones (
  clave text primary key, nombre text not null, descripcion text not null, frecuencia text not null,
  modulo text, toggleable boolean not null default true, audiencia text not null default 'clienta' check (audiencia in ('clienta','equipo','sistema')), orden int not null default 0);
create table if not exists public.automatizaciones_tenant (
  tenant_id uuid not null references public.tenants(id) on delete cascade, clave text not null references public.automatizaciones(clave) on delete cascade,
  activa boolean not null default true, updated_at timestamptz not null default now(), updated_by uuid, primary key (tenant_id, clave));
create table if not exists public.automatizaciones_latido (
  clave text primary key references public.automatizaciones(clave) on delete cascade, ultima_ejecucion timestamptz not null, ultimo_estado text not null, ultimo_error text, ejecuciones bigint not null default 0);
create table if not exists public.automatizaciones_ejecuciones (
  id uuid primary key default gen_random_uuid(), clave text not null references public.automatizaciones(clave) on delete cascade, ejecutado_at timestamptz not null default now(),
  estado text not null check (estado in ('ok','error')), encolados int not null default 0, detalle jsonb not null default '{}', error text, duracion_ms int);
create index if not exists automatizaciones_ejecuciones_idx on public.automatizaciones_ejecuciones (clave, ejecutado_at desc);
create table if not exists public.salud_chequeos (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade, fecha_local date not null,
  ejecutado_at timestamptz not null default now(), problemas int not null default 0, resultados jsonb not null default '{}', unique (tenant_id, fecha_local));
alter table public.automatizaciones enable row level security; alter table public.automatizaciones_tenant enable row level security;
alter table public.automatizaciones_latido enable row level security; alter table public.automatizaciones_ejecuciones enable row level security;
alter table public.salud_chequeos enable row level security;
revoke all on public.automatizaciones, public.automatizaciones_tenant, public.automatizaciones_latido, public.automatizaciones_ejecuciones, public.salud_chequeos from anon, authenticated;

insert into public.automatizaciones (clave, nombre, descripcion, frecuencia, modulo, toggleable, audiencia, orden) values
 ('recordatorio_clase','Recordatorio 1 hora antes de la clase','Avisa a cada clienta con reserva confirmada que su clase empieza en una hora.','cada 10 minutos','nucleo_agenda_reservas',true,'clienta',10),
 ('reserva_agendada','Recordatorio de reserva agendada','Un día antes (entre 12 y 24 horas), recuerda las clases reservadas.','cada 15 minutos','nucleo_agenda_reservas',true,'clienta',20),
 ('confirmacion_asistencia','Confirmación de asistencia','Pide confirmar la asistencia antes de la clase y manda un último aviso antes de liberar el cupo.','cada 10 minutos','nucleo_agenda_reservas',true,'clienta',30),
 ('horario_fijo','Recordatorio de horario fijo','Si una clienta suele ir al mismo horario y aún no reservó la próxima fecha, se lo recuerda.','cada 15 minutos','horario_fijo',true,'clienta',40),
 ('aviso_inasistencia','Aviso de inasistencia («te extrañamos»)','Escribe a quien reservó y no vino, después de que termine la clase.','cada 10 minutos','nucleo_agenda_reservas',true,'clienta',50),
 ('aviso_asistencia','Aviso de asistencia confirmada','Agradece la asistencia y dice cuántas clases le quedan.','cada 10 minutos','nucleo_agenda_reservas',true,'clienta',60),
 ('avisos_operativos','Avisos operativos de clase','Avisa a la instructora cuando su clase está por comenzar y cuando terminó para marcar la asistencia.','cada 10 minutos','nucleo_agenda_reservas',true,'equipo',70),
 ('liberar_cupos','Liberar cupos no confirmados','Si una reserva no se confirma a tiempo y la clase está llena, libera el cupo y avisa.','cada 10 minutos','nucleo_agenda_reservas',false,'clienta',80),
 ('lista_espera_vencida','Lista de espera vencida','Limpia la lista de espera de las clases que ya empezaron.','cada 15 minutos','lista_espera',false,'sistema',90),
 ('reconciliar_pagos','Reconciliación de pagos en línea','Marca para revisión los pagos en línea que llevan más de 2 horas sin confirmación del proveedor.','cada 2 minutos','cobros_online',true,'sistema',100),
 ('salud_sistema','Salud del sistema','Cada mañana (8 a. m. de la sede) revisa reservas, paquetes, inventario, cupos y pagos, y avisa a la dueña si algo no cuadra.','diario, 8:07 a. m.',null,true,'equipo',110),
 ('paquetes_por_vencer','Paquetes por vencer','Avisa a las clientas cuyo paquete vence en 3 días.','diario, 9:07 a. m.','nucleo_agenda_reservas',true,'clienta',120),
 ('clientas_inactivas','Clientas inactivas','Escribe a quien tiene paquete activo y lleva 14 días o más sin venir.','diario, 10:07 a. m.','nucleo_agenda_reservas',true,'clienta',130),
 ('cuentas_sin_password','Cuentas sin contraseña','Recuerda crear su contraseña a quien fue dada de alta por recepción y nunca entró.','diario, 11:07 a. m.','nucleo_agenda_reservas',true,'clienta',140),
 ('analisis_semanal','Análisis semanal','Los lunes a las 7:30 a. m. manda a la dueña cómo cerró la semana y cómo arranca la siguiente.','lunes, 7:30 a. m.',null,true,'equipo',150)
on conflict (clave) do update set nombre=excluded.nombre, descripcion=excluded.descripcion, frecuencia=excluded.frecuencia, modulo=excluded.modulo, toggleable=excluded.toggleable, audiencia=excluded.audiencia, orden=excluded.orden;

-- Hora de la sede ------------------------------------------------------------------------------------------------------
create or replace function public._tenant_tz(p_tenant uuid) returns text language sql stable security definer set search_path = public as $$
  select coalesce((select timezone from public.sedes where tenant_id = p_tenant order by created_at limit 1), 'America/Guatemala') $$;
create or replace function public._hora_local(p_tenant uuid, p_ahora timestamptz) returns int language sql stable security definer set search_path = public as $$
  select extract(hour from p_ahora at time zone public._tenant_tz(p_tenant))::int $$;
create or replace function public._fecha_local(p_tenant uuid, p_ahora timestamptz) returns date language sql stable security definer set search_path = public as $$
  select (p_ahora at time zone public._tenant_tz(p_tenant))::date $$;

-- ¿Corre esta automatización para este estudio? (estudio operando + módulo contratado y activo + no apagada por la dueña)
create or replace function public._auto_activa(p_tenant uuid, p_clave text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select t.status in ('activo','en_implantacion') from public.tenants t where t.id = p_tenant), false)
     and coalesce((select a.activa from public.automatizaciones_tenant a where a.tenant_id = p_tenant and a.clave = p_clave), true)
     and coalesce((select case when x.modulo is null then true else public.modulo_activo(p_tenant, x.modulo) end from public.automatizaciones x where x.clave = p_clave), true) $$;

create or replace function public._sumar(p_det jsonb, p_tenant uuid, p_n int) returns jsonb language sql immutable as $$
  select jsonb_set(coalesce(p_det,'{}'::jsonb), array[p_tenant::text], to_jsonb(coalesce((p_det->>p_tenant::text)::int, 0) + p_n)) $$;

-- Registro de cada ejecución: latido siempre; detalle solo si encoló algo o falló (así la tabla no crece con corridas vacías).
create or replace function public._auto_log(p_clave text, p_t0 timestamptz, p_det jsonb, p_error text) returns void language plpgsql security definer set search_path = public as $$
declare v_n int := coalesce((select sum(value::int) from jsonb_each_text(coalesce(p_det,'{}'::jsonb))), 0);
begin
  insert into public.automatizaciones_latido (clave, ultima_ejecucion, ultimo_estado, ultimo_error, ejecuciones)
    values (p_clave, now(), case when p_error is null then 'ok' else 'error' end, p_error, 1)
    on conflict (clave) do update set ultima_ejecucion = now(), ultimo_estado = excluded.ultimo_estado, ultimo_error = excluded.ultimo_error, ejecuciones = public.automatizaciones_latido.ejecuciones + 1;
  if v_n > 0 or p_error is not null then
    insert into public.automatizaciones_ejecuciones (clave, ejecutado_at, estado, encolados, detalle, error, duracion_ms)
      values (p_clave, p_t0, case when p_error is null then 'ok' else 'error' end, v_n, coalesce(p_det,'{}'::jsonb), p_error, (extract(epoch from clock_timestamp() - p_t0) * 1000)::int);
  end if;
end $$;

-- Plantillas por defecto, creadas la primera vez que se necesitan (el estudio puede editarlas después).
create or replace function public._asegurar_plantilla_auto(p_tenant uuid, p_clave text) returns void language plpgsql security definer set search_path = public as $$
declare v jsonb := jsonb_build_object(
  'recordatorio_clase', jsonb_build_array('Tu clase empieza en una hora', 'Hola {{nombre}}, te recordamos tu clase de {{clase}} hoy a las {{hora}} en {{estudio}}. ¡Te esperamos!'),
  'reserva_agendada', jsonb_build_array('Mañana tienes clase', 'Hola {{nombre}}, tienes {{clase}} el {{fecha}} a las {{hora}} en {{estudio}}.'),
  'confirmar_asistencia', jsonb_build_array('Confirma tu asistencia', 'Hola {{nombre}}, confirma tu asistencia a {{clase}} el {{fecha}} a las {{hora}}. Si no puedes venir, cancela para liberar tu lugar.'),
  'confirmar_asistencia_ultimo', jsonb_build_array('Último aviso para confirmar', 'Último aviso, {{nombre}}: confirma tu asistencia a {{clase}} ({{fecha}}, {{hora}}) o tu lugar podría liberarse.'),
  'horario_fijo', jsonb_build_array('Tu horario de siempre te espera', 'Hola {{nombre}}, tu horario de siempre ({{clase}}, {{hora}}) está disponible el {{fecha}}. ¡Resérvalo!'),
  'inasistencia', jsonb_build_array('Hoy te extrañamos', 'Hola {{nombre}}, hoy no te vimos en {{clase}}. ¡Te extrañamos! Reserva tu próxima clase cuando quieras.'),
  'asistencia_confirmada', jsonb_build_array('Gracias por venir', 'Gracias por venir a {{clase}}, {{nombre}}. Tu asistencia quedó registrada. Te quedan {{restantes}} clases.'),
  'cupo_liberado', jsonb_build_array('Tu reserva se liberó', 'Hola {{nombre}}, tu reserva de {{clase}} del {{fecha}} se liberó porque no se confirmó a tiempo.'),
  'cuenta_sin_password', jsonb_build_array('Crea tu contraseña', 'Hola {{nombre}}, crea tu contraseña para entrar a {{estudio}}: {{enlace}}'),
  'te_extrañamos', jsonb_build_array('Te extrañamos', 'Hola {{nombre}}, hace tiempo que no te vemos en {{estudio}}. ¡Reserva tu próxima clase!'),
  'paquete_por_vencer', jsonb_build_array('Tu paquete está por vencer', 'Hola {{nombre}}, tu paquete {{paquete}} vence el {{vence}}. ¡Aprovecha tus clases!'));
begin
  if v->p_clave is null then return; end if;
  insert into public.plantillas_mensaje (tenant_id, clave, nombre, canal, tipo, asunto, cuerpo, activa)
    select p_tenant, p_clave, initcap(replace(p_clave,'_',' ')), c, 'transaccional', case when c = 'email' then v->p_clave->>0 else null end, v->p_clave->>1, true
    from unnest(array['email','whatsapp']) c on conflict (tenant_id, clave, canal) do nothing;
end $$;

-- Encola a una clienta usando su plantilla y respetando sus preferencias. Devuelve cuántos mensajes NUEVOS entraron a la cola (0 si ya estaban).
create or replace function public._encolar_auto(p_tenant uuid, p_cliente uuid, p_clave text, p_vars jsonb, p_unica text) returns int language plpgsql security definer set search_path = public as $$
declare a int; b int;
begin
  perform public._asegurar_plantilla_auto(p_tenant, p_clave);
  select count(*) into a from public.cola_mensajes where tenant_id = p_tenant and left(clave_unica, length(p_unica) + 1) = p_unica || ':';
  perform public._encolar_transaccional(p_tenant, p_cliente, p_clave, p_vars, p_unica);
  select count(*) into b from public.cola_mensajes where tenant_id = p_tenant and left(clave_unica, length(p_unica) + 1) = p_unica || ':';
  return b - a;
end $$;

-- Correos de la dueña y gerencia general del estudio.
create or replace function public._emails_duenas(p_tenant uuid) returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct lower(u.email)), '{}') from public.tenant_memberships m join auth.users u on u.id = m.user_id
  where m.tenant_id = p_tenant and m.role in ('duena','gerente_general') and nullif(trim(coalesce(u.email,'')),'') is not null $$;

-- Mensaje al equipo (no a una clienta): una fila por destinatario, idempotente por clave.
create or replace function public._encolar_equipo(p_tenant uuid, p_emails text[], p_asunto text, p_cuerpo text, p_unica text) returns int language plpgsql security definer set search_path = public as $$
declare e text; n int := 0; k int;
begin
  foreach e in array coalesce(p_emails, '{}') loop
    insert into public.cola_mensajes (tenant_id, canal, destino, asunto, cuerpo, tipo, clave_unica)
      values (p_tenant, 'email', e, p_asunto, p_cuerpo, 'operativo', p_unica || ':' || e) on conflict do nothing;
    get diagnostics k = row_count; n := n + k;
  end loop;
  return n;
end $$;
