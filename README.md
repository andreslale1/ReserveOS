# ReserveOS

Repo separado para la plataforma multi-tenant (VIM Pilates es el primer tenant). **No toca el repo,
base de datos ni despliegue de Forma Pilates** (`~/Desktop/Forma Pilates/Frontend`) — ver Regla 1 y 2
del documento maestro.

Fuente de verdad de producto/arquitectura: `~/Desktop/MAESTRO_Forma_SaaS_Instrucciones_Desarrollo.md`

## Estado — Hito A (auditoría y oferta)

- [x] Inventario estático de tablas desde `migrations/*.sql` de Forma real → `auditoria/01_inventario_estatico_tablas.md`
- [x] Cruce contra el inventario del documento técnico (46 tablas, coinciden 1:1 salvo `cierres_caja_pos` ya eliminada)
- [x] Dump del esquema real (`information_schema` + `pg_policies`) → `auditoria/02_esquema_real_rls_grants.md` (hecho vía API de administración de Supabase, **sin** `supabase login` — ver nota operativa en ese archivo sobre el cruce de tokens)
- [x] Reconciliar RLS + GRANT reales contra lo documentado → mismo archivo: 0 huecos de GRANT, 0 políticas con recursión activa hoy
- [x] Marcar tablas/RPCs necesarias para el núcleo del Hito C vs. el resto → `auditoria/03_nucleo_hito_c_vs_resto.md` (18 tablas núcleo + 63 RPCs núcleo, 28 tablas + 122 RPCs quedan como módulos "resto")
- [x] Proyecto de Supabase nuevo (staging) para ReserveOS → org "ReserveOS" en Supabase, proyecto `agkqppuhyltirrhngybq` (`https://agkqppuhyltirrhngybq.supabase.co`, us-east-1), 100% separado de Forma
- [ ] Entrevista VIM, precio, app y pagos pactados (cierra Hito A) — decisión de negocio de Andrés, no técnica

## Estado — Hito B (fundación multi-tenant) — arrancado

- [x] Esquema base aplicado en el proyecto nuevo: `tenants`, `tenant_domains`, `sedes`, `tenant_memberships`,
  `staff_sedes`, `module_catalog`, `tenant_entitlements`, `tenant_module_settings`, `role_permissions`
  → `supabase/migrations/20260928191452_hito_b_fundacion_multitenant.sql`
- [x] RLS habilitado en las 9 tablas (mismo estándar que Forma real: 100% de cobertura), aislamiento por
  tenant vía función `security definer` `current_tenant_ids()` — sin autorreferencia recursiva (ver
  `auditoria/02_esquema_real_rls_grants.md` §3, el patrón que tumbó Forma el 27-sept)
- [x] GRANT junto con RLS en cada tabla (regla 6 del maestro); políticas de INSERT/UPDATE/DELETE quedan
  para el Hito C junto con los flujos reales que las ejercitan — hoy Postgres las deniega por defecto
- [x] Catálogo de 26 módulos sembrado (`supabase/seed.sql`), sección 5 del maestro
- [x] **Condición de salida del Hito B cumplida:** dos tenants ficticios (`ficticio-a` con 3 sedes,
  `ficticio-b` con 1 sede) + dos usuarios reales de Auth, cada uno con membresía a un solo tenant.
  Probado **por la API pública real** (REST + JWT de cada usuario, no por SQL directo como superusuario):
  cada usuario solo ve su propio tenant, sus propias sedes y su propia membresía — 0 filas del otro
  tenant en ningún endpoint. `anon` sin sesión recibe `42501 permission denied`, no una lista vacía.
- [x] **Hallazgo corregido:** Supabase otorga por defecto a `anon` todos los privilegios de tabla
  (no solo lectura) en tablas nuevas del esquema `public`. RLS ya bloqueaba cualquier fuga real, pero el
  GRANT quedaba más ancho de lo decidido — revocado y dejado exacto en
  `supabase/migrations/20260928192500_revoca_grants_anon_por_defecto.sql`. Repetir esta verificación
  (`information_schema.role_table_grants` para `anon`) en cada tabla nueva del Hito C.

**Conexión:** keys en `.env.local` (fuera de git). `supabase/config.toml` ya apunta a este proyecto
(`project_id = "ReserveOS"`), pero el link real vía CLI (`supabase link`) sigue bloqueado por el cruce de
`SUPABASE_ACCESS_TOKEN` entre proyectos de Andrés — todo lo de arriba se aplicó vía la API de
administración de Supabase (`/v1/projects/{ref}/database/query`), no vía `supabase db push`. Se dejaron
filas en `supabase_migrations.schema_migrations` (versiones `20260928191452` y `20260928192500`) para
que un futuro `supabase link` + `db push` no intente reaplicar estas migraciones.

Los dos tenants ficticios y sus dos usuarios de prueba (`usera@test.reserveos.local`,
`userb@test.reserveos.local`) se dejan vivos en staging como fixture reutilizable para las pruebas del
Hito C — son datos 100% sintéticos, no hay nada real de VIM ni de Forma aquí.

## Estado — Backend completo (núcleo + módulo "resto") — 2026-09-28

**Las 63 RPCs núcleo + las 122 del módulo "resto" están todas portadas.** 56 tablas (100% con RLS),
189 funciones, cero privilegios de `anon` en cualquier tabla — verificado por consulta directa, no
supuesto. Todo el trabajo del módulo "resto" (tienda, descuentos, finanzas avanzadas, marketing/CRM,
caja/POS, CMS del sitio, auditoría) vive en migraciones separadas de las del núcleo:

- `20260928211413_resto_tablas.sql` — 28 tablas (tienda, descuentos, finanzas avanzadas, comunicación,
  CMS, encuestas, config secundaria, auditoría). `contenido_sitio`/`configuracion_contacto`/
  `configuracion_finanzas` pasan de singleton (patrón real de Forma) a una fila por tenant.
  **Hallazgo de seguridad real, no solo sintaxis:** las políticas iniciales de `testimonios` y
  `contenido_sitio` (`using (true)` / filtro sin tenant) habrían expuesto datos de todos los tenants a
  cualquier autenticado — corregido antes de dar el batch por bueno.
- `20260928212026_resto_rpc_identidad_dependientes.sql` — `registrar_clienta`, dependientes,
  consentimiento, bono de referido (deberían haber sido núcleo; el filtro por palabra clave del Hito A
  las dejó fuera).
- `20260928212214_resto_rpc_reservas_extendido.sql` — `agendar_clase` (el autoservicio real de
  reservar, otra que debió ser núcleo), clases de prueba, clases privadas, disponibilidad pública.
  Elimina las fechas de apertura hardcodeadas de Forma (eran de un solo lanzamiento).
- `20260928212432_resto_rpc_descuentos.sql`, `20260928212600_resto_rpc_tienda.sql`,
  `20260928212848_resto_rpc_caja.sql`, `20260928212943_resto_rpc_finanzas_kpis.sql`,
  `20260928213101_resto_rpc_marketing_crm.sql`, `20260928213318_resto_rpc_misc_auditoria.sql`,
  `20260928213512_resto_rpc_ultimas_pendientes.sql` — códigos de descuento, carrito/checkout/pedidos/
  ventas presenciales/gift cards, caja diaria por sede, KPIs financieros, KPIs de marketing/CRM y listas
  de seguimiento, testimonios/encuestas/auditoría admin, y las 5 funciones núcleo que habían quedado
  diferidas por depender de tablas de "resto" que ya existen.
- **`rls_auto_enable`**: event trigger que auto-habilita RLS en cualquier tabla nueva de `public` —
  verificado en vivo creando una tabla de prueba real, no solo leído del código.
- Se agregaron durante el camino varias columnas que se habían omitido al principio (bookkeeping de
  notificaciones en `reservas`/`membresias`/`clientes`, `codigo_descuento_id` en tres tablas) —
  documentado como omisión real corregida, no como plan.

**Simplificaciones deliberadas que siguen en pie:** sin integración real de pasarela de pago (las
funciones esperan que el backend externo llame `confirmar_pago_transaccion`/`confirmar_transaccion_carrito`
vía `service_role`, la integración con Recurrente en sí no está construida); `registrar_venta_presencial`
ya no tiene un cliente "mostrador" mágico — `p_cliente_id` es obligatorio; `registrar_accion_admin` se
adjuntó a 5 tablas de dinero como default razonable (Forma no permitía confirmar a cuáles estaba atado).

## Estado — Hito C (núcleo funcional) — capa de tablas lista, RPCs pendientes

- [x] Las 18 tablas núcleo + 2 tablas puente (`paquete_sedes`, `membresia_sedes` — cobertura de sedes de
  paquetes/membresías, sección 7 del maestro) portadas con columnas reales de Forma (consultadas en vivo,
  no adivinadas) → `supabase/migrations/20260928204012_hito_c_nucleo_tablas.sql`
- [x] `perfiles` de Forma se absorbió en `tenant_memberships` (ya existía desde el Hito B) en vez de
  crear una tabla redundante — decisión de diseño explícita, documentada en el comentario de cabecera
  de la migración
- [x] RLS habilitado en las 19 tablas nuevas (staff por tenant vía `current_tenant_ids()`, clienta por
  propiedad directa `user_id = auth.uid()` — las clientas no tienen fila en `tenant_memberships`)
- [x] GRANT solo `SELECT` para `authenticated`, cero privilegios para `anon` (repetido el chequeo del
  hallazgo del Hito B en cada tabla nueva — sigue limpio)
- [x] **Aislamiento verificado con datos reales**, no solo con las tablas vacías del Hito B: paquete +
  horario + cliente + reserva insertados para los dos tenants ficticios, consultado por la API pública
  real con el JWT de cada usuario de prueba — cada uno ve exactamente sus propias filas en `clientes`,
  `horarios`, `reservas` y `paquetes`, cero fuga
- [x] **58 de las 63 RPCs de negocio portadas**, leyendo el cuerpo real de cada una en la base viva de
  Forma (`auditoria/raw/rpc_bodies/*.sql`, `pg_get_functiondef`) — no reinventadas de memoria:
  - `supabase/migrations/20260928205747_hito_c_rpc_reservas_lista_espera.sql` — reservar, cancelar,
    confirmar, check-in (simple y múltiple), lista de espera completa, triggers
    `bloquear_reserva_clase_empezada` y `promover_lista_espera`
  - `supabase/migrations/20260928210113_hito_c_rpc_membresias.sql` — solicitar/confirmar/rechazar/
    eliminar/congelar/descongelar/transferir membresía, editar cobro, privatizar fecha + confirmar su
    pago, confirmar pago de transacción de pasarela
  - `supabase/migrations/20260928210612_hito_c_rpc_reportes_cron.sql` — 17 reportes/dashboards de staff
    (KPIs, cobros pendientes, resumen de clientas) + 6 funciones de cron/notificación (`service_role`
    únicamente, nunca `authenticated`) + anular/eliminar cobro
- [x] **Patrón de seguridad aplicado en las 58:** el tenant nunca se recibe como parámetro del cliente,
  siempre se deriva del recurso (horario/reserva/membresía) o de la fila propia de `clientes`, y se
  valida contra `tenant_memberships` antes de tocar cualquier fila — helpers reutilizables
  `staff_puede_en_sede()` (roles con alcance de sede), `tengo_rol_en_tenant()` (dueña/gerente_general/
  contadora, sin sede), `mi_cliente_id()`, `membresia_cubre_sede()`
- [x] Guatemala UTC-6 hardcodeado reemplazado por `ahora_en_sede()`/`hoy_en_sede()` en las 58 (leen
  `sedes.timezone` — cada sede su propia zona, no una global)
- [x] **Verificado con datos reales, no solo revisión de código:** dueña asigna y congela una membresía
  de su clienta; confirma/cancela reservas propias; cross-tenant probado en 6+ casos distintos (cancelar
  reserva ajena, unirse a lista de espera ajena, congelar membresía ajena, listar clientas/KPIs del otro
  tenant) — todos bloqueados o vacíos, cero fuga
- [x] **Las 5 funciones que quedaban diferidas ya se conectaron** (ver sección "Backend completo" arriba)
  una vez que el módulo "resto" existió.
- [ ] INSERT/UPDATE/DELETE directo en las 19 tablas del Hito C sigue sin GRANT — todo pasa por RPC a
  propósito (matches el patrón real de Forma), correcto y verificado, no pendiente
- [ ] Poblar `role_permissions` con la matriz real de la sección 12 del maestro — se hace junto con el
  servicio de autorización del frontend, no antes (regla 5 del maestro: no dar nada por hecho sin verificar)

Los mismos dos tenants ficticios y usuarios de prueba del Hito B ahora tienen también un paquete
(con cobertura de sede vía `paquete_sedes`), un horario, una clienta y una membresía cada uno — quedan
como fixture para probar el frontend y el resto de módulos.
