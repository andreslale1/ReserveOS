---
title: "ReserveOS | Lo que falta programar"
subtitle: "Backlog funcional y técnico para convertir el prototipo en una plataforma operable"
author: "Documento de trabajo para Andrés y su equipo de desarrollo"
date: "5 de octubre de 2026"
lang: es
toc: true
toc-depth: 2
geometry: margin=22mm
fontsize: 10pt
colorlinks: true
linkcolor: "#174438"
---

> **Alcance y evidencia.** Este documento compara la arquitectura objetivo conversada con `ARQUITECTURA.md`, entregado el 5 de octubre de 2026. No se recibió el repositorio, la base en ejecución ni acceso al despliegue. «Existe» significa «el documento afirma que existe»; no es certificación de funcionamiento. Forma Pilates continúa como proyecto independiente. VIM es el primer candidato para un alta real, pero todas las decisiones deben servir también para el segundo, tercero y siguientes estudios.

# 1. Veredicto y criterio de producto

ReserveOS ya tiene una estructura considerable según el documento: Next.js, Supabase, 67 tablas, 243 funciones/RPC, roles por estudio, tres sedes, paquetes, reservas, caja, una consola `/owner` y pruebas de aislamiento. Por eso el trabajo siguiente no consiste en volver a diseñar el núcleo. Consiste en **cerrar los flujos incompletos, convertir las estructuras vacías en servicios utilizables y demostrar los recorridos de punta a punta**.

El producto final tiene tres experiencias, con datos y propósitos distintos:

1. **ReserveOS interno:** Andrés y su equipo venden, implementan, facturan, dan soporte y supervisan el SaaS desde el primer prospecto, aunque no exista ningún gimnasio activo.
2. **Estudio o gimnasio:** dueña, gerentes, sede, recepción, instructoras, finanzas y marketing administran su empresa y sus sedes.
3. **Clienta del estudio:** descubre clases, compra, reserva, usa paquetes, consulta dependientes y asiste bajo la marca del estudio.

**Definición de terminado para cada funcionalidad:** pantalla + permisos por acción + persistencia + estados vacíos/cargando/error + auditoría si cambia dinero o derechos + prueba de flujo feliz y de rechazo. Una tabla, una RPC o un menú por separado no terminan una funcionalidad.

## 1.1 Lectura honesta del estado actual

| Área | Lo que describe `ARQUITECTURA.md` | Lo que aún falta demostrar o construir |
|---|---|---|
| Núcleo del estudio | Reservas, lista de espera, membresías, sedes, caja, tienda, KPIs, panel por rol | Pruebas reales de compra, reserva, cancelación, asistencia, caja y reportes con una y varias sedes |
| ReserveOS interno | Estudios, pipeline y cobros mensuales manuales en `/owner` | CRM completo, tareas, campañas, propuestas, contratos, implementación, soporte, salud, costos y rentabilidad |
| Pagos | Transacciones y configuración; métodos manuales | Conector de un proveedor real, eventos verificables, reembolsos y conciliación; separar solicitud, cobro y activación |
| Comunicaciones/FEL | Tablas de integración y secretos previstos | Proveedor conectado, plantillas, colas, reintentos, preferencias y flujo operativo de facturación |
| Distribución | `reserveos.app`, `/e/[slug]` y `/reservar` | Portal completo de clienta, dominio por estudio, enlaces profundos, experiencia móvil y app si se contrata |
| Roles | `tenant_memberships`, `staff_sedes`, matriz de 161 celdas, `NAV_POR_ROL` | Delegaciones reales, roles internos ampliados, gerencia regional/marketing del estudio, identidad con varias membresías |
| Operación | Logs, auditoría, dos cron y 25 pruebas de aislamiento | Monitoreo por tenant, pruebas sintéticas, incidentes, seguimiento de jobs, soporte y pruebas de uso real |

**Regla de estado:** etiquetar cada historia como `DOCUMENTADO`, `ESQUEMA`, `UI`, `INTEGRADO`, `E2E` o `OPERANDO`. No llamar «listo» a algo que solo tenga esquema o que únicamente compile.

# 2. Prioridades y dependencias

| Prioridad | Significado | Condición |
|---|---|---|
| **P0 - Producto operable** | Trabajo imprescindible para poner un gimnasio real en funcionamiento y cobrar correctamente | Cerrado con pruebas de punta a punta antes de usar datos y pagos reales |
| **P1 - ReserveOS como empresa** | Trabajo imprescindible para gestionar ventas, clientes, facturas y servicio desde el propio sistema | Puede avanzarse en paralelo con P0; debe funcionar con cero tenants activos |
| **P2 - Escala y amplitud** | Módulos adicionales, canales, automatizaciones y eficiencia operativa | Se habilita por plan y necesidad contractual, sin duplicar código por marca |

No estimar semanas a partir de esta lista. Primero se debe inspeccionar el código y mostrar una demo de los flujos existentes. Cada bloque indica **resultado verificable**, no solamente una pantalla.

# 3. ReserveOS interno: programar el lugar donde trabaja Andrés

## RO-01 · Inicio de dirección y navegación interna — P1

**Base documentada:** `/owner`, `owner-context`, `plataforma_staff`, `plataforma_resumen` y pantallas Estudios, Pipeline, Cobros.

**Programar:** inicio de ReserveOS con próximos seguimientos comerciales, contratos por cerrar, altas bloqueadas, facturas vencidas, renovaciones, tickets, incidentes y estado de cada integración. Filtros por responsable, período, etapa, plan y estado. Un enlace desde cada tarjeta abre el registro causante, no un total sin explicación. El menú interno debe contemplar Dirección, CRM, Marketing B2B, Propuestas, Contratos, Activaciones, Estudios, Planes y módulos, Integraciones, Facturación SaaS, Soporte, Salud técnica, Tareas, Equipo y Auditoría.

**Criterio de aceptación:** el primer día se puede iniciar sesión y trabajar en leads, reuniones, tareas y propuestas aunque la base contenga cero tenants; las tarjetas sin datos muestran pasos claros para crear el primero.

## RO-02 · CRM B2B, contactos y actividades — P1

**Base documentada:** `plataforma_leads`, `lead_guardar`, `lead_cambiar_etapa` y página Pipeline.

**Programar:** separar **empresa**, **contacto**, **oportunidad**, **actividad** y **tarea**. Una empresa puede tener varias personas y oportunidades históricas; cada oportunidad conserva etapa, importe propuesto, plan, número de sedes, módulos, responsable, probabilidad y siguiente acción. Registrar llamadas, emails, reuniones, notas, adjuntos, origen, consentimiento, último contacto y motivo de pérdida. Búsqueda, duplicados, importación controlada, vista Kanban/lista, filtros, recordatorios y propietario del registro.

**Modelo sugerido:** ampliar `plataforma_leads` o migrarla a `plataforma_empresas`, `plataforma_contactos`, `plataforma_oportunidades`, `plataforma_actividades`, `plataforma_tareas`. Preservar IDs e historial si ya hay leads. No utilizar `clientes` del gimnasio para el CRM comercial de ReserveOS.

**Criterio de aceptación:** crear un gimnasio prospecto, agregar dos decisores, registrar demo y tarea, enviar propuesta y pasar a «ganada»; el proyecto de activación nace con los datos correctos, sin copiar y pegar.

## RO-03 · Marketing de ReserveOS — P1

**Programar:** formularios del sitio ReserveOS asociados a fuente/campaña, segmentos de empresas, calendario de campañas, contenido, eventos, presupuesto, leads captados, reuniones generadas, propuestas y cierres. Incluir preferencias de contacto, listas de exclusión y atribución de origen sin afirmar causalidad por una mera visita. Plantillas y envíos B2B cuando el proveedor de email esté conectado.

**Separación obligatoria:** este marketing busca **gimnasios clientes de ReserveOS**. Las campañas que VIM envía a sus clientas pertenecen a VIM y constituyen otro módulo con otros permisos.

**Criterio de aceptación:** una consulta desde la web crea o vincula empresa/contacto, conserva origen, asigna responsable y genera tarea; el dashboard permite comparar campañas con demos y contratos.

## RO-04 · Propuestas, contratos y renovaciones — P1

**Programar:** propuesta versionada con plan, sedes incluidas/adicionales, módulos, configuración inicial, app propia opcional, mensajería, soporte, fecha de inicio y términos acordados. Estados `borrador → enviada → negociando → aceptada/perdida`. Contrato firmado, vigencia, renovaciones, anexos, cambios de precio, documentos y recordatorios. La aceptación comercial crea el proyecto de implementación, no habilita automáticamente un tenant para recibir dinero.

**Criterio de aceptación:** editar una propuesta después de enviarla conserva la versión anterior; activar otra sede actualiza alcance comercial sin reescribir facturas históricas.

## RO-05 · Activación guiada de un tenant — P0/P1

**Base documentada:** `crear_tenant_plataforma`, invitación de dueña, `tenant_entitlements`, `tenant_domains`, sedes y módulos.

**Programar:** proyecto de onboarding por tenant con responsables, fechas y evidencias. Etapas: contrato, identidad y marca, dominio, sedes/salas, roles, clases/paquetes, reglas entre sedes, comercio del estudio, importación autorizada, notificaciones, capacitación, pruebas y lanzamiento. «Guardar borrador» en cada etapa; validaciones bloqueantes antes de publicar. Roles de implementación pueden preparar; el propietario o responsable delegado aprueba salida.

**Criterio de aceptación:** alta de estudio de una sede y de VIM con tres sedes sin editar código ni desplegar una rama especial; no se puede marcar «en vivo» con integración de cobro o prueba de reservas pendiente si fue comprometida en el contrato.

## RO-06 · Catálogo de planes, módulos y límites — P0

**Base documentada:** `module_catalog`, `tenant_entitlements`, `tenant_module_settings`, `role_permissions`.

**Programar:** catálogo versionado de planes y capacidades; módulos activados por tenant, límites por sedes/usuarios/uso y excepciones contractuales con motivo. Vista «qué incluye» para Andrés y «Mi suscripción» para la dueña. El frontend oculta lo no contratado y **cada RPC** verifica entitlement y permiso del rol antes de ejecutar. Definir qué ocurre al desactivar un módulo con datos históricos; conservar lectura/exportación según contrato.

**Criterio de aceptación:** desactivar Tienda en un tenant elimina acceso a sus rutas y acciones, mientras otro tenant mantiene Tienda activa; el historial no desaparece.

## RO-07 · Facturación y rentabilidad de ReserveOS — P1

**Base documentada:** `plataforma_suscripciones`, `plataforma_cobros`, `generar_cobros_mes`, `registrar_pago_cobro`.

**Programar:** factura/cobro de setup, licencia, sedes extra y módulos; vencimientos, cobro parcial, mora, notas, descuentos, cambios de plan y renovación. Idempotencia: generar el mes dos veces no duplica cobros. Guardar instantánea del plan y precio facturado. Gastos propios de ReserveOS (infraestructura, mensajería, dominios, soporte, app), margen por tenant y global, MRR, facturado vs cobrado. Exportes para contabilidad. Suspensión comercial con estados y consecuencias explícitas, sin borrar datos ni impedir una salida contractual.

**Criterio de aceptación:** facturar VIM y otro estudio, registrar cobro parcial y mora, cambiar de plan a mitad de ciclo según política definida y obtener un saldo correcto. La caja de VIM no aparece como ingreso de ReserveOS.

## RO-08 · Soporte, éxito del cliente e incidentes — P1

**Programar:** tickets por estudio y sede, canal, prioridad, responsable, SLA, conversación, adjuntos, estado y causa. Alertas de adopción (sin uso de módulos, horarios sin clases, falla repetida), renovaciones y tareas de seguimiento. Base de ayuda, escalación a ingeniería y comunicación de incidente. El diagnóstico predeterminado usa metadatos; un acceso excepcional a datos de clientas, cuando exista, tiene aprobación, duración y bitácora.

**Criterio de aceptación:** un error de reserva crea caso vinculado al tenant, sede, versión y evento; soporte responde y escala sin abrir la ficha personal ni el estado financiero del gimnasio.

## RO-09 · Salud técnica y operativa por estudio — P1

**Base documentada:** `error_logs`, `admin_acciones_log`, dos cron y panel de automatizaciones.

**Programar:** estado de portal, autenticación, consulta de clases, reserva sintética, webhook de pago, cola de email/WhatsApp/push, cron, certificados, migraciones, jobs atrasados, respaldo y versión desplegada. Alertas con umbral, incidente, responsable y resolución. En la ficha de tenant: semáforo por servicio, última prueba satisfactoria, errores recientes agregados y cambios de configuración. Los logs deben asociar tenant y evento sin exponer datos personales o montos privados por defecto.

**Criterio de aceptación:** desconectar en entorno de prueba una integración de VIM genera alerta atribuida a VIM y no a otro estudio; el equipo distingue error de código, configuración y proveedor.

# 4. Roles que faltan convertir en funcionalidades

La matriz existente puede servir como base. Es necesario separar **rol**, **acción**, **recurso**, **sede**, **módulo contratado** y **delegación**. El menú es una representación; la regla ejecutable vive en el servidor y la base.

## 4.1 Roles internos de ReserveOS

| Rol | Funcionalidad de frontend necesaria | Acciones propias |
|---|---|---|
| Propietario / dirección | Cockpit de negocio, CRM, planes, suscripciones, activaciones, equipo, salud y auditoría | Aprobar lanzamientos y cambios contractuales; gestionar operación global de ReserveOS |
| Ventas | CRM, actividades, demos, propuestas y forecast | Gestionar leads/oportunidades y pasar a implementación |
| Marketing B2B | Campañas, formularios, fuentes, segmentos y análisis | Crear campañas para captar gimnasios; no contactar clientas de tenants |
| Implementación | Checklist, configuración de tenant, importaciones, dominio, pruebas y capacitación | Preparar alta y solicitar publicación; sin secretos visibles |
| Finanzas SaaS | Contratos, facturas y cobros a gimnasios, costos y margen | Registrar cobros de licencia; no leer la caja de un gimnasio |
| Soporte / éxito cliente | Tickets, salud, adopción, base de ayuda y escalaciones | Diagnosticar con datos mínimos; solicitar acceso temporal cuando corresponda |
| Ingeniería / operaciones | Versiones, migraciones, jobs, webhooks, alertas, incidentes | Resolver fallos técnicos y desplegar con trazabilidad |
| Auditor (opcional) | Bitácoras, permisos, cambios de plan e incidentes | Lectura y revisión, sin modificar la operación |

`plataforma_staff` documenta hoy operador/ventas/finanzas/soporte. Ampliar la representación a estos roles o a permisos equivalentes. Andrés puede acumular varios roles, pero eso no debe convertir cada cuenta interna en superusuario. La consola puede empezar con un único propietario, siempre que su arquitectura soporte luego un equipo.

## 4.2 Roles dentro de un gimnasio

| Rol | Necesidad programable | Escala de sedes |
|---|---|---|
| Dueña | Consolidado, configuración, permisos, catálogo y finanzas | Todas las sedes del tenant |
| Gerencia general | Casi todo con delegaciones en cambios sensibles | Todas o subconjunto asignado |
| Gerencia regional **(añadir)** | Comparar, coordinar y operar varias sedes | Conjunto explícito; útil para cuatro o más sedes |
| Admin de sede | Horarios, salas, personal local, reservas, asistencia y caja local | Una o más sedes asignadas |
| Recepción / caja | Alta asistida, venta, reserva, check-in y caja diaria | Sus sedes; límites en ajustes y reembolsos |
| Instructora | Sus clases, roster mínimo, asistencia y disponibilidad | Clases asignadas; puede rotar entre sedes |
| Finanzas / contadora | Cobros, gastos, conciliación, reportes y exportes | Global o sedes asignadas; sin CRM personal completo |
| Marketing del estudio **(añadir)** | Segmentos autorizados, campañas, promociones y resultados | Tenant o sedes autorizadas; consentimiento aplicable |
| Inventario/tienda **(opcional)** | Productos, existencias, pedidos y devoluciones | Depósitos o sedes asignadas |
| Clienta / titular familiar | Compra, reservas, QR, historial, pagos y dependientes | Lo propio dentro de ese tenant |

**Implementación recomendada:** agregar capacidades y alcance por sede a la matriz actual, no codificar una aplicación diferente por cada rol. `staff_sedes` ya apunta en esa dirección. Una gerencia regional puede tener tres de diez sedes; una instructora puede tener clases en dos sin acceso a la caja de ninguna.

**Delegaciones `*`:** crear registro de otorgante, beneficiario, acción, sede(s), límites, inicio, caducidad, motivo y revocación. Hasta que exista, los botones y RPC delegados deben quedar denegados. Permisos distintos para **ver**, **crear**, **editar**, **aprobar**, **reembolsar** y **exportar**.

**Criterio transversal:** una misma persona con cuenta de clienta en VIM y rol de instructora en otro estudio entra con la misma identidad, elige contexto autorizado y jamás comparte saldos, fichas o agenda entre tenants.

# 5. Funcionalidades del gimnasio: cerrar el núcleo

## ST-01 · Sedes, recursos, horarios y personal — P0

**Base documentada:** `sedes`, `staff_sedes`, `horarios`, `horario_cancelaciones`, `crear_horario`, `actualizar_horario`, `asignar_sede_personal`.

**Programar/completar:** horarios de apertura diferentes por sede y día; excepciones, feriados, cierres, salas, equipamiento, capacidad, disciplina, duración, instructora principal/sustituta y tiempo mínimo entre sedes. Plantillas semanales que generan ocurrencias sin modificar reservas ya confirmadas al editar el patrón. Vista consolidada para dirección, por sede para administración y por clase para instructora. Al cerrar sede, resolver clases futuras, reservas, lista de espera, paquetes que la cubren y saldos antes de confirmar.

**Criterio de aceptación:** sede A abre entre semana, B tiene clases el domingo y C cierra temporalmente; los horarios y reservas son correctos, y una instructora asignada a A y B no puede aparecer en clases simultáneas.

## ST-02 · Clienta única por gimnasio, familia e invitación — P0

**Base documentada:** `clientes`, familia/tutor, invitaciones, ficha en `/panel`.

**Programar/completar:** alta por dueña/recepción, invitación para que la clienta reclame su cuenta, detección y resolución segura de duplicados dentro del tenant, perfil compartido por sedes y **sede habitual como preferencia**, no como autorización. Distinguir datos editables por recepción, datos propios, tutores/dependientes, historial y consentimientos. Búsqueda local que permita atender a una clienta sin abrir el directorio completo de la cadena.

**Criterio de aceptación:** recepción de sede A crea la cuenta; la clienta compra un paquete válido A+B y reserva en B. El equipo de B puede atenderla con datos mínimos; el historial sigue siendo uno dentro de VIM. Otro gimnasio que usa el mismo email no ve esa ficha.

## ST-03 · Paquetes, cobertura de sedes y créditos — P0

**Base documentada:** `paquetes`, `paquete_sedes`, `membresias`, `membresia_sedes`, `membresia_cubre_sede()`.

**Programar/completar:** tres tipos de cobertura: sede única, conjunto explícito y todas las sedes del tenant. Decidir si «todas» incluye sedes futuras y guardar la regla en el producto vendido. Vigencia, clases por disciplina/tipo, titular, dependientes, suspensión/congelación, transferencia, caducidad, cortesía y ajuste con motivo. El derecho comprado conserva precio y condiciones históricas; editar catálogo no reescribe membresías vendidas. Reducir cobertura exige tratar reservas futuras afectadas.

**Criterio de aceptación:** paquete solo A reserva A y bloquea B; A+B reserva ambas descontando una clase una sola vez; paquete «todas» sigue la regla elegida cuando se abre sede D. La app explica por qué una clase aparece bloqueada.

## ST-04 · Reservas, espera, cancelaciones y asistencia — P0

**Base documentada:** RPC de reserva, `lista_espera`, triggers, `registrar_asistencia`, QR mencionado en arquitectura previa.

**Programar/completar:** una operación atómica valida tenant, clienta/beneficiaria, clase, sede, membresía vigente, cobertura, saldo, aforo, cancelación y duplicados. Lista de espera con posición, notificación, tiempo de confirmación y revalidación de elegibilidad al promover. Cancelación temprana/tardía y devolución de créditos según reglas configuradas por tenant. Check-in por QR o staff sin volver a consumir crédito; no-show y correcciones auditadas. Resolver competencia por el último cupo con transacciones.

**Criterio de aceptación:** dos personas intentan tomar el último cupo; solo una confirma. Al cancelar, la siguiente recibe oferta; si ya no tiene créditos válidos, pasa a la siguiente sin sobrecupo ni débito duplicado.

## ST-05 · Órdenes, pagos y activación de membresías — P0

**Base documentada:** `pago_transacciones`, `configuracion_pago`, `solicitar_membresia`, `confirmar_pago_membresia`, `agregar_membresia_manual`. Integraciones de proveedor solo en esquema.

**Programar:** un adaptador real para el proveedor que contrate el primer estudio. Diseñar interfaz común para que el siguiente tenant pueda usar otro sin cambios en reservas. Separar estados de **orden**, **intento de pago**, **cobro confirmado** y **membresía activa**. La transferencia crea `pendiente`; solo personal autorizado confirma con comprobante y revisión. Un registro de tarjeta manual no acredita que la pasarela la haya cobrado. Verificar firma/evento del proveedor y usar claves de idempotencia; guardar referencia, importe, moneda, comercio titular, sede de venta, comisión/liquidación si la entrega el proveedor y estado.

**Criterio de aceptación:** pago aprobado activa créditos exactamente una vez; pago fallido no los activa; webhook duplicado/tardío no duplica venta; transferencia rechazada deja trazabilidad; reembolso parcial o total ajusta derecho y reservas afectadas según política. Las cuentas de los estudios y la facturación SaaS permanecen separadas.

## ST-06 · Caja y finanzas por sede/consolidadas — P0/P1

**Base documentada:** `cierre_caja`, `gastos`, activos/pasivos, metas, funciones `kpi_*`, pantallas Finanzas, Gastos y balance.

**Programar/completar:** vistas de ventas, cobros, pendientes, devoluciones, descuentos, gastos, caja, depósitos/liquidaciones, membresías activas, créditos pendientes de uso, ocupación y metas. Filtros por fecha, sede, paquete, canal, método y responsable. Definir una **regla de atribución** cuando un paquete se vende en sede A y sus clases se consumen en B; no duplicar la venta en dos sedes. El consolidado se deriva de datos locales y centrales con reglas explícitas. Un cierre de caja se reconcilia con transacciones y justifica diferencias. Exportes coherentes con la vista y el rol. Estados de resultados e impuestos requieren configuración contable concreta, no sumar columnas sin criterio.

**Criterio de aceptación:** vender paquete A+B en A, usar una clase en B y cerrar ambas cajas produce una sola venta global; recepción B no ve la caja de A; dueña ve consolidado y desglose cuya suma cuadra.

## ST-07 · Tienda, inventario, gift cards y descuentos — P1/P2

**Base documentada:** productos, variantes, carritos, pedidos, `gift_cards`, descuentos y pantallas de Tienda/Descuentos.

**Programar/completar:** disponibilidad por sede, inventario y movimientos, reserva de existencias durante checkout, fulfillment/entrega, devoluciones, impuestos aplicables y conciliación. Gift card con compra, emisión, saldo, redención parcial, vencimiento y reversa; impedir redimir dos veces por concurrencia. Códigos de descuento con vigencia, límite de usos, alcance, combinabilidad y reporte de margen. Estos módulos se activan por tenant y plan.

**Criterio de aceptación:** una gift card vendida en sede A se usa en B si la regla lo permite; saldos y cajas registran el movimiento correcto; un tenant sin Tienda no ve ni ejecuta sus acciones.

## ST-08 · CRM del estudio y comunicaciones — P1/P2

**Base documentada:** `clientas_riesgo_fuga`, `membresias_por_vencer`, consentimientos, `comunicados`, encuestas y esquemas de WhatsApp/email/push. Automatizaciones sin builder; campañas P42 pendientes.

**Programar:** reglas de segmentos (nueva, por vencer, inactiva, alto uso, no-show) con criterios visibles; campañas y automatizaciones configurables por estudio. Mensajes transaccionales: invitación, compra, reserva, cambio, cancelación, espera, recordatorio y renovación. Plantillas por marca, canal, idioma, sede, consentimiento, variables y zona horaria. Cola, límite de envíos, reintento, fallo y reporte de entrega. No enviar comunicaciones de VIM desde contactos o remitente de otro estudio. Las campañas masivas se ofrecen solo cuando exista proveedor y mecanismo de bajas configurado.

**Criterio de aceptación:** dos estudios con clientas que comparten email envían solo su mensaje con su identidad, plantilla y consentimiento; un fallo del proveedor se reintenta sin duplicar comunicaciones.

## ST-09 · Facturación del estudio y FEL — P1 según contrato

**Base documentada:** `integracion_fel` solo esquema.

**Programar:** definir emisor del comprobante, datos fiscales, cuándo se emite, anulaciones, rectificaciones, vínculo con orden/pago y responsable del proveedor. Si se promete facturación electrónica integrada a VIM, construirla y probarla antes de recibir ventas; si no, especificar dentro del contrato el proceso operacional y la exportación para emitir fuera de ReserveOS. El número, estado y respuesta del certificador deben quedar vinculados a la operación.

**Criterio de aceptación:** venta y devolución tienen comprobantes/estados consistentes; un fallo de emisión se muestra como pendiente para resolución y no desaparece del reporte.

# 6. Web de cada estudio, identidad y app

## WEB-01 · Portal con marca propia y dominio personalizado — P0/P1

**Base documentada:** `/e/[slug]` público, dominio general `reserveos.app`, `tenant_domains` sin conexión de subdominio por cliente.

**Programar:** portal que cubra exploración, cuenta, compra, reserva e historial, con logo, nombre, colores, sede, contenido y políticas del tenant. Enlace desde la web existente del estudio conserva clase/sede seleccionadas. Inicialmente puede usarse un subdominio ReserveOS; para un dominio del estudio, alta, prueba de titularidad, DNS, certificado, estado de activación, callbacks de login y baja. Resolver el tenant por **host verificado**, no aceptar que el navegador determine el tenant con un parámetro manipulable. Panel del estudio y clientas pueden compartir dominio con rutas y roles distintos. El iframe público puede mostrar disponibilidad, pero un checkout o login embebido requiere un diseño específico adicional.

**Criterio de aceptación:** `reservas.vimpilates.com` (ejemplo de dominio, sujeto a control de VIM) solo carga marca y datos VIM; un host desconocido no revela otro tenant; invitación, recuperación de acceso, pago y retorno funcionan en móvil y escritorio.

## WEB-02 · Una identidad, contextos explícitos — P0

**Base documentada:** `/login` único que redirige según rol, `tenant_memberships`, `/panel`, `/owner`, `/reservar`.

**Programar:** si el usuario tiene una sola membresía, entrada directa. Si pertenece a varias empresas o tiene papel de clienta y staff, pantalla de selección de contexto. En dominio propio, preseleccionar el tenant identificado por ese dominio y validar que la persona pertenece a él. Invitaciones idempotentes, caducidad, cambio de email, pérdida de sesión, recuperación de contraseña y desvinculación. La sesión no transfiere por sí misma paquetes entre marcas.

**Criterio de aceptación:** mismo correo: clienta de VIM y dueña de un segundo gimnasio; alterna contexto de forma consciente. Acceder a una URL `/panel/...` del segundo desde sesión VIM no muestra datos ni permite acciones del otro sin autorización.

## WEB-03 · App web de la clienta completa — P0/P1

**Base documentada:** `/reservar` muestra clases, permite reservar, cancelar y lista de espera.

**Programar:** inicio con próximas clases y saldo; exploración por sede, fecha, instructora y tipo; elegibilidad visible; catálogo y compra; estado de pago; paquetes activos, vencidos y cobertura; reservas, cancelación, espera y notificaciones; QR/check-in; historial y recibos; perfil, dependientes, preferencias y soporte. Estados de cero créditos, sede no cubierta, clase llena, pago pendiente y sesión caducada. Experiencia móvil primero, accesible y con enlaces profundos.

**Criterio de aceptación:** clienta invitada por recepción termina activación, compra un paquete de una sede, ve bloqueada la otra, reserva, cancela según política, recibe aviso y registra asistencia sin pedir ayuda al staff.

## WEB-04 · Distribución móvil de marca — P2 o P0 si se vende en contrato

**Programar:** portal responsive/PWA como canal inicial y, si un estudio contrata app nativa propia, distribución con icono, nombre, deep links, push, publicación, actualizaciones y soporte de esa marca sobre la misma API, permisos y modelo de datos. Otra opción futura es una app compartida con selección de estudio. Mantener una sola lógica de reservas/pagos; las diferencias de distribución se configuran por tenant.

**Criterio de aceptación:** reserva iniciada en web y consultada en app muestra mismo saldo/estado; notificación abre la reserva correcta del tenant correcto; nueva versión del backend no rompe la app instalada.

# 7. Reglas técnicas que deben convertirse en invariantes

Estas reglas son parte de terminar el producto y evitar errores funcionales entre empresas, sedes y pagos; no sustituyen una auditoría de seguridad separada.

1. **Identidad y contexto:** cada acción conoce usuario, tenant, rol, sedes y módulo activo. Una persona puede tener varias membresías. Los IDs recibidos por URL se comprueban contra recursos de ese mismo tenant.
2. **Datos y referencias:** reservas, horarios, paquetes, clientas, pagos y membresías no pueden cruzar tenants por relaciones inválidas; horarios y asistencias llevan sede. Recursos compartidos dentro de un tenant no se duplican por cada sede.
3. **Transacciones:** reservar y debitar crédito es una unidad; cancelar y devolver crédito es otra; promover lista de espera revalida elegibilidad; confirmar pago activa derecho una sola vez.
4. **Procesos repetibles:** cron, webhooks, envío de mensajes, generación de cobros mensuales y migraciones se pueden reintentar sin crear registros dobles. Cada fallo queda visible y recuperable.
5. **Histórico y auditoría:** cambios de precio, cobertura, plan, rol, créditos, reembolsos, cierre de caja y personal conservan antes/después, actor, motivo y fecha. Editar un catálogo no altera compras pasadas.
6. **Módulos:** la misma condición de contratación/activación se aplica a navegación, página, RPC, webhook y job. Desactivar un módulo no borra su historial.
7. **Versiones:** un único código compartido, configuración por tenant y feature flags con posibilidad de revertir; Forma no se despliega desde este repositorio ni se altera en su operación.

**Entidades sugeridas a revisar:** tablas comerciales de ReserveOS (empresa, contacto, oportunidad, actividad, tarea, propuesta, contrato); onboarding (proyecto, etapa, validación); soporte (ticket, incidente); plataforma (factura, recibo, costo); estudio (orden, intento de pago, evento del proveedor, derecho/paquete, consumo de crédito); identidad (membresía de tenant, delegación, sede asignada, dominio). Aprovechar tablas existentes antes de crear duplicados semánticos.

# 8. Flujos de aceptación de punta a punta

| ID | Prueba | Resultado exigido |
|---|---|---|
| E2E-01 | Zero tenants: crear lead, contactos, actividades, propuesta, contrato, tarea y proyecto de alta | ReserveOS funciona como herramienta de trabajo antes del primer gimnasio |
| E2E-02 | Alta estudio A (1 sede) y VIM (3 sedes) con diferentes módulos | Configuración sin cambios de código; marca, permisos, horarios y catálogo aislados |
| E2E-03 | Mismo correo en dos estudios y como staff/clienta | Selección de contexto; ningún dato, saldo o rol se transfiere por accidente |
| E2E-04 | Gerente de sedes 1+2, admin solo 3, instructora con clases en 1+3 | Cada agenda y reporte corresponde exactamente a su alcance |
| E2E-05 | Clienta creada en sede 1 compra paquete solo 1; intenta reservar 2; luego compra 1+2 | Primero bloqueo explicado, luego reserva válida y un crédito debitado |
| E2E-06 | Dos reservas simultáneas por el último cupo; una cancelación promueve lista de espera | Una sola plaza confirmada en cada instante; crédito y notificación consistentes |
| E2E-07 | Pago aprobado, fallido, duplicado, transferencia pendiente y reembolso | Membresía se activa solo tras confirmación; no hay créditos ni ventas duplicadas |
| E2E-08 | Venta en sede 1; asistencia en sede 2; cierre de caja y consolidado | Atribución documentada y un solo total global; caja local cuadra |
| E2E-09 | VIM enlaza su web al portal en dominio propio; login y retorno de pago | Host/HTTPS, marca, callbacks, correo, móvil y reserva funcionan de extremo a extremo |
| E2E-10 | Soporte recibe un ticket, ingeniería resuelve, dirección ve estado | Diagnóstico y bitácora por tenant sin exposición de clientas ni ingresos privados |
| E2E-11 | ReserveOS genera dos cobros mensuales y registra uno parcial | MRR, deuda y saldo correcto; repetir generación no duplica factura |
| E2E-12 | Se desactiva Tienda en un estudio, permanece activa en otro | Rutas y RPC del primero denegadas; historial conservado; segundo opera normal |

**Conjunto mínimo de fixtures:** tenant A con una sede, VIM ficticio con tres, tenant C con cuatro; una persona en dos tenants; paquete sede única, A+B y todas; instructora que rota; admin de una y de varias sedes; dueña, contadora, recepción, clienta con dependiente; pagos y webhooks repetidos. Usar datos ficticios y preservar Forma independiente.

\newpage

# 9. Orden de entrega sugerido

## Hito 0 · Verificar el punto de partida

- Ejecutar build, pruebas y una demo navegable de cada ruta existente. Inventariar RPCs y pantallas reales, no solo nombres.
- Marcar cada historia con estado `DOCUMENTADO`, `UI`, `INTEGRADO`, `E2E` u `OPERANDO`; asignar responsable y dependencia.
- Crear un tablero del proyecto desde estas historias y bloquear scope adicional que no corresponda al contrato inicial de VIM.

## Hito 1 · Completar el negocio interno de ReserveOS

- CRM B2B, tareas, actividades, propuestas y contratos; propietario puede trabajar sin tenants.
- Handoff comercial a activación, catálogo de planes y facturación SaaS con generación idempotente.
- Roles internos y dashboard con enlaces a causas reales.

## Hito 2 · Terminar el núcleo comercial/operativo del estudio

- Roles y sedes delegadas, paquetes con cobertura, clienta compartida dentro del tenant.
- Portal móvil completo, órdenes/pagos/derechos, reservas, espera, QR y caja/finanzas conciliadas.
- Una pasarela real del estudio piloto y proceso de transferencia/pago presencial bien definido.

## Hito 3 · Lanzar VIM con garantías operativas

- Onboarding, web de marca/dominio acordado, pruebas E2E de tres sedes, capacitación y soporte.
- Monitoreo por tenant, alertas, jobs reintentables y plan de reversión.
- Salida controlada con seguimiento de incidentes; Forma sigue en producción independiente.

## Hito 4 · Volver repetible el alta del siguiente cliente

- Segundo estudio de una sede y tercero de cuatro o más sin bifurcar código.
- Automatización de facturación SaaS, marketing, soporte, tienda, comunicaciones, app y módulos avanzados según contrato.
- Medir tiempo real de alta, incidencias, adopción, margen y renovaciones; usar esos datos para ajustar el producto.

\newpage

# 10. Entrega exacta solicitada al equipo de programación

1. **Backlog refinado** con ID de este documento, responsable, estimación, dependencia, estado y evidencia de cierre.
2. **Inventario «documentado vs funcionando»** de rutas, tablas, RPC, jobs, buckets y módulos; cualquier diferencia con `ARQUITECTURA.md` se registra.
3. **Modelo de permisos ejecutable** para plataforma, gimnasio y clienta; definición de delegaciones y alcance de sedes; pruebas negativas por acción.
4. **Diseño de flujos de dinero** con estados, diagramas, idempotencia y conciliación de cobros de clientas y facturas SaaS por separado.
5. **Especificación de integración web** con dominio, callbacks, branding, enlaces, acceso de staff y clienta; pruebas en móvil.
6. **Pruebas E2E automatizadas y guion de aceptación humana** con los doce escenarios de la sección 8.
7. **Demo final:** prospecto → contrato → alta → compra → reserva → asistencia → caja → factura SaaS → incidente.
