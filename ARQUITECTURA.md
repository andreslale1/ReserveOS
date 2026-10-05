# ReserveOS — Esquema completo (5 oct 2026)

Plataforma SaaS multi-tenant para estudios y gimnasios (reservas, paquetes, caja, finanzas, CRM).
Cada estudio es un "tenant" aislado. VIM Pilates es el primer cliente previsto. Forma Pilates y CRM
Municipal son proyectos independientes: **este repo nunca los toca**.

---

## 1. Vista general

```
                         reserveos.app  (Vercel, proyecto "reserveos")
 ┌───────────────────────────────────────────────────────────────────────────────┐
 │  Next.js 16 + React 19 + Tailwind 4 (carpeta web/)                            │
 │                                                                               │
 │   /            Página de venta de ReserveOS (pública)                         │
 │   /e/[slug]    Página pública de un estudio: horarios + botón reservar        │
 │   /login       Entrada única (personal, clientas, operador)                   │
 │   /invitar/*   Activación de cuenta por link (personal / clienta)             │
 │   /reservar    App de la clienta (reservar, cancelar, lista de espera)        │
 │   /panel/*     Panel del estudio (dueña, gerente, admin, recepción, etc.)     │
 │   /owner/*     Consola del operador (tú): estudios, pipeline, cobros         │
 └──────────────────────────────────┬────────────────────────────────────────────┘
                                    │  @supabase/ssr  (cookie de sesión, JWT)
                                    ▼
 ┌───────────────────────────────────────────────────────────────────────────────┐
 │  Supabase (proyecto agkqppuhyltirrhngybq, us-east-1, org "ReserveOS")         │
 │   Auth · Postgres (67 tablas, 100% con RLS) · 243 funciones/RPC               │
 │   73 políticas RLS · 2 cron (pg_cron) · 2 buckets Storage · Vault (secretos)  │
 └───────────────────────────────────────────────────────────────────────────────┘
```

**Principio central:** la web casi nunca escribe en tablas directamente. Toda acción que cambia
datos es una **función de Postgres (RPC)** que valida el rol y el tenant adentro. El tenant jamás lo
manda el navegador; se deduce del usuario o del recurso. Si la interfaz fallara, la base de datos
sigue protegiendo.

---

## 2. Estructura del repositorio

```
ReserveOS/
├── ARQUITECTURA.md          este documento
├── README.md                estado por hitos y política de ambientes
├── package.json / vitest.config.ts     pruebas (raíz)
├── aplicar-migraciones.sh   script que pide token y corre supabase db push
├── .env.local               claves de Supabase para pruebas (fuera de git)
├── .claude/agents/ux-frontend-expert.md   guía de diseño del frontend
├── .agents/skills/          skills de diseño/animación instalados
├── auditoria/               material de la auditoría de Forma (cuerpos reales de RPCs, RLS, grants)
├── supabase/
│   ├── config.toml
│   ├── seed.sql
│   └── migrations/          43 archivos SQL, orden cronológico = historia del esquema
├── tests/                   Vitest: aislamiento entre tenants (25 pruebas)
│   ├── aislamiento_tablas.test.ts     un tenant no lee tablas de otro
│   ├── aislamiento_rpcs.test.ts       un tenant no ejecuta RPCs sobre otro
│   ├── aislamiento_storage.test.ts    buckets aislados por tenant
│   └── fixtures.ts / helpers.ts       tenants ficticio-a / ficticio-b
└── web/                     la aplicación (Next.js)
    ├── proxy.ts             middleware: refresca sesión; exige login en /panel
    ├── next.config.ts
    ├── lib/
    │   ├── supabase/{client,server,middleware}.ts
    │   ├── panel-context.ts     rol del usuario, sedes, NAV_POR_ROL, puedeVer()
    │   ├── owner-context.ts     verifica que es operador (plataforma_staff)
    │   └── client-context.ts    perfil de clienta para /reservar
    ├── components/          landing: hero, navbar, how-it-works, modules, footer, reveal…
    └── app/                 rutas (ver sección 4)
```

Convención en cada módulo del panel: `page.tsx` (servidor: lee datos y verifica rol) →
`*-view.tsx` (cliente: interfaz y formularios) → `actions.ts` (servidor: llama RPCs).
Tamaño: ~9,100 líneas de TypeScript en `web/`.

---

## 3. Base de datos (Supabase / Postgres)

### 3.1 Tablas por dominio (67)

| Dominio | Tablas |
|---|---|
| **Multi-tenant y accesos** | `tenants`, `tenant_domains`, `sedes`, `tenant_memberships` (rol de cada persona), `staff_sedes` (qué sedes ve cada staff), `module_catalog`, `tenant_entitlements`, `tenant_module_settings`, `role_permissions` (161 celdas de la matriz) |
| **Clientas** | `clientes` (ficha, consentimientos, familia/tutor), `invitaciones_clienta`, `invitaciones_personal` |
| **Agenda** | `horarios` (clases semanales o de fecha única), `horario_cancelaciones`, `horario_fechas_privadas`, `horario_fechas_privadas_personas` |
| **Reservas** | `reservas`, `lista_espera`, `lista_espera_notificaciones` |
| **Paquetes y membresías** | `paquetes`, `paquete_sedes`, `membresias`, `membresia_sedes`, `cobros_personalizados` |
| **Pagos y caja** | `pago_transacciones`, `configuracion_pago`, `cierre_caja` |
| **Tienda** | `productos`, `producto_variantes`, `carritos`, `carrito_items`, `pedidos`, `pedido_items`, `gift_cards` |
| **Descuentos** | `codigos_descuento`, `codigos_descuento_paquetes`, `codigos_descuento_productos` |
| **Finanzas** | `gastos`, `gasto_marketing`, `activos`, `pasivos`, `metas_mensuales`, `configuracion_finanzas` |
| **Marketing / CRM** | `comunicados`, `comunicados_vistos`, `encuestas_satisfaccion`, `testimonios`, `contact_submissions`, `whatsapp_mensajes`, `avisos_operativos_enviados` |
| **Sitio y app** | `contenido_sitio`, `configuracion_app`, `configuracion_contacto`, `configuracion_reservas`, `push_tokens`, `notificaciones_push_enviadas` |
| **Auditoría y errores** | `admin_acciones_log`, `error_logs` |
| **Integraciones (solo esquema, sin proveedor conectado)** | `integracion_pagos`, `integracion_whatsapp`, `integracion_email`, `integracion_push`, `integracion_fel` — secretos en Supabase Vault |
| **Plataforma (tú, el operador)** | `plataforma_staff` (con rol: operador/ventas/finanzas/soporte), `plataforma_leads` (pipeline), `plataforma_suscripciones`, `plataforma_cobros` |

### 3.2 Funciones (RPC) — por familia

- **Reservas:** `admin_agregar_reserva`, `admin_cancelar_reserva`, `cancelar_mi_reserva`,
  `confirmar_mi_reserva`, `unirse_lista_espera`, `salir_lista_espera`, `promover_lista_espera` (trigger
  automático), `registrar_asistencia`, `cancelar_clase_fecha`, `reabrir_clase_fecha`.
- **Membresías:** `agregar_membresia_manual` (venta y cortesía), `solicitar_membresia`,
  `confirmar_pago_membresia`, `rechazar_membresia_pendiente`, `congelar_/descongelar_membresia`,
  `transferir_membresia`, `ajustar_creditos_membresia`, `editar_cobro_membresia`, `anular_cobro_membresia`.
- **Agenda y personal:** `crear_horario`, `actualizar_horario`, `asignar_sede_personal`,
  `quitar_sede_personal`, `crear_invitacion_personal`, `crear_invitacion_clienta`.
- **Clientas:** `crear_cliente`, `actualizar_cliente`, familia (`agregar_dependiente`…), `export_resumen_clientes`.
- **Catálogo:** `crear_paquete`, `actualizar_paquete`, descuentos (`crear_codigo_descuento`…).
- **Caja y finanzas:** `cerrar_caja`, `caja_esperado_del_dia`, `registrar_gasto`, `eliminar_gasto`,
  `registrar_activo_pasivo`, `definir_meta_mensual`, familia `kpi_*` (≈25 indicadores).
- **Empresa:** `crear_sede`, `cerrar_sede`, `reabrir_sede`, `actualizar_marca`.
- **CRM:** `clientas_riesgo_fuga`, `membresias_por_vencer`, `clientas_consentimiento_pendiente`.
- **Plataforma:** `listar_tenants_plataforma`, `crear_tenant_plataforma`, `owner_tenant_detalle`,
  `lead_guardar`, `lead_cambiar_etapa`, `suscripcion_guardar`, `generar_cobros_mes`,
  `registrar_pago_cobro`, `plataforma_resumen`, `plataforma_estudios_cobro`, `mi_suscripcion`.
- **Públicas:** `horarios_publicos(slug)` — la única accesible sin login.
- **Ayudantes de seguridad:** `current_tenant_ids()`, `tengo_rol_en_tenant()`, `staff_puede_en_sede()`,
  `mi_cliente_id()`, `membresia_cubre_sede()`, `mi_permiso()`, `ahora_en_sede()`, `hoy_en_sede()`
  (zona horaria por sede, no fija).

### 3.3 Automatismos
- `pg_cron`: `liberar_cupos_no_confirmados` (cada 10 min) y `lista_espera_vencida` (cada 15 min).
- Triggers: promoción automática de lista de espera al cancelar; auditoría automática de cambios admin.
- Storage: `public-assets` (público) y `comprobantes` (privado), aislados por tenant.

### 3.4 Seguridad
1. RLS en las 67 tablas; `anon` sin privilegios de tabla.
2. Aislamiento por `current_tenant_ids()` (security definer, sin recursión).
3. Escrituras sensibles solo por RPC con verificación de rol y sede.
4. Tablas de plataforma sin ninguna política: solo accesibles vía RPC.
5. 25 pruebas automáticas verifican que un tenant no toca a otro.

---

## 4. Frontend — mapa de rutas

### Públicas
| Ruta | Qué es |
|---|---|
| `/` | Landing de ReserveOS (hero, problema/solución, módulos, cómo funciona, CTA) |
| `/e/[slug]` | Página del estudio: nombre, logo, color, horarios por sede, botón "Reservar mi clase" |
| `/login` | Acceso único; redirige por rol (`/panel`, `/owner`, `/reservar`) |
| `/invitar/personal/[token]`, `/invitar/clienta/[token]` | Activar cuenta con el link recibido |

### Clienta
| `/reservar` | Ver clases de los próximos días, reservar, cancelar, lista de espera |

### Panel del estudio `/panel` (menú según rol)
| Pantalla | Qué hace | Matriz |
|---|---|---|
| Hoy | Clases del día, cupos, enlace a cada clase | P16 |
| Calendario | Vista por instructora, crear clases | P13–P15 |
| Clase (`/panel/clase/[id]/[fecha]`) | Lista, asistencia, lista de espera, cupo, cancelar fecha | P14, P19–P21 |
| Clientas | Directorio, alta, invitación, exportar CSV | P09–P11, P38 |
| Ficha (`/panel/clientes/[id]`) | Paquetes y saldo, vender/regalar, ajustar créditos, congelar, transferir, reservar por ella, editar datos | P12, P18, P24–27 |
| Pagos pendientes | Aprobar o rechazar transferencias | P30–31 |
| Paquetes | Catálogo, precios, cobertura | P23 |
| Caja | Esperado vs real, cierre de caja | P32 |
| Tienda | Productos y pedidos | P39 |
| Descuentos | Códigos, vigencia, uso | P40 |
| Finanzas | Ingresos, gastos, neto, meta del mes | P33–34 |
| Gastos y balance | Registrar gastos, activos/pasivos, meta, exportar CSV | P35–37 |
| Negocio | KPIs: retención, adquisición, ranking de instructoras | P22 |
| Reportes | Asistencia y ocupación por horario | P22 |
| Seguimiento | Clientas en riesgo, paquetes por vencer, consentimiento pendiente | P41 |
| Personal | Invitar, roles, asignar sedes | P06, P08 |
| Agenda del personal | Clases semanales por instructora | P07 |
| Sedes | Crear, cerrar, reabrir | P05 |
| Configuración | Nombre, color, logo; link y código para la web del estudio | P04 |
| Mi suscripción | Plan y pagos a ReserveOS | — |
| Auditoría | Últimas 200 acciones administrativas | P43 |
| Automatizaciones | Estado de automatismos (sin builder) | — |

### Operador `/owner`
| Estudios | Lista, crear estudio con su dueña, detalle por estudio |
| Pipeline | Prospectos por etapa, valor, próxima acción |
| Cobros | MRR, cobrado, por cobrar, mora; suscripciones; registrar pagos; suspender |

### Roles → pantallas
- **Dueña / Gerente:** todo `/panel` de su estudio.
- **Admin de sede:** operación + finanzas de sus sedes.
- **Recepción:** Hoy, Calendario, Clientas, Pagos pendientes, Caja, Tienda.
- **Instructora:** Hoy, Calendario (asistencia en sus clases).
- **Contadora:** Hoy, Finanzas, Gastos y balance, Caja.
- **Clienta:** `/reservar`.
- **Operador (operador/ventas/finanzas/soporte):** `/owner` según rol interno.
La visibilidad se define en un solo lugar: `NAV_POR_ROL` en `web/lib/panel-context.ts`, y la
base de datos la hace cumplir de nuevo en cada RPC.

### Diseño
Tokens del manual v2: Ink `#111`, Paper `#F3EEE7`, Peach `#E8B89B`, Sage, Blue; Inter + Playfair.
Panel interno oscuro/lima en algunas vistas; sitio público claro. Animación de entrada con `Reveal`.

---

## 5. Flujos clave

1. **Alta de un estudio:** operador crea estudio → se genera invitación de dueña → dueña activa cuenta
   → configura marca, paquetes, horarios, personal → invita clientas.
2. **Venta de paquete:** ficha de clienta → `agregar_membresia_manual` (efectivo/transferencia/tarjeta
   o cortesía) → membresía activa con cobertura de sedes.
3. **Reserva:** clienta (o recepción por ella) → RPC valida cupo, membresía y sede → descuenta clase;
   si cancela, devuelve la clase y el trigger promueve a la lista de espera.
4. **Asistencia:** instructora/recepción marca asistió o no vino.
5. **Cobro a estudios (tuyo):** suscripción por estudio → "Generar cobros del mes" → registras pagos →
   mora visible → suspender.
6. **Integración con la web de un estudio:** enlace al login, iframe de `/e/slug`, o botón.

---

## 6. Despliegue y operación

- **Hosting:** Vercel, proyecto `reserveos` (cuenta andreslale1). Dominio `reserveos.app` y
  `www.reserveos.app` (comprado y configurado en Vercel). Deploy: `cd web && vercel deploy --prod`.
- **Base de datos:** una sola base Supabase que hoy es staging y producción a la vez (política en README:
  separar producción antes de operar datos reales de VIM). Cambios por migración:
  `supabase db push --linked` (necesita `SUPABASE_ACCESS_TOKEN` de la organización ReserveOS).
- **Git:** repo local, sin remoto en GitHub todavía (no hay respaldo en la nube del código).
- **Pruebas:** `npm test` en la raíz (25 pruebas); `npm run build` en `web/`.

---

## 7. Estado: qué está listo y qué falta

**Listo:** núcleo de reservas, membresías, caja, finanzas, tienda, descuentos, CRM básico, auditoría,
sedes, marca, panel por rol, página pública por estudio, pipeline y cobros del operador, dominio propio.

**No conectado (por decisión):** pasarela de pago, WhatsApp, email, push, factura electrónica (FEL);
campañas masivas (P42). El esquema ya existe.

**Pendiente / riesgos:**
- Dominio propio por estudio (`reservas.suestudio.com`).
- Soporte excepcional con aprobación y plazo (P03) y facturación automática de ReserveOS (P02).
- Repositorio sin respaldo remoto; sin ambiente de producción separado.
- Matriz de permisos sin aprobar por VIM; delegaciones (\*) no implementadas.
- Pantallas nuevas probadas por compilación y pruebas de seguridad, no aún con uso real de punta a punta.
- Token de Supabase expuesto en el chat: revocar.
