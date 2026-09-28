-- Hito C — núcleo funcional, capa de tablas (sin RPCs todavía).
-- Columnas portadas 1:1 desde la base real de Forma (auditoria/03_nucleo_hito_c_vs_resto.md),
-- consultadas en vivo vía information_schema.columns el 2026-09-28, no adivinadas.
-- Decisiones de diseño explícitas (no silenciosas):
--   1. `perfiles` de Forma se absorbe en `tenant_memberships` (ya existe desde el Hito B) — se le
--      agregan nombre/genero. No se crea una tabla perfiles separada: habría duplicado tenant_id+user_id
--      sin aportar nada que tenant_memberships no tenga ya.
--   2. `tenant_id` se denormaliza en TODAS las tablas, incluidas las hijas (horario_cancelaciones,
--      lista_espera, etc.) en vez de forzar un join hacia arriba en cada política de RLS — política más
--      simple y más rápida; la consistencia tenant_id-hijo == tenant_id-padre la garantizan las RPCs de
--      escritura del Hito C, no una tabla intermedia.
--   3. Cobertura de sedes de paquetes/membresías (sección 7 del maestro): `paquete_sedes` y
--      `membresia_sedes` son tablas puente. `membresia_sedes` es una INSTANTÁNEA al momento de la venta
--      (nunca se recalcula si el catálogo cambia después) — eso es literal, no interpretación.
--   4. Los timestamps de bookkeeping de notificaciones muy específicos de Forma
--      (`descuento_canal_notificado_at`, `recordatorio_password_enviado_at`) se omiten aquí a propósito:
--      vuelven cuando se construya el flujo de notificación que los usa, no antes.
--   5. Las 63 RPCs de negocio (reservar, cancelar, congelar membresía, etc.) NO están en esta migración
--      — es la siguiente pieza, deliberadamente separada porque necesita leer el cuerpo real de cada
--      función de Forma (esta migración solo tenía firmas, no `prosrc`) para portar la lógica fiel, no
--      reinventarla.

alter table public.tenant_memberships add column if not exists nombre text;
alter table public.tenant_memberships add column if not exists genero text;

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  sede_habitual_id uuid references public.sedes(id) on delete set null,
  nombre text not null,
  email text,
  telefono text not null,
  notas text,
  genero text,
  fecha_nacimiento date,
  cuidados_especiales text,
  codigo_referido text,
  referido_por uuid references public.clientes(id) on delete set null,
  credito_referido_otorgado boolean not null default false,
  terminos_aceptados_at timestamptz,
  contacto_emergencia text,
  objetivos text[],
  objetivo_otro text,
  experiencia_pilates text,
  consiente_responsabilidad boolean not null default false,
  consiente_cancelacion boolean not null default false,
  autoriza_imagen boolean not null default false,
  consentimiento_firma_nombre text,
  consentimiento_completado_at timestamptz,
  como_se_entero text,
  tutor_id uuid references public.clientes(id) on delete set null,
  es_menor boolean not null default false,
  es_cuenta_familiar boolean not null default false,
  created_at timestamptz not null default now()
);
create index clientes_tenant_idx on public.clientes(tenant_id);
create unique index clientes_tenant_user_uidx on public.clientes(tenant_id, user_id) where user_id is not null;

create table public.horarios (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sede_id uuid not null references public.sedes(id) on delete cascade,
  instructor_membership_id uuid references public.tenant_memberships(id) on delete set null,
  dia_semana integer not null check (dia_semana between 0 and 6),
  hora_inicio time not null,
  hora_fin time not null,
  cupo_maximo integer not null default 6,
  nombre_clase text not null default 'Clase',
  categoria text not null default 'regular',
  fecha_especifica date,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create index horarios_tenant_idx on public.horarios(tenant_id);
create index horarios_sede_idx on public.horarios(sede_id);

create table public.horario_cancelaciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  horario_id uuid not null references public.horarios(id) on delete cascade,
  fecha date not null,
  created_at timestamptz not null default now(),
  unique (horario_id, fecha)
);
create index horario_cancelaciones_tenant_idx on public.horario_cancelaciones(tenant_id);

create table public.horario_fechas_privadas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  horario_id uuid not null references public.horarios(id) on delete cascade,
  fecha date not null,
  cupo integer not null default 1,
  created_at timestamptz not null default now(),
  unique (horario_id, fecha)
);
create index horario_fechas_privadas_tenant_idx on public.horario_fechas_privadas(tenant_id);

create table public.horario_fechas_privadas_personas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  privatizacion_id uuid not null references public.horario_fechas_privadas(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  reserva_id uuid,
  precio numeric not null,
  metodo_pago text not null,
  referencia_pago text,
  pagada boolean not null default false,
  confirmado_at timestamptz,
  confirmado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index horario_fechas_privadas_personas_tenant_idx on public.horario_fechas_privadas_personas(tenant_id);

create table public.reservas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sede_id uuid not null references public.sedes(id) on delete cascade,
  horario_id uuid not null references public.horarios(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  fecha date not null,
  tipo text not null default 'regular',
  estado text not null default 'confirmada' check (estado in ('confirmada','cancelada','en_espera')),
  asistio boolean,
  penalizada boolean not null default false,
  liberada_por_no_confirmar boolean not null default false,
  confirmacion_enviada_at timestamptz,
  confirmada_por_clienta_at timestamptz,
  created_at timestamptz not null default now()
);
create index reservas_tenant_idx on public.reservas(tenant_id);
create index reservas_sede_idx on public.reservas(sede_id);
create index reservas_cliente_idx on public.reservas(cliente_id);
create index reservas_horario_fecha_idx on public.reservas(horario_id, fecha);

create table public.lista_espera (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  horario_id uuid not null references public.horarios(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  fecha date not null,
  created_at timestamptz not null default now()
);
create index lista_espera_tenant_idx on public.lista_espera(tenant_id);

create table public.lista_espera_notificaciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  reserva_id uuid not null references public.reservas(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  enviado boolean not null default false,
  created_at timestamptz not null default now()
);
create index lista_espera_notificaciones_tenant_idx on public.lista_espera_notificaciones(tenant_id);

create table public.paquetes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nombre text not null,
  descripcion text,
  num_clases integer,
  precio numeric not null,
  vigencia_dias integer not null,
  cobertura text not null default 'sede' check (cobertura in ('sede','sedes','todas')),
  activo boolean not null default true,
  orden integer not null default 0,
  featured boolean not null default false,
  badge text,
  categoria text not null default 'regular',
  compartido_familiar boolean not null default false,
  created_at timestamptz not null default now()
);
create index paquetes_tenant_idx on public.paquetes(tenant_id);

-- Cobertura explícita cuando paquetes.cobertura = 'sedes'. Vacía si 'sede' (implícita: la única
-- sede de venta) o 'todas' (implícita: todas las sedes del tenant, incluidas futuras — regla 7 del maestro).
create table public.paquete_sedes (
  paquete_id uuid not null references public.paquetes(id) on delete cascade,
  sede_id uuid not null references public.sedes(id) on delete cascade,
  primary key (paquete_id, sede_id)
);

create table public.membresias (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  paquete_id uuid not null references public.paquetes(id),
  sede_venta_id uuid references public.sedes(id),
  cobertura_tipo text not null check (cobertura_tipo in ('sede','sedes','todas')),
  clases_totales integer,
  clases_usadas integer not null default 0,
  fecha_inicio date,
  fecha_vencimiento date,
  estado text not null default 'pendiente_pago' check (estado in ('pendiente_pago','activa','vencida','anulada')),
  referencia_pago text,
  comprobante_url text,
  confirmado_at timestamptz,
  confirmado_por uuid references auth.users(id),
  descuento_pct numeric not null default 0,
  precio_final numeric,
  metodo_pago text not null default 'transferencia',
  pagada boolean not null default true,
  auto_generada boolean not null default false,
  origen text not null default 'compra',
  congelada_desde date,
  anulada_at timestamptz,
  anulada_por uuid references auth.users(id),
  anulada_motivo text,
  transferida_de_id uuid references public.membresias(id),
  transferida_at timestamptz,
  transferida_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index membresias_tenant_idx on public.membresias(tenant_id);
create index membresias_cliente_idx on public.membresias(cliente_id);

-- Instantánea de cobertura al momento de vender la membresía — nunca se recalcula si `paquete_sedes`
-- cambia después (regla 7 del maestro: "editar luego el catálogo no modifica en silencio derechos ya pagados").
create table public.membresia_sedes (
  membresia_id uuid not null references public.membresias(id) on delete cascade,
  sede_id uuid not null references public.sedes(id) on delete cascade,
  primary key (membresia_id, sede_id)
);

create table public.pago_transacciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sede_venta_id uuid references public.sedes(id),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  paquete_id uuid references public.paquetes(id),
  membresia_id uuid references public.membresias(id),
  tipo text not null default 'paquete',
  proveedor text not null,
  proveedor_transaccion_id text,
  monto numeric not null,
  moneda text not null default 'GTQ',
  estado text not null default 'iniciado' check (estado in ('iniciado','confirmado','rechazado','reembolsado')),
  descuento_pct numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);
create index pago_transacciones_tenant_idx on public.pago_transacciones(tenant_id);
-- set_updated_at() del Hito B escribe en `updated_at`; pago_transacciones usa `actualizado_at`
-- (nombre real de Forma) — función de trigger dedicada en vez de reusar la genérica.
create or replace function public.set_actualizado_at()
returns trigger language plpgsql as $$
begin
  new.actualizado_at = now();
  return new;
end;
$$;
create trigger pago_transacciones_set_actualizado_at before update on public.pago_transacciones
  for each row execute function public.set_actualizado_at();

-- Config por tenant: en Forma eran singleton (id boolean, una sola fila). Multi-tenant: una fila por tenant.
create table public.configuracion_reservas (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  horas_minimas_cancelacion integer not null default 2,
  horas_minimas_confirmacion integer not null default 1,
  meta_cupos_apertura integer,
  updated_at timestamptz not null default now()
);
create table public.configuracion_pago (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  banco text,
  tipo_cuenta text,
  numero_cuenta text,
  titular text,
  updated_at timestamptz not null default now()
);
create table public.configuracion_app (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  version_minima_ios text not null default '1.0.0',
  version_minima_android text not null default '1.0.0',
  mensaje_actualizacion text,
  url_app_store text,
  url_play_store text,
  updated_at timestamptz not null default now()
);
create trigger configuracion_reservas_set_updated_at before update on public.configuracion_reservas
  for each row execute function public.set_updated_at();
create trigger configuracion_pago_set_updated_at before update on public.configuracion_pago
  for each row execute function public.set_updated_at();
create trigger configuracion_app_set_updated_at before update on public.configuracion_app
  for each row execute function public.set_updated_at();

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id, token)
);
create index push_tokens_tenant_idx on public.push_tokens(tenant_id);

create table public.notificaciones_push_enviadas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null,
  titulo text not null,
  cuerpo text not null,
  audiencia text not null,
  destinatarios integer not null default 0,
  enviado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index notificaciones_push_enviadas_tenant_idx on public.notificaciones_push_enviadas(tenant_id);

-- error_logs: tenant_id nullable a propósito (regla del maestro, sección 2.2) — un error de plataforma
-- (fuera de un tenant, ej. en la consola SaaS) no tiene tenant que asignarle.
create table public.error_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  firma text not null,
  mensaje text not null,
  stack text,
  url text,
  contexto jsonb,
  nivel text not null default 'error',
  veces integer not null default 1,
  primera_vez timestamptz not null default now(),
  ultima_vez timestamptz not null default now(),
  resuelto boolean not null default false,
  resuelto_por uuid references auth.users(id),
  resuelto_at timestamptz
);
create index error_logs_tenant_idx on public.error_logs(tenant_id);

-- === RLS: habilitado en las 20 tablas nuevas, sin excepción ===
alter table public.clientes enable row level security;
alter table public.horarios enable row level security;
alter table public.horario_cancelaciones enable row level security;
alter table public.horario_fechas_privadas enable row level security;
alter table public.horario_fechas_privadas_personas enable row level security;
alter table public.reservas enable row level security;
alter table public.lista_espera enable row level security;
alter table public.lista_espera_notificaciones enable row level security;
alter table public.paquetes enable row level security;
alter table public.paquete_sedes enable row level security;
alter table public.membresias enable row level security;
alter table public.membresia_sedes enable row level security;
alter table public.pago_transacciones enable row level security;
alter table public.configuracion_reservas enable row level security;
alter table public.configuracion_pago enable row level security;
alter table public.configuracion_app enable row level security;
alter table public.push_tokens enable row level security;
alter table public.notificaciones_push_enviadas enable row level security;
alter table public.error_logs enable row level security;

-- Staff (dueña/gerente_general/admin_sede/recepción/instructora/contadora, vía tenant_memberships):
-- lectura por tenant. El recorte por sede (admin_sede/recepción/instructora solo su(s) sede(s)) y por
-- rol financiero (contadora) es trabajo de la matriz de permisos (sección 12) — se afina cuando se
-- construyan las RPCs y el servicio de autorización del Hito C, no se adivina aquí con una política
-- de SELECT amplia. Por ahora: staff ve su tenant completo (regla de negocio real: dueña/gerente ya
-- necesitan esto; el recorte fino no baja seguridad, solo restringe más adelante).
create policy clientes_staff_select on public.clientes for select using (tenant_id in (select public.current_tenant_ids()));
create policy clientes_propia_select on public.clientes for select using (user_id = auth.uid());

create policy horarios_select on public.horarios for select using (tenant_id in (select public.current_tenant_ids()));
create policy horario_cancelaciones_select on public.horario_cancelaciones for select using (tenant_id in (select public.current_tenant_ids()));
create policy horario_fechas_privadas_select on public.horario_fechas_privadas for select using (tenant_id in (select public.current_tenant_ids()));
create policy horario_fechas_privadas_personas_staff_select on public.horario_fechas_privadas_personas for select using (tenant_id in (select public.current_tenant_ids()));
create policy horario_fechas_privadas_personas_propia_select on public.horario_fechas_privadas_personas for select using (
  cliente_id in (select id from public.clientes where user_id = auth.uid())
);

create policy reservas_staff_select on public.reservas for select using (tenant_id in (select public.current_tenant_ids()));
create policy reservas_propia_select on public.reservas for select using (
  cliente_id in (select id from public.clientes where user_id = auth.uid())
);

create policy lista_espera_staff_select on public.lista_espera for select using (tenant_id in (select public.current_tenant_ids()));
create policy lista_espera_propia_select on public.lista_espera for select using (
  cliente_id in (select id from public.clientes where user_id = auth.uid())
);
create policy lista_espera_notificaciones_staff_select on public.lista_espera_notificaciones for select using (tenant_id in (select public.current_tenant_ids()));
create policy lista_espera_notificaciones_propia_select on public.lista_espera_notificaciones for select using (
  cliente_id in (select id from public.clientes where user_id = auth.uid())
);

-- paquetes: catálogo visible para cualquiera dentro del tenant (incluida la clienta explorando oferta).
create policy paquetes_select on public.paquetes for select using (tenant_id in (
  select tenant_id from public.tenant_memberships where user_id = auth.uid()
  union
  select tenant_id from public.clientes where user_id = auth.uid()
));
create policy paquete_sedes_select on public.paquete_sedes for select using (
  paquete_id in (select id from public.paquetes)
);

create policy membresias_staff_select on public.membresias for select using (tenant_id in (select public.current_tenant_ids()));
create policy membresias_propia_select on public.membresias for select using (
  cliente_id in (select id from public.clientes where user_id = auth.uid())
);
create policy membresia_sedes_select on public.membresia_sedes for select using (
  membresia_id in (select id from public.membresias)
);

create policy pago_transacciones_staff_select on public.pago_transacciones for select using (tenant_id in (select public.current_tenant_ids()));
create policy pago_transacciones_propia_select on public.pago_transacciones for select using (
  cliente_id in (select id from public.clientes where user_id = auth.uid())
);

create policy configuracion_reservas_select on public.configuracion_reservas for select using (tenant_id in (select public.current_tenant_ids()));
create policy configuracion_pago_select on public.configuracion_pago for select using (tenant_id in (select public.current_tenant_ids()));
create policy configuracion_app_select on public.configuracion_app for select using (tenant_id in (select public.current_tenant_ids()));

create policy push_tokens_own_select on public.push_tokens for select using (user_id = auth.uid());
create policy notificaciones_push_enviadas_staff_select on public.notificaciones_push_enviadas for select using (tenant_id in (select public.current_tenant_ids()));

create policy error_logs_staff_select on public.error_logs for select using (tenant_id in (select public.current_tenant_ids()));

-- === GRANT junto con RLS (regla 6). Solo SELECT por ahora — INSERT/UPDATE/DELETE llegan con las RPCs
-- del Hito C, cada una con su propia política de escritura acotada al flujo exacto que resuelve. ===
grant select on public.clientes, public.horarios, public.horario_cancelaciones,
  public.horario_fechas_privadas, public.horario_fechas_privadas_personas, public.reservas,
  public.lista_espera, public.lista_espera_notificaciones, public.paquetes, public.paquete_sedes,
  public.membresias, public.membresia_sedes, public.pago_transacciones, public.configuracion_reservas,
  public.configuracion_pago, public.configuracion_app, public.push_tokens,
  public.notificaciones_push_enviadas, public.error_logs
  to authenticated;

-- anon: cero acceso a datos de tenant (mismo hallazgo del Hito B — revocar el default de la plataforma).
revoke all on public.clientes, public.horarios, public.horario_cancelaciones,
  public.horario_fechas_privadas, public.horario_fechas_privadas_personas, public.reservas,
  public.lista_espera, public.lista_espera_notificaciones, public.paquetes, public.paquete_sedes,
  public.membresias, public.membresia_sedes, public.pago_transacciones, public.configuracion_reservas,
  public.configuracion_pago, public.configuracion_app, public.push_tokens,
  public.notificaciones_push_enviadas, public.error_logs
  from anon;

-- authenticated no debe heredar INSERT/UPDATE/DELETE del default de la plataforma tampoco (aún no hay
-- política de escritura para ninguna de estas tablas — el GRANT debe reflejar exactamente eso).
revoke insert, update, delete on public.clientes, public.horarios, public.horario_cancelaciones,
  public.horario_fechas_privadas, public.horario_fechas_privadas_personas, public.reservas,
  public.lista_espera, public.lista_espera_notificaciones, public.paquetes, public.paquete_sedes,
  public.membresias, public.membresia_sedes, public.pago_transacciones, public.configuracion_reservas,
  public.configuracion_pago, public.configuracion_app, public.push_tokens,
  public.notificaciones_push_enviadas, public.error_logs
  from authenticated;
