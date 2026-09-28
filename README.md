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
- [ ] **Las 63 RPCs de negocio (reservar, cancelar, congelar membresía, check-in, lista de espera, etc.)
  — deliberadamente NO están en la migración de tablas.** La auditoría de funciones del Hito A solo
  capturó firmas (`auditoria/raw/04_funciones.json`), no el cuerpo real (`prosrc`) de cada función —
  hay que leer el cuerpo real de Forma función por función antes de portar la lógica, para no
  reinventarla mal (ej. la regla exacta de cuándo se descuenta un crédito). Es la siguiente pieza,
  intencionalmente separada.
- [ ] INSERT/UPDATE/DELETE en las 19 tablas siguen sin política — Postgres los deniega por defecto hoy;
  cada política de escritura se agrega junto con la RPC que la necesita, no antes
- [ ] Poblar `role_permissions` con la matriz real de la sección 12 del maestro — se hace junto con el
  servicio de autorización, no antes (regla 5 del maestro: no dar nada por hecho sin verificar)

Los mismos dos tenants ficticios y usuarios de prueba del Hito B ahora tienen también un paquete, un
horario, una clienta y una reserva cada uno — quedan como fixture para probar las RPCs del Hito C.
