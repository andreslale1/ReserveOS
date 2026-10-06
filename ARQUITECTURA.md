# ReserveOS — Arquitectura completa (6 oct 2026)

Plataforma SaaS multi-tenant para estudios y gimnasios: reservas, paquetes, caja, finanzas, tienda, comunicaciones y facturación,
más la consola con la que ReserveOS (la empresa) vende, activa, cobra y da soporte a sus clientes. Cada estudio es un "tenant"
aislado. Forma Pilates y CRM Municipal son proyectos independientes: **este repositorio nunca los toca**.

Cifras reales de la base (consultadas el 6 oct): **96 tablas (100% con RLS) · 383 funciones · 99 políticas · 3 tareas automáticas ·
196 permisos de la matriz · 26 módulos vendibles · 73 migraciones**. Frontend: **66 páginas, ~13,300 líneas de TypeScript**.

---

## 1. Vista general

```
                        reserveos.app  (Vercel, proyecto "reserveos")  +  dominios propios por estudio
 ┌───────────────────────────────────────────────────────────────────────────────────────────────┐
 │  Next.js 16 · React 19 · Tailwind 4   (carpeta web/)                                          │
 │                                                                                               │
 │  PÚBLICO     /  /contacto  /e/[slug]  /login  /invitar/*  /elegir-estudio  /api/pagos/*       │
 │  CLIENTA     /cuenta  (inicio · clases · tienda · paquetes · historial · perfil)  — app PWA    │
 │  ESTUDIO     /panel/*  (≈40 pantallas según rol y módulos contratados)                        │
 │  REServeOS   /owner/*  (dirección · CRM · cobros · soporte · salud · equipo · auditoría…)     │
 └──────────────────────────────────────┬────────────────────────────────────────────────────────┘
                                        │  @supabase/ssr · cookie de sesión · JWT
                                        ▼
 ┌───────────────────────────────────────────────────────────────────────────────────────────────┐
 │  Supabase (agkqppuhyltirrhngybq, us-east-1)  Auth · Postgres · pg_cron · Storage · Vault      │
 └───────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Principios** (todos verificados con pruebas, no solo escritos):

1. **La web casi nunca escribe en tablas**: toda acción es una función (RPC) que valida rol, sede y módulo adentro. El tenant nunca lo manda el navegador.
2. **El anónimo solo puede ejecutar 7 funciones** (página pública, captación, dominio, invitaciones, testimonios, webhook de pagos). Cualquier función nueva **nace cerrada** (disparador de eventos).
3. **Los módulos contratados se hacen cumplir en la base**: una tabla de un módulo apagado rechaza escrituras y oculta lecturas, venga de donde venga.
4. **La matriz de permisos es ejecutable**: `role_permissions` + `_exigir_accion()` aplicada en 19 funciones sensibles, con delegaciones reales.
5. **Concurrencia**: cupo de clase serializado por candado, créditos acotados por restricción, canje de gift card atómico.
6. **Dinero**: cada cobro se atribuye a la sede donde se hace y se cuenta una sola vez; eventos de pago firmados e idempotentes.

---

## 2. Estructura del repositorio

```
ReserveOS/
├── ARQUITECTURA.md · README.md · GUION_PRUEBAS.md      documentación (el guion es para que pruebes sin código)
├── package.json            npm test  ·  npm run test:escenarios
├── supabase/migrations/    73 archivos SQL (la historia completa del esquema)
├── tests/
│   ├── aislamiento_*.test.ts, superficie_funciones.test.ts     Vitest: 45 pruebas de seguridad
│   └── escenarios/         15 escenarios SQL de punta a punta + 2 de concurrencia + lista blanca + limpieza
├── auditoria/              material de la auditoría de Forma (cuerpos reales de RPCs, RLS, grants)
└── web/
    ├── proxy.ts            sesión + resolución del estudio por dominio verificado
    ├── lib/                supabase/{client,server,middleware} · panel-context (roles, módulos, menú) · owner-context · cuenta-context
    ├── components/         landing pública
    └── app/                rutas (sección 4). Patrón por módulo: page.tsx (datos + rol) → *-view.tsx (pantalla) → actions.ts (RPC)
```

---

## 3. Base de datos

### 3.1 Dominios de tablas (96)
| Dominio | Qué contiene |
|---|---|
| Multi-tenant y accesos | tenants, tenant_domains, sedes, tenant_memberships, staff_sedes, module_catalog, tenant_entitlements, tenant_module_settings, role_permissions, **delegaciones** |
| Clientas | clientes (con código QR de check-in), invitaciones, **comunicacion_preferencias** |
| Agenda | horarios (+ sala), horario_cancelaciones, fechas privadas, **salas**, **sede_cierres** (feriados) |
| Reservas | reservas, lista_espera (+ notificaciones) |
| Paquetes y membresías | paquetes, paquete_sedes, membresias (+ sedes), cobros_personalizados |
| Pagos | pago_transacciones, **pago_eventos** (idempotencia), **reembolsos**, configuracion_pago, cierre_caja |
| Tienda | productos, producto_variantes, carritos, pedidos (+ items), gift_cards (con vencimiento), **movimientos_inventario** |
| Finanzas | gastos, activos, pasivos, metas, configuracion_finanzas |
| Facturación del estudio | **configuracion_fiscal**, **documentos_fiscales** |
| Comunicaciones | **plantillas_mensaje, segmentos, campanas_estudio, cola_mensajes**, comunicados, whatsapp_mensajes |
| Soporte | **plataforma_tickets, plataforma_ticket_mensajes, plataforma_incidentes** |
| Plataforma (ReserveOS) | plataforma_staff (8 roles), **plataforma_empresas/contactos/leads (oportunidades)/actividades/tareas/proyectos**, **plataforma_campanas, propuestas, contratos**, plataforma_suscripciones, plataforma_cobros, **plataforma_pagos, plataforma_costos, plataforma_planes**, plataforma_exclusiones, plataforma_captaciones |
| Auditoría y errores | admin_acciones_log (también registra la plataforma), error_logs |
| Integraciones (solo esquema) | integracion_pagos / whatsapp / email / push / fel — secretos en Vault |

### 3.2 Seguridad
- RLS en las 96 tablas; `anon` sin privilegios de tabla.
- Aislamiento por `current_tenant_ids()` / `tengo_rol_en_tenant()` / `staff_puede_en_sede()` (con la gerencia regional tratada como admin de varias sedes).
- Tablas de plataforma sin políticas: solo accesibles por RPC con rol interno (operador, ventas, finanzas, soporte, implementación, ingeniería, marketing, auditor).
- **Hallazgo corregido el 6 oct**: 334 funciones eran ejecutables sin cuenta (algunas activaban paquetes sin pagar). Ahora: lista blanca de 7 + disparador que cierra las nuevas + pruebas permanentes.

### 3.3 Tareas automáticas (pg_cron)
`liberar_cupos_no_confirmados` (10 min) · `lista_espera_vencida` (15 min) · `encolar_recordatorios` (diario: paquetes que vencen en 3 días).

---

## 4. Frontend — rutas

### Pública
`/` landing · `/contacto` (captación: crea empresa, contacto, oportunidad y tarea) · `/e/[slug]` página del estudio con horarios · `/login` · `/invitar/*` · `/elegir-estudio` · `POST /api/pagos/[slug]/[proveedor]` (webhook firmado) · `/manifest.webmanifest`, `/pwa-icon/*`, `/sw.js` (app instalable)

### Clienta `/cuenta` (móvil primero, instalable)
Inicio (saldo, próximas, check-in, **QR**) · Clases (explica por qué no puede reservar; lista de espera; para dependientes) · Tienda · Paquetes (comprar por transferencia, canjear gift card) · Historial (clases, compras, **solicitar reembolso**) · Perfil (datos, familia, consentimiento, preferencias de mensajes). Una identidad, varios estudios: se elige el contexto de forma explícita; en un dominio propio lo fija el host verificado.

### Estudio `/panel` (el menú depende del rol **y** de los módulos contratados)
Hoy · Calendario · Clase (asistencia, espera, cupo, sala, cancelar fecha) · **Check-in** · Clientas (+ ficha completa, importar CSV, exportar) · Pagos pendientes · **Pagos y reembolsos** · Paquetes · Caja · Tienda · **Productos e inventario** · **Gift cards** · Descuentos · Finanzas (con **ingresos por sede**) · Gastos y balance · **Facturación** · Negocio · Reportes · Seguimiento · **Campañas** · Personal · Agenda del personal · Sedes · **Salas** · **Feriados y cierres** · Configuración (marca, **reglas de reserva**, dominio, pagos en línea) · **Delegaciones** · Mi suscripción · **Soporte** · Auditoría · Automatizaciones

### ReserveOS `/owner` (según rol interno)
**Dirección** · **Pipeline** (+ ficha de oportunidad con contactos, historial, tareas, **propuestas versionadas**) · **Tareas** · **Activaciones** (lista de salida a producción) · Estudios (+ plan y módulos por estudio) · **Planes** · **Contratos** · **Marketing** (campañas con atribución) · Cobros (pagos parciales, setup, mora) · **Rentabilidad** · **Soporte** (tickets, incidentes) · **Salud** · **Dominios** · **Equipo** · **Auditoría**

### Roles
Estudio: dueña, gerente general, **gerencia regional**, admin de sede, recepción, instructora, contadora, **marketing**, clienta.
ReserveOS: operador, ventas, finanzas, soporte, implementación, ingeniería, marketing, auditor.

---

## 5. Flujos de dinero y datos
1. **Venta**: ficha → `agregar_membresia_manual` → ingreso de la sede, entra a caja; se puede facturar una sola vez.
2. **Pago en línea**: proveedor → `pago_webhook` (firma HMAC con secreto del estudio en Vault, anti-repetición, verificación de monto) → activa una sola vez.
3. **Reembolso**: la clienta o el personal lo piden → solo quien tiene P31 (o delegación) aprueba → se anula la compra, su factura queda "por anular" → se marca cuándo se devolvió el dinero.
4. **Mensajes**: avisos de reserva y de paquete por vencer salen solos; las promociones solo con consentimiento; todo pasa por una cola con reintentos.
5. **Cobro a estudios**: suscripción → generar cobros del mes (idempotente) → pagos parciales → mora → suspensión; rentabilidad = cobrado − costos.

---

## 6. Despliegue y pruebas
- **Hosting**: Vercel (`reserveos`), dominios `reserveos.app` y `www`. Deploy: `cd web && vercel deploy --prod`.
- **Base**: Supabase (única, hoy staging y producción). `supabase db push --linked` con `SUPABASE_ACCESS_TOKEN` de la organización ReserveOS.
- **Código**: GitHub `andreslale1/ReserveOS` (privado), rama `main`.
- **Pruebas**: `npm test` (45) · `SUPABASE_ACCESS_TOKEN=… npm run test:escenarios` (15 escenarios + concurrencia + lista blanca + sin residuos) · `GUION_PRUEBAS.md` para pruebas humanas.

---

## 7. Qué NO está conectado (por decisión) y qué falta

**Interfaces listas, sin proveedor conectado**: pasarela de pago (webhook firmado + eventos), correo/WhatsApp/push (cola con reintentos, `cola_tomar`/`cola_resultado`), certificador FEL (`fiscal_tomar`/`fiscal_resultado`; mientras tanto el estudio emite fuera y registra serie/número).

**Pendiente real**:
- Probar las pantallas con uso humano real (ver `GUION_PRUEBAS.md`): lo automático verifica la base, no el aspecto ni la comodidad.
- Separar base de producción de la de pruebas antes de operar con datos reales de VIM.
- Conectar un proveedor por cada integración cuando decidas cuál.
- Que VIM apruebe la matriz de permisos; términos de uso y política de privacidad.
- Facturación automática de ReserveOS a los estudios (hoy es manual) y acceso excepcional de soporte (P03) con aprobación.
- App nativa de marca (la PWA cubre móvil por ahora).
