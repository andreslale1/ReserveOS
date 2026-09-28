-- Módulo "resto" — capa de tablas (28, sección 5/13 del maestro: activables por tenant, no bloquean
-- el lanzamiento de VIM). Columnas reales de Forma (auditoria/raw/06_columnas_resto.txt), no adivinadas.
--
-- Decisiones de diseño explícitas:
--   1. `contenido_sitio` (CMS del portal público): mismo shape de 82 columnas que Forma, pero SIN el
--      copy real de Forma como default — cada tenant llena el suyo. PK tenant_id (antes singleton
--      `id boolean`), igual que configuracion_reservas/pago/app del Hito B.
--   2. `configuracion_contacto`/`configuracion_finanzas`: mismo patrón singleton→por-tenant.
--   3. `tenant_id` denormalizado en todas las tablas hijas, mismo criterio que el núcleo (Hito C).
--   4. Finanzas (activos/pasivos/gastos/gasto_marketing/metas_mensuales) y cobros_personalizados/
--      cierre_caja llevan `sede_id` NULABLE — null = consolidado del tenant, con sede = local
--      (regla del maestro: "separar gasto local de central").
--   5. `cierre_caja` no tenía `id` en Forma (PK era `fecha`, una sola sede) — ahora PK compuesta
--      (tenant_id, sede_id, fecha).

create table public.cobros_personalizados (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sede_id uuid references public.sedes(id) on delete set null,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  concepto text not null,
  monto numeric not null,
  metodo_pago text not null,
  confirmado_at timestamptz not null default now(),
  confirmado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index cobros_personalizados_tenant_idx on public.cobros_personalizados(tenant_id);

create table public.cierre_caja (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sede_id uuid not null references public.sedes(id) on delete cascade,
  fecha date not null,
  efectivo_sistema numeric not null default 0,
  efectivo_contado numeric not null,
  tarjeta_sistema numeric not null default 0,
  tarjeta_contado numeric not null,
  transferencia_sistema numeric not null default 0,
  transferencia_contado numeric not null,
  notas text,
  cerrado_por uuid references auth.users(id),
  cerrado_at timestamptz not null default now(),
  primary key (tenant_id, sede_id, fecha)
);

create table public.productos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nombre text not null,
  descripcion text,
  precio numeric not null,
  unidad text not null default 'unidad',
  imagen_url text,
  categoria text not null default 'accesorios',
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);
create index productos_tenant_idx on public.productos(tenant_id);

create table public.producto_variantes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete cascade,
  nombre text not null,
  stock integer not null default 0,
  orden integer not null default 0,
  imagen_url text,
  created_at timestamptz not null default now()
);
create index producto_variantes_tenant_idx on public.producto_variantes(tenant_id);

create table public.carritos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  estado text not null default 'activo',
  created_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);
create index carritos_tenant_idx on public.carritos(tenant_id);
create trigger carritos_set_actualizado_at before update on public.carritos
  for each row execute function public.set_actualizado_at();

create table public.carrito_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  carrito_id uuid not null references public.carritos(id) on delete cascade,
  tipo text not null check (tipo in ('producto','paquete')),
  producto_id uuid references public.productos(id),
  variante_id uuid references public.producto_variantes(id),
  paquete_id uuid references public.paquetes(id),
  cantidad integer not null default 1,
  created_at timestamptz not null default now()
);
create index carrito_items_tenant_idx on public.carrito_items(tenant_id);

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sede_entrega_id uuid references public.sedes(id) on delete set null,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  estado text not null default 'pendiente_pago' check (estado in ('pendiente_pago','pagado','entregado','cancelado')),
  metodo_pago text not null,
  total numeric not null,
  descuento_pct numeric not null default 0,
  pagado_at timestamptz,
  entregado_at timestamptz,
  entregado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index pedidos_tenant_idx on public.pedidos(tenant_id);

create table public.pedido_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  tipo text not null check (tipo in ('producto','paquete')),
  producto_id uuid references public.productos(id),
  variante_id uuid references public.producto_variantes(id),
  paquete_id uuid references public.paquetes(id),
  membresia_id uuid references public.membresias(id),
  nombre text not null,
  variante_nombre text,
  cantidad integer not null default 1,
  precio_unitario numeric not null
);
create index pedido_items_tenant_idx on public.pedido_items(tenant_id);

create table public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  codigo text not null,
  paquete_id uuid not null references public.paquetes(id),
  estado text not null default 'activa' check (estado in ('activa','canjeada','cancelada')),
  comprador_nombre text,
  destinatario_nombre text,
  destinatario_email text,
  metodo_pago text,
  canjeada_por uuid references public.clientes(id),
  canjeada_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (tenant_id, codigo)
);
create index gift_cards_tenant_idx on public.gift_cards(tenant_id);

create table public.codigos_descuento (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  codigo text not null,
  descuento_pct integer not null,
  aplica_a text not null default 'paquetes' check (aplica_a in ('paquetes','productos')),
  activo boolean not null default true,
  usos_maximos integer,
  usos_actuales integer not null default 0,
  vigente_hasta date,
  auto_aplicar_canal text,
  created_at timestamptz not null default now(),
  unique (tenant_id, codigo)
);
create index codigos_descuento_tenant_idx on public.codigos_descuento(tenant_id);

create table public.codigos_descuento_paquetes (
  codigo_id uuid not null references public.codigos_descuento(id) on delete cascade,
  paquete_id uuid not null references public.paquetes(id) on delete cascade,
  precio_override numeric,
  primary key (codigo_id, paquete_id)
);
create table public.codigos_descuento_productos (
  codigo_id uuid not null references public.codigos_descuento(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete cascade,
  primary key (codigo_id, producto_id)
);

create table public.activos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sede_id uuid references public.sedes(id) on delete set null,
  descripcion text not null,
  fecha date not null,
  monto numeric not null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index activos_tenant_idx on public.activos(tenant_id);

create table public.pasivos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sede_id uuid references public.sedes(id) on delete set null,
  descripcion text not null,
  fecha date not null,
  monto numeric not null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index pasivos_tenant_idx on public.pasivos(tenant_id);

create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sede_id uuid references public.sedes(id) on delete set null,
  fecha date not null,
  categoria text not null,
  descripcion text,
  monto numeric not null,
  tipo text not null check (tipo in ('fijo','variable')),
  metodo_pago text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index gastos_tenant_idx on public.gastos(tenant_id);

create table public.gasto_marketing (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  mes date not null,
  canal text not null,
  monto numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gasto_marketing_tenant_idx on public.gasto_marketing(tenant_id);
create trigger gasto_marketing_set_updated_at before update on public.gasto_marketing
  for each row execute function public.set_updated_at();

create table public.metas_mensuales (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  mes date not null,
  tipo text not null,
  meta numeric not null,
  actualizado_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (tenant_id, mes, tipo)
);

create table public.comunicados (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  titulo text not null,
  mensaje text not null,
  audiencias text[] not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index comunicados_tenant_idx on public.comunicados(tenant_id);

create table public.comunicados_vistos (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  comunicado_id uuid not null references public.comunicados(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  visto_at timestamptz not null default now(),
  primary key (comunicado_id, user_id)
);

create table public.avisos_operativos_enviados (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  horario_id uuid not null references public.horarios(id) on delete cascade,
  fecha date not null,
  tipo text not null check (tipo in ('inicio','fin')),
  created_at timestamptz not null default now(),
  primary key (horario_id, fecha, tipo)
);

create table public.whatsapp_mensajes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  destinatario text not null,
  tipo text not null,
  estado text not null,
  error text,
  created_at timestamptz not null default now()
);
create index whatsapp_mensajes_tenant_idx on public.whatsapp_mensajes(tenant_id);

create table public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  phone text not null,
  message text,
  created_at timestamptz not null default now()
);
create index contact_submissions_tenant_idx on public.contact_submissions(tenant_id);

create table public.testimonios (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  nombre_publico text not null,
  texto text not null,
  calificacion integer not null check (calificacion between 1 and 5),
  aprobado boolean not null default false,
  created_at timestamptz not null default now()
);
create index testimonios_tenant_idx on public.testimonios(tenant_id);

create table public.encuestas_satisfaccion (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  disparador text not null,
  satisfaccion integer not null check (satisfaccion between 1 and 5),
  recomendaria boolean not null,
  comentario text,
  created_at timestamptz not null default now()
);
create index encuestas_satisfaccion_tenant_idx on public.encuestas_satisfaccion(tenant_id);

create table public.configuracion_contacto (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  whatsapp_numero text,
  facebook_url text,
  instagram_url text,
  updated_at timestamptz not null default now()
);
create trigger configuracion_contacto_set_updated_at before update on public.configuracion_contacto
  for each row execute function public.set_updated_at();

create table public.configuracion_finanzas (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  costo_variable_por_clase numeric not null default 0,
  updated_at timestamptz not null default now()
);
create trigger configuracion_finanzas_set_updated_at before update on public.configuracion_finanzas
  for each row execute function public.set_updated_at();

create table public.admin_acciones_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  actor_id uuid references auth.users(id),
  actor_nombre text,
  tabla text not null,
  operacion text not null,
  registro_id text,
  detalle jsonb,
  created_at timestamptz not null default now()
);
create index admin_acciones_log_tenant_idx on public.admin_acciones_log(tenant_id);

-- contenido_sitio: CMS del portal público, una fila por tenant. Mismo shape que Forma (82 columnas de
-- copy + banderas *_visible), sin el copy real de Forma como default — cada tenant llena el suyo.
create table public.contenido_sitio (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  hero_tagline text,
  hero_titulo_linea1 text,
  hero_titulo_marca text,
  hero_lede text,
  hero_punch text,
  hero_imagen_url text,
  filosofia_eyebrow text,
  filosofia_titulo text,
  filosofia_texto text,
  valor1_titulo text,
  valor1_texto text,
  valor2_titulo text,
  valor2_texto text,
  valor3_titulo text,
  valor3_texto text,
  valor4_titulo text,
  valor4_texto text,
  valor5_titulo text,
  valor5_texto text,
  programas_eyebrow text,
  programas_titulo text,
  programas_texto text,
  programa1_titulo text,
  programa1_texto text,
  programa1_imagen_url text,
  programa2_titulo text,
  programa2_texto text,
  programa2_imagen_url text,
  programa3_titulo text,
  programa3_texto text,
  programa3_imagen_url text,
  filosofia_visible boolean not null default true,
  programas_visible boolean not null default true,
  para_todos_visible boolean not null default true,
  logo_url text,
  signature_visible boolean not null default true,
  signature_frase text,
  agendar_eyebrow text,
  agendar_titulo text,
  agendar_texto text,
  paquetes_visible boolean not null default true,
  paquetes_eyebrow text,
  paquetes_titulo text,
  paquetes_texto text,
  paquetes_nota_titulo text,
  paquetes_nota_texto text,
  privado_visible boolean not null default true,
  privado_nombre text,
  privado_freq text,
  privado_amount text,
  privado_meta text,
  privado_cta text,
  privado_mensaje_whatsapp text,
  privado_badge text,
  privado_imagen_url text,
  ubicacion_visible boolean not null default true,
  ubicacion_eyebrow text,
  ubicacion_titulo text,
  ubicacion_texto text,
  ubicacion_lugar_nombre text,
  ubicacion_direccion_linea1 text,
  ubicacion_direccion_linea2 text,
  ubicacion_google_maps_url text,
  ubicacion_waze_url text,
  ubicacion_imagen_url text,
  proceso_visible boolean not null default true,
  proceso_eyebrow text,
  proceso_titulo text,
  paso1_titulo text,
  paso1_texto text,
  paso2_titulo text,
  paso2_texto text,
  paso3_titulo text,
  paso3_texto text,
  reviews_visible boolean not null default true,
  reviews_eyebrow text,
  reviews_titulo text,
  contacto_visible boolean not null default true,
  contacto_eyebrow text,
  contacto_titulo text,
  contacto_texto text,
  footer_tagline text,
  footer_frase_cierre text,
  updated_at timestamptz not null default now()
);
create trigger contenido_sitio_set_updated_at before update on public.contenido_sitio
  for each row execute function public.set_updated_at();

-- === RLS: habilitado en las 28 tablas, sin excepción ===
alter table public.cobros_personalizados enable row level security;
alter table public.cierre_caja enable row level security;
alter table public.productos enable row level security;
alter table public.producto_variantes enable row level security;
alter table public.carritos enable row level security;
alter table public.carrito_items enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedido_items enable row level security;
alter table public.gift_cards enable row level security;
alter table public.codigos_descuento enable row level security;
alter table public.codigos_descuento_paquetes enable row level security;
alter table public.codigos_descuento_productos enable row level security;
alter table public.activos enable row level security;
alter table public.pasivos enable row level security;
alter table public.gastos enable row level security;
alter table public.gasto_marketing enable row level security;
alter table public.metas_mensuales enable row level security;
alter table public.comunicados enable row level security;
alter table public.comunicados_vistos enable row level security;
alter table public.avisos_operativos_enviados enable row level security;
alter table public.whatsapp_mensajes enable row level security;
alter table public.contact_submissions enable row level security;
alter table public.testimonios enable row level security;
alter table public.encuestas_satisfaccion enable row level security;
alter table public.configuracion_contacto enable row level security;
alter table public.configuracion_finanzas enable row level security;
alter table public.admin_acciones_log enable row level security;
alter table public.contenido_sitio enable row level security;

-- Staff ve su tenant (recorte fino de sede/rol se afina con las RPCs, igual que en el Hito C).
create policy cobros_personalizados_select on public.cobros_personalizados for select using (tenant_id in (select public.current_tenant_ids()));
create policy cierre_caja_select on public.cierre_caja for select using (tenant_id in (select public.current_tenant_ids()));
create policy productos_select on public.productos for select using (
  tenant_id in (
    select tenant_id from public.tenant_memberships where user_id = auth.uid()
    union
    select tenant_id from public.clientes where user_id = auth.uid()
  )
);
create policy producto_variantes_select on public.producto_variantes for select using (
  producto_id in (select id from public.productos)
);
create policy carritos_propio_select on public.carritos for select using (cliente_id in (select id from public.clientes where user_id = auth.uid()));
create policy carritos_staff_select on public.carritos for select using (tenant_id in (select public.current_tenant_ids()));
create policy carrito_items_select on public.carrito_items for select using (carrito_id in (select id from public.carritos));
create policy pedidos_propio_select on public.pedidos for select using (cliente_id in (select id from public.clientes where user_id = auth.uid()));
create policy pedidos_staff_select on public.pedidos for select using (tenant_id in (select public.current_tenant_ids()));
create policy pedido_items_select on public.pedido_items for select using (pedido_id in (select id from public.pedidos));
create policy gift_cards_select on public.gift_cards for select using (tenant_id in (select public.current_tenant_ids()));
create policy codigos_descuento_select on public.codigos_descuento for select using (
  tenant_id in (
    select tenant_id from public.tenant_memberships where user_id = auth.uid()
    union
    select tenant_id from public.clientes where user_id = auth.uid()
  )
);
create policy codigos_descuento_paquetes_select on public.codigos_descuento_paquetes for select using (codigo_id in (select id from public.codigos_descuento));
create policy codigos_descuento_productos_select on public.codigos_descuento_productos for select using (codigo_id in (select id from public.codigos_descuento));
create policy activos_select on public.activos for select using (tenant_id in (select public.current_tenant_ids()));
create policy pasivos_select on public.pasivos for select using (tenant_id in (select public.current_tenant_ids()));
create policy gastos_select on public.gastos for select using (tenant_id in (select public.current_tenant_ids()));
create policy gasto_marketing_select on public.gasto_marketing for select using (tenant_id in (select public.current_tenant_ids()));
create policy metas_mensuales_select on public.metas_mensuales for select using (tenant_id in (select public.current_tenant_ids()));
create policy comunicados_select on public.comunicados for select using (
  tenant_id in (
    select tenant_id from public.tenant_memberships where user_id = auth.uid()
    union
    select tenant_id from public.clientes where user_id = auth.uid()
  )
);
create policy comunicados_vistos_select on public.comunicados_vistos for select using (user_id = auth.uid());
create policy avisos_operativos_enviados_select on public.avisos_operativos_enviados for select using (tenant_id in (select public.current_tenant_ids()));
create policy whatsapp_mensajes_select on public.whatsapp_mensajes for select using (tenant_id in (select public.current_tenant_ids()));
create policy contact_submissions_select on public.contact_submissions for select using (tenant_id in (select public.current_tenant_ids()));
-- Sin política "pública" por aprobado=true a propósito: eso filtraría por aprobado pero NO por tenant,
-- dejando ver testimonios aprobados de otros tenants a cualquier usuario autenticado. Mostrar
-- testimonios en el sitio público de un tenant se hace con una RPC dedicada que recibe el tenant_id
-- explícito (como resolver_tenant_por_dominio), no con una política de RLS abierta.
create policy testimonios_staff_select on public.testimonios for select using (tenant_id in (select public.current_tenant_ids()));
create policy encuestas_satisfaccion_select on public.encuestas_satisfaccion for select using (tenant_id in (select public.current_tenant_ids()));
create policy configuracion_contacto_select on public.configuracion_contacto for select using (
  tenant_id in (
    select tenant_id from public.tenant_memberships where user_id = auth.uid()
    union
    select tenant_id from public.clientes where user_id = auth.uid()
  )
);
create policy configuracion_finanzas_select on public.configuracion_finanzas for select using (tenant_id in (select public.current_tenant_ids()));
create policy admin_acciones_log_select on public.admin_acciones_log for select using (tenant_id in (select public.current_tenant_ids()));
-- Sin política pública para contenido_sitio (mismo problema que testimonios: `using (true)` expondría
-- el contenido de TODOS los tenants a cualquiera). El sitio público de cada tenant se sirve con una
-- RPC dedicada (`contenido_sitio_publico(p_tenant_id)`, a construir con el portal — sección 11 del
-- maestro), nunca con una política de RLS abierta sobre la tabla completa.
create policy contenido_sitio_staff_select on public.contenido_sitio for select using (tenant_id in (select public.current_tenant_ids()));

-- GRANT junto con RLS: SELECT solo para authenticated en todo lo del módulo resto. Ningún grant a
-- `anon` en esta migración — el acceso público (catálogo, contenido del sitio, testimonios) se sirve
-- vía RPCs tenant-scoped cuando se construya el portal (Hito D), no abriendo tablas completas.
grant select on public.cobros_personalizados, public.cierre_caja, public.productos, public.producto_variantes,
  public.carritos, public.carrito_items, public.pedidos, public.pedido_items, public.gift_cards,
  public.codigos_descuento, public.codigos_descuento_paquetes, public.codigos_descuento_productos,
  public.activos, public.pasivos, public.gastos, public.gasto_marketing, public.metas_mensuales,
  public.comunicados, public.comunicados_vistos, public.avisos_operativos_enviados, public.whatsapp_mensajes,
  public.contact_submissions, public.testimonios, public.encuestas_satisfaccion,
  public.configuracion_contacto, public.configuracion_finanzas, public.admin_acciones_log, public.contenido_sitio
  to authenticated;

revoke all on public.cobros_personalizados, public.cierre_caja, public.productos, public.producto_variantes,
  public.carritos, public.carrito_items, public.pedidos, public.pedido_items, public.gift_cards,
  public.codigos_descuento, public.codigos_descuento_paquetes, public.codigos_descuento_productos,
  public.activos, public.pasivos, public.gastos, public.gasto_marketing, public.metas_mensuales,
  public.comunicados, public.comunicados_vistos, public.avisos_operativos_enviados, public.whatsapp_mensajes,
  public.contact_submissions, public.testimonios, public.encuestas_satisfaccion,
  public.configuracion_contacto, public.configuracion_finanzas, public.admin_acciones_log, public.contenido_sitio
  from anon;
