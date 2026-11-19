# ReserveOS — Estado y continuación (guardado el 13 de octubre de 2026)

Documento para retomar sin empezar de cero. Pégalo o pide «lee ~/Desktop/ReserveOS_Continuacion.md y continúa».
**No contiene tokens ni contraseñas reales.** Los tokens que se pegaron en el chat (GitHub y Supabase) deben **borrarse** cuando termines; para trabajar hay que pasarle uno nuevo a Claude.

---

## 1. Qué es y reglas de trabajo

- **ReserveOS**: SaaS multi-tenant para estudios/gimnasios (reservas, paquetes, caja, finanzas, portal de la clienta) + consola de **owner** de ReserveOS (ventas, contratos, cobros, soporte). Primer cliente de prueba: «VIM» (3 sedes).
- Repo: `~/Desktop/ReserveOS` (GitHub `andreslale1/ReserveOS`, rama `main`, privado). App Next.js 16 en `web/`. Supabase proyecto `agkqppuhyltirrhngybq` (hoy es **staging/pruebas**, no hay base de producción separada). Vercel proyecto `reserveos`, dominio `reserveos.app`.
- **Último commit desplegado**: `f0e3c21` (13 oct). Vercel ya usa **Root Directory = `web`**: desplegar con `vercel deploy --prod --yes` **desde la raíz del repo** (no desde `web/`). El despliegue automático por push a GitHub ya funciona.
- Reglas del usuario (Andrés, no es desarrollador, directo y conciso, en español, sin resúmenes largos):
  - Trabajar **solo en ReserveOS** (nunca tocar Forma Pilates ni CRM Municipal).
  - **No conectar terceros** (pasarela, WhatsApp, correo, push, FEL). Todo se «encola», no se envía.
  - Nunca decir «UTC» al usuario: hablar en hora de Guatemala.
  - Un solo deploy al final de cada tanda; avisar antes de acciones irreversibles.
  - No tocar la configuración de **Auth** de Supabase sin su autorización explícita (el sistema bloqueó un intento): `site_url` sigue en `http://localhost:3000` y eso rompe la recuperación de contraseña en producción. Pendiente de su permiso: cambiar solo `site_url`, `uri_allow_list` y longitud mínima de contraseña. No tocar SMTP.
  - Usar el skill `impeccable` solo para diseño de frontend.

## 2. Cómo verificar (siempre antes de desplegar)

```
cd ~/Desktop/ReserveOS
SUPABASE_ACCESS_TOKEN=<token nuevo> npm run verificar     # siembra fixtures, corre ~277 pruebas por API + escenarios, guarda tests/RESULTADOS.md
cd web && npx tsc --noEmit && npm run build
```
- Último resultado: **277/277 pruebas y todos los escenarios pasan**; 106 migraciones locales = desplegadas.
- Las pruebas guardan sesiones 50 min en `/tmp/reserveos-test-tokens.json` y reintentan ante el límite de peticiones de Supabase (el script limpia ese caché al iniciar). Correr con `--no-file-parallelism`.
- Si fallan cosas raras: casi siempre es **basura de una corrida interrumpida** (usuarios `tmp*`, clientas `TMP/ZZ`, tickets `TMP`) o **límite de peticiones**; limpiar y repetir. Escenarios con fecha fija deben usar fechas lejanas (el cron real ya procesa «hoy»).
- Migraciones: se aplican por la API de gestión de Supabase (`/v1/projects/{ref}/database/query`) y se registran a mano en `supabase_migrations.schema_migrations` (no usar `db push`). La superficie anónima permitida son **7 funciones**; toda función nueva debe quedar cerrada a `anon`.

## 3. Cuentas de PRUEBA (estudio ficticio «VIM Prueba», 3 sedes: Centro, Norte, Sur)

Contraseña de todas: `FixtureVIM2026!` · entrar en https://reserveos.app/login

| Rol | Correo |
|---|---|
| Dueña | duena@vim-prueba.test |
| Gerente regional (Centro+Norte) | regional@vim-prueba.test |
| Admin de sede Centro / Norte | admin1@ / admin2@vim-prueba.test |
| Recepción Centro / Sur | recep1@ / recep3@vim-prueba.test |
| Instructora Centro+Norte / Sur | instr12@ / instr3@vim-prueba.test |
| Contadora | contadora@vim-prueba.test |
| Marketing | marketing@vim-prueba.test |
| Clienta Centro / Norte | cli1@ / cli2@vim-prueba.test |
| Dueña de estudio de 1 sede / su recepción | duena-una@ / recep-una@vim-prueba.test |
| Persona en dos estudios | multi@vim-prueba.test |
| **Owner de ReserveOS** | la cuenta de operador de Andrés |

Otros estudios de prueba: `unasede-prueba` (1 sede) y `ficticio-b` (ajeno, para aislamiento).
Para revisar pantallas localmente: `cd web && npm run dev`; usar hosts distintos por rol (`recep.localhost:3000`, `instr.localhost:3000`, `127.0.0.1`, `[::1]`) para tener sesiones separadas. En el login automatizado a veces hay que pulsar Enter dos veces.

## 4. Qué se hizo (resumen por bloques)

1. **Permisos sobre datos reales** (lectura por rol y sede en la base, roster mínimo de instructora, jerarquía de invitaciones y asignación de sedes, instructora asignada al horario, cobertura de paquetes por sede con créditos devueltos a la membresía exacta, ingresos netos por sede conciliados, elección de estudio para personal en varios estudios). Probado con sesiones reales por rol.
2. **Consola owner** (auditorías 1 y 2): estados reales de estudio (borrador/pausado/suspendido… con bloqueo en BD), privacidad de la ficha (acceso excepcional con ticket y caducidad), estudios demo aparte, planes (Q0 = borrador, no vendibles), contratos con estados, alta guiada y reanudable, prospecto atómico (`prospecto_crear`), vínculos coherentes, etapas con evidencia, navegación lateral agrupada + búsqueda + cerrar sesión, Dirección filtrada **por rol** (ventas/finanzas/soporte), botones deshabilitados si no es operador, matriz de 8 roles probada, equipo con invitaciones, auditoría con filtros/CSV, salud honesta, dominios con verificación DNS/HTTPS real. Fechas aceptan `08102026`, `8/10/26`, etc.
3. **Funciones de Forma Pilates replicadas**: 15 automatizaciones (pg_cron, hora de cada sede, solo encolan), salud diaria por estudio, historial de reservas, clases por instructora con sustituciones, clases privadas 1 a 1, reto mensual, centro de mando y finanzas (IVA, balance), exportes, ficha de clienta completa, página pública `/e/{slug}` con paquetes y contacto, clase de prueba que crea cuenta, «olvidé mi contraseña», gift cards y referidos.
4. **Panel del estudio (13 oct)**: pantalla **Cobrar** para recepción (`/panel/cobrar`, usa `agregar_membresia_manual`), Día/Semana/Mes funcionales en Hoy, menú agrupado + **Cerrar sesión**, encabezados alineados, jerarquía estricta (admin de sede solo crea/ve recepción e instructoras de sus sedes; regional, además, administradoras; contadora/marketing/gerentes solo la dueña).
5. **Portal de la clienta**: estaba ilegible (blanco sobre blanco por el tema oscuro). Corregido en 15 archivos. El usuario lo siente «confuso»: falta rediseñar el flujo (preguntar qué parte: inicio, reservar o paquetes).
6. Infraestructura: Vercel Root Directory = `web`; `.vercel` ignorado en la raíz.

## 5. Pendiente, en el orden recomendado

1. **Marca por estudio (white-label)**. Hoy solo se guardan logo y color por estudio y **solo se usan en la página pública**; panel, portal y login siempre se ven con la marca ReserveOS (negro y lima). Plan: aplicar por estudio logo, colores (fondo, tarjetas, texto, acento), claro/oscuro y tipografía en panel, portal, login y correos; «ReserveOS» solo en letra chica. Los colores salen de pocos tokens en `web/app/globals.css` (`--color-void`, `--color-void-card`, `--color-ink`, `--color-lime`…), así que es inyectar variables por tenant en los layouts. **Decisión del usuario pendiente**: ¿la marca propia va en todos los planes o es un extra de pago? (la pregunta vino de que Dynamic Fitness querría su manual de marca).
2. **Simplificar**: inicio y menú del owner (15 secciones, todo en Q0), inicio útil por rol («qué hago hoy»), rediseñar el flujo del portal de la clienta.
3. **Registro autónomo**: `/registro` da 404 (el agente se cortó antes de crearlo). Falta además el formulario directo de «Nueva reserva» desde Hoy (hoy lleva al calendario).
4. Alta de estudio manual en la consola aún usa el camino antiguo de 2 pasos (`crearEstudio`); existe la RPC atómica `alta_estudio_manual`, falta conectarla. Falta enlace «olvidé mi contraseña» verificado de punta a punta y activación real de Auth (ver §1).
5. Brechas de producto sin cubrir: gerente regional y admin de sede no se revisaron visualmente; verificación real de dominio contra Vercel; cambio de plan versionado; pruebas de interfaz en navegador; base de **producción** separada; documentos legales.
6. **Fuera de alcance por decisión del usuario**: app nativa (iOS/Android) y asistente de IA.
7. Pasarela real, correo/WhatsApp/push reales: no conectar (decisión del usuario).
8. Funciones inferidas por agentes a revisar con el usuario: la regla del aviso «horario fijo» (3 de las últimas 4 semanas al mismo horario sin reservar la siguiente).

## 6. Datos útiles para retomar

- Mapa de menús por rol: `web/lib/panel-context.ts` (`NAV_POR_ROL`, `RUTA_MODULO`); menú del panel agrupado en `web/app/panel/layout.tsx`; menú del owner en `web/components/owner/nav-config.ts`.
- Guía de recorrido por rol (ciclo comercial en 11 pasos): `~/Desktop/ReserveOS_Recorrido_por_Rol.md`. Arquitectura: `ARQUITECTURA.md` (copia en el escritorio). Resultados de pruebas: `tests/RESULTADOS.md`.
- Matriz ruta→RPC→rol del owner: `tests/owner_matriz_roles.test.ts`. Pruebas del cobro en recepción: final de `tests/matriz_operaciones.test.ts`.
- Archivo local **nunca commitear**: `aplicar-migraciones.sh`.
- Errores conocidos de entorno: límite de peticiones de Supabase Auth/gestión (los agentes en paralelo lo agotan: **no correr varios agentes con pruebas a la vez**), límite de sesión del modelo cortó a 3 agentes en una ocasión.

## 7. Cómo retomar en una línea

> «Lee ~/Desktop/ReserveOS_Continuacion.md. Token de Supabase: <nuevo>. Empieza con la marca por estudio (todos los planes / extra de pago: <decisión>).»
