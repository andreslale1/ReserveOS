---
title: "Forma SaaS — Documento maestro para iniciar el desarrollo"
subtitle: "Todo lo necesario para que otra terminal/programador arranque sin depender de contexto verbal"
date: "28 de septiembre de 2026"
lang: es-GT
---

# Forma SaaS — Documento maestro

Este documento combina tres fuentes ya validadas: la documentación técnica real de Forma Pilates
(`Forma-Pilates-Documentacion-Tecnica.md`), el plan de negocio y producto (`Plan_Maestro_Forma_SaaS_VIM_2026.md`,
incluida su matriz de permisos) y las decisiones de arquitectura acordadas en las sesiones previas. Está escrito
para que quien lo retome — humano o agente de IA — pueda empezar a trabajar sin necesitar que nadie se lo explique
de palabra.

**Nota sobre la matriz de permisos (sección 12):** aunque el ejemplo usado en todo el documento es VIM,
la matriz y todo el modelo de roles son **genéricos de la plataforma** — aplican a cualquier empresa/gimnasio
que se dé de alta, no son reglas específicas de VIM. VIM es el primer tenant real que valida el diseño, no un
caso especial con código propio.

---

## 0. Cómo usar este documento

1. Lee primero la sección 1 (reglas que no se negocian) — son restricciones de seguridad, no sugerencias.
2. Lee la sección 2 (contexto técnico heredado) para entender la base real de código sobre la que se trabaja.
3. Las secciones 3 a 11 son la especificación de producto y negocio — ya está decidida, no hay que re-discutirla,
   solo construirla.
4. La sección 12 es la matriz de permisos completa — es la fuente de verdad para cada política de RLS y cada
   permiso de UI.
5. La sección 13 dice exactamente qué hacer primero, hoy, para arrancar el Hito A.

---

## 1. Reglas que no se negocian

1. **No alterar esquema, RLS, funciones, crons, variables ni despliegues de producción de Forma para este
   desarrollo.** Correcciones ordinarias de Forma (el sistema que ya usan clientas reales hoy) se gestionan por
   completo aparte, en su propio repo/sesión.
2. **Proyecto de Supabase, repos y despliegues separados** para el SaaS. VIM será el primer tenant en esa
   producción nueva. Forma se evalúa incorporar después, con migración voluntaria y ensayada — nunca antes.
3. **No copiar credenciales ni datos personales reales** a repos, staging o pruebas. Usar datos sintéticos o
   desidentificados; desactivar envíos, webhooks salientes y cargos reales en staging.
4. **No asumir que los archivos de migración de Forma representan fielmente su producción.** Ya ha pasado en este
   proyecto que el historial de migraciones aplicadas y los archivos locales no coinciden — inventariar y
   reconciliar antes de generar migraciones nuevas para el SaaS, y no repetir ese patrón en el proyecto nuevo:
   cada cambio de esquema en el SaaS se aplica **vía migración versionada**, nunca SQL suelto en el SQL Editor
   como mecanismo habitual.
5. **La documentación técnica de Forma (43 tablas, rutas, RPCs) no está auditada línea por línea contra el
   esquema real en vivo.** El primer entregable (Hito A) es verificarla, no darla por hecha.
6. **RLS y GRANT de Postgres van siempre juntos.** Una tabla nueva sin `GRANT` explícito falla en silencio con
   "permission denied" aunque la política de RLS esté bien — le ha pasado a este proyecto varias veces.
7. **Ninguna política de RLS puede referenciar la misma tabla sobre la que aplica sin pasar por una función
   `security definer`.** Una política así causó una caída completa de Forma en producción el 27 de septiembre de
   2026 (recursión infinita detectada por Postgres). Toda política nueva se prueba primero en una transacción de
   prueba (`begin; ...; rollback;`) contra un entorno no productivo antes de aplicarse.

---

## 2. Contexto técnico heredado de Forma

Esto es lo que ya existe y funciona en producción real (Forma Pilates, un solo estudio, Guatemala) — es la base
sobre la que se construye el núcleo del SaaS, adaptándola a multi-tenant, no reescribiéndola desde cero.

### 2.1 Stack

| | Forma hoy |
|---|---|
| Framework | Next.js (App Router) |
| Backend | Supabase (Postgres + Auth + Storage) |
| Hosting web | Vercel |
| App nativa | Capacitor (iOS/Android), repo separado que duplica gran parte del código del repo web |
| Email | Resend |
| WhatsApp | WhatsApp Business API |
| Pagos en línea | Recurrente (pasarela guatemalteca) |
| Push | APNs directo por JWT firmado (iOS), Firebase Cloud Messaging (Android) — dos caminos de código distintos |

### 2.2 Patrones de código a conservar en el SaaS

- **Tres variantes de cliente de Supabase:** cliente de navegador (respeta RLS), cliente de servidor (respeta
  RLS, usa cookies de sesión), cliente admin con `service_role` (salta RLS por completo, solo en rutas de
  servidor que de verdad lo necesitan). El SaaS debe mantener esta separación y, en el caso de `service_role`,
  **verificar tenant y autorización a mano en cada uso**, porque RLS no lo protege.
- **Zona horaria:** Postgres guarda todo en UTC. Forma calcula "hoy" en hora de Guatemala con
  `(now() - interval '6 hours')::date`. El SaaS **no puede fijar `UTC-6` global** — cada tenant/sede necesita su
  propia zona IANA, pero el patrón de resolver "hoy local" de forma explícita (nunca `new Date()` del servidor
  sin ajustar) se conserva.
- **Reportes de errores propios:** captura de errores de JS no atrapados, agrupados por firma con contador —
  vale la pena llevar el mismo patrón al SaaS, con `tenant_id` en cada fila.
- **43 tablas actuales de Forma**, agrupadas por dominio (núcleo de reservas, paquetes/dinero, tienda, finanzas,
  comunicación, operación, monitoreo) — inventario completo en `Forma-Pilates-Documentacion-Tecnica.md`, sección 4.
  Ese inventario es el punto de partida del Hito A, no un hecho ya verificado.

### 2.3 Bugs de clase recurrente ya vistos en Forma — no repetirlos en el SaaS

1. RLS sin GRANT base → "permission denied" en silencio.
2. `CREATE OR REPLACE FUNCTION` con firma distinta deja dos funciones vivas — hay que `DROP FUNCTION` la vieja a mano.
3. Política de RLS autorreferenciada → recursión infinita, cae toda la tabla (incidente real, ver regla 7 de la sección 1).
4. `new Date()` del servidor sin ajustar a la zona del tenant.
5. El crédito de una clase se descuenta **al reservar, no al asistir** — cualquier lógica de asistencia/check-in
   no debe volver a tocar el contador de créditos.
6. Recarga completa de página (`window.location.reload()`) dentro de una app nativa Capacitor rompe el
   enrutamiento estático — usar `router.refresh()` de Next.js.
7. Reservas huérfanas al anular un cobro, si la clienta no tiene otro paquete cubriéndolas.
8. Identificador duplicado (teléfono/correo) entre dos personas reales — el sistema debe bloquear y decir de
   quién es el dato en conflicto, no solo "no se pudo".

### 2.4 Pruebas existentes en Forma

Vitest (unitarias/integración, incluyendo pruebas específicas de RLS y de guardas de rol en RPCs) + Playwright
(E2E). Sin CI automático que las corra en cada push — el SaaS **sí necesita CI desde el día uno** para cambios
de esquema y código (ver sección 10).

---

## 3. Resumen ejecutivo y decisión de arquitectura

**Decisión:** convertir el núcleo que opera Forma Pilates en una plataforma SaaS estándar para distintos
estudios, comenzando por VIM Pilates y sus tres sedes. Cada empresa tendrá sus propios datos, marca, permisos,
medios de cobro, reglas operativas y módulos contratados. Una empresa puede tener una o muchas sedes sin
adquirir un sistema diferente.

**Protección de la operación actual:** Forma continúa en su base, despliegue y app actuales. El SaaS nace en un
proyecto, base y entornos separados. VIM será el primer tenant productivo. Incorporar Forma después exige un
ensayo de migración, reconciliación de saldos y una decisión explícita.

**Condición para lanzar VIM:** tres sedes funcionando con horarios, cupos, instructoras y asistencia propios;
administradoras limitadas a sus sedes; clientas únicas dentro de VIM; paquetes válidos para una, varias o todas
las sedes; una reserva en una sede no cubierta se rechaza desde cualquier canal; cobros conciliables a nombre de
VIM; panel de dueña consolidado y por sede.

---

## 4. Propuesta comercial y cliente objetivo

| Oferta | Cliente previsto | Configuración incluida | Forma de entrega |
|---|---|---|---|
| Estudio | Una sede | Núcleo de agenda, paquetes, cobros y panel de gestión; módulos adicionales a elección | Portal con marca y conexión a web existente |
| Cadena | Dos a cinco sedes; VIM como caso inicial | Lo anterior, agenda y personal por sede, panel consolidado, paquetes multi-sede | Portal de marca; app propia si se contrata |
| Empresarial | Seis o más sedes, requisitos especiales | Límites, integraciones, operación y soporte pactados | Propuesta y alcance propios, mismo núcleo |

**Producto estándar:** una sola base de código y un catálogo de módulos. La licencia define derechos, sedes y
límites; la configuración define qué funciones se activan y cómo; los permisos definen quién las puede usar. Ni
el plan comercial ni ocultar un botón conceden permisos sobre datos.

**Ingreso del SaaS:** cargo de implementación por alta/importación cuando corresponda, licencia mensual por
empresa y extras pactados (sedes adicionales, app de marca, integración web compleja, canales de comunicación o
soporte) — sin comisiones automáticas sobre cada clase. Los cobros de paquetes pertenecen al estudio; el SaaS
cobra su licencia por un circuito separado. Precios en quetzales, límites y niveles de servicio se definen tras
entrevistas y costos medidos — no están cotizados en este documento.

---

## 5. Producto configurable: módulos y dependencias

| Capa | Contenido | Regla de activación |
|---|---|---|
| Obligatoria | Identidad, tenants, sedes, roles, seguridad, auditoría y datos base | Siempre encendida; ninguna suspensión comercial puede desactivar aislamiento |
| Núcleo | Agenda, reservas, créditos, paquetes, cancelaciones y asistencia | Incluido según licencia; reglas y horarios configurables por empresa y sede |
| Operación | Lista de espera, horarios fijos, familia, clases privadas, congelaciones y QR | Módulos independientes con dependencias y política de suspensión |
| Cobros | Online, transferencia, caja/POS, reembolsos | Habilitar cada medio solo si su cuenta, conciliación y permisos están listos |
| Finanzas | Cierre de caja, gastos, activos, pasivos, balance, metas, IVA y FEL | Separar cada función según demanda, emisor y asesoría contable del estudio |
| Crecimiento | Tienda, inventario, descuentos, gift cards, referidos, CRM, encuestas y campañas | Activar por licencia, canal, consentimiento y proveedor de comunicaciones |
| Canales | Portal, calendario integrado, widget transaccional y app propia | Cada canal usa las mismas reservas, permisos, precios y cobros |

Se guardan por separado: `module_catalog` (capacidad y dependencias), `tenant_entitlements` (qué contrató cada
empresa), `tenant_module_settings` (estado y parámetros) y `role_permissions` (acciones autorizadas). Un override
por sede restringe o detalla un módulo habilitado para el tenant; no puede activar por sí solo algo no
contratado. Toda activación/suspensión registra actor, fecha efectiva, parámetros, motivo y versión.

Ejemplos de dependencia: pago online requiere cuenta comercial activa, checkout, webhook validado y proceso de
devolución; FEL requiere emisor y proveedor acordado; lista de espera requiere reserva y regla de avisos;
crédito provisional tras subir comprobante exige límites, vencimiento, control de rechazo y aprobador. Apagar
ventas nuevas no borra pedidos, reservas, obligaciones de devolución ni datos financieros históricos. Las rutas
API, jobs y webhooks comprueban la configuración, no solo la interfaz.

**Esta capa se construye desde el Hito B (fundación), no se pospone** — es mucho más caro agregarla después de
que ya existan tenants con configuración ad-hoc que construirla bien desde el inicio.

---

## 6. Estructura de una empresa multi-sede (caso VIM)

**Una empresa es un tenant.** Sus sedes son entidades operativas separadas con dirección, salas, capacidad,
horarios semanales, cierres, instructoras, clases, asistencia y caja propios. Una sede nueva se crea por
configuración y se prueba antes de abrirla. El sistema filtra un calendario único por sede, día, tipo de clase e
instructora, sin mezclar cupos. Una misma instructora puede estar autorizada en varias sedes, pero no en clases
simultáneas — contemplar duración y margen de traslado configurable.

**Perfiles de personal:** una dueña o gerente general ve las sedes autorizadas del tenant; una administradora o
recepcionista local ve y actúa solo en sedes asignadas; una instructora ve sus clases en las sedes donde
trabaja; una contadora recibe permiso financiero separado. La asignación de sedes es una relación de muchos a
muchos (`staff_sedes`), no una copia del usuario por local. El operador SaaS administra licencia y salud de la
plataforma, sin acceso rutinario a fichas personales ni balances del tenant.

**Clientas:** la ficha e historial son del tenant; una clienta no se duplica por visitar otra sede. Su sede
habitual es una preferencia de interfaz y segmentación, no una barrera comercial. La administradora local ve las
clientas que atiende o que tienen reservas en sus sedes; la dueña ve la ficha unificada. Búsquedas para evitar
duplicados no revelan registros de otros tenants ni datos innecesarios de otra sede. Una misma persona puede
tener identidad de acceso en dos empresas sin mezclar perfil, familia, consentimiento ni créditos.

**Alta asistida:** recepción autorizada crea una ficha con datos mínimos, sede habitual opcional y consentimiento
pendiente cuando aplique, y envía invitación para activar acceso. También registra una venta o asignación con
paquete, importe, medio de pago, sede de venta y responsable. Una cortesía o ajuste se registra como tal, con
autorización — nunca se hace pasar por dinero cobrado.

---

## 7. Paquetes válidos para una, varias o todas las sedes

El catálogo ofrece tres coberturas: **sede única**, **conjunto explícito de sedes** o **todas las sedes del
tenant**. A la venta se guarda una instantánea de la cobertura en la membresía emitida, con versión de reglas y
fecha — editar luego el catálogo no modifica en silencio derechos ya pagados. Definir si "todas" incluye sedes
futuras.

**Ejemplo:** paquete A de 8 clases solo Sede 1; paquete B de 12 clases Sede 1 y Sede 2; paquete C válido en
cualquier sede. Una clienta con sede habitual Sede 1 y paquete A puede ver Sede 2 si el estudio publica ese
calendario, pero no reservar allí. Un upgrade conserva importe, autorización y cobertura anterior/nueva. La
misma membresía nunca sirve en otro tenant.

La comprobación ocurre **dentro de la transacción** que crea la reserva y descuenta exactamente un crédito.
Aplica también a reserva por recepción, horario recurrente, lista de espera y promoción automática. Al anular o
reembolsar la compra se resuelven reservas futuras y cupos en espera; ninguna reserva sigue respaldada por un
paquete invalidado sin regla expresa. La app **no puede autorizarse a sí misma** enviando una lista de sedes —
la validación de cobertura vive en el servidor.

---

## 8. Agenda, reservas y servicio por sede

| Momento | Regla | Resultado visible |
|---|---|---|
| Configuración | Administradora crea plantilla semanal u ocurrencia para su sede, sala, instructora, capacidad y excepciones | Calendario de esa sede y vista consolidada de la dueña |
| Exploración | Clienta filtra una sede o todas; ve validez y precio del paquete | Clases disponibles y motivo de bloqueo en sede no cubierta |
| Reserva | Verificar tenant, clase, sede, cupo, membresía vigente, saldo, beneficiaria y duplicados | Confirmación; débito de un crédito al reservar |
| Espera/cancelación | Promoción y devolución según plazo y paquete elegible | Cupo libre reasignado una sola vez; ajuste en bitácora |
| Check-in | QR de sede, lista de instructora o recepción; no-show si aplica | Asistencia local; no vuelve a descontar crédito |
| Reporte | Ocupación, reservas, cancelaciones y asistencia por sede | Comparativo consolidado para dueña, solo sede para administración local |

Cancelación tardía y congelación de Forma se hacen configurables por tenant. Mantener clase privada, familia,
clase de prueba y listas de espera solo donde el módulo esté activo. Una clase no puede asignar una sala o
instructora ya ocupada; la edición de horarios respeta reservas confirmadas.

---

## 9. Qué ve cada persona (vistas de producto)

| Pantalla | Dueña | Admin. de sede | Instructora | Clienta |
|---|---|---|---|---|
| Inicio | Ingresos, cobros, ocupación, retención, alertas; filtro Todas/sede | Agenda, cupos, cobros pendientes de sus sedes | Próximas clases y asistencia propia | Próximas clases, créditos, vencimientos |
| Agenda | Todas las clases, conflictos y excepciones | Horarios, plazas y lista de espera locales | Sus clases en sedes asignadas | Calendario por sede y clases elegibles |
| Clientas | Ficha única, familias y membresías | Ficha necesaria de clientas atendidas; alta e invitación | Roster mínimo de sus clases | Sus datos y dependientes |
| Pagos | Todos los medios, pendientes, reembolsos, conciliación | Caja/transferencias de sus sedes según permiso | Sin acceso | Sus compras, recibos, pagos pendientes |
| Finanzas | Consolidado y por sede; gastos y metas | Caja e ingresos locales | Sin acceso | Sin acceso |
| Configuración | Marca, catálogo, reglas, pasarela, delegaciones | Horarios, salas, instructoras locales autorizados | Disponibilidad propia si se habilita | Preferencias y consentimientos |

La matriz de la sección 12 es la fuente específica por **acción** — esta tabla es la vista de producto; ninguna
pantalla sustituye las políticas del servidor.

---

## 10. Cobros del estudio y cobro del SaaS

Dos circuitos que **nunca se mezclan**: el estudio cobra sus paquetes y productos; la plataforma cobra al
estudio una licencia.

**Circuito A — el estudio cobra a sus clientas.** El estudio define precios, descuentos, impuestos, método de
cobro, banco y titular comercial. La plataforma conecta su cuenta de pasarela o el modelo de cuentas conectadas
que contrate; un checkout se crea con orden, importe, moneda, sede de venta y cuenta comercial del tenant. La
respuesta del navegador **no acredita pago** — webhooks firmados verifican cuenta, tenant, orden, importe y
moneda, se deduplican por evento y por operación económica, y emiten créditos una sola vez. Recurrente documenta
distintos formatos de eventos (legacy y unificados); la implementación elige uno o previene duplicidad
explícitamente. Los cobros presenciales y las transferencias son medios de primera clase: comprobante privado,
verificación humana, referencia y caja de sede — subir un archivo no equivale a dinero recibido. El crédito
provisional de primera clase (que Forma sí habilita hoy) **queda desactivado por defecto en el SaaS** hasta que
el tenant apruebe límites y manejo de impagos. Reembolsos y contracargos actualizan saldos, dinero y reservas
futuras con trazabilidad.

**Circuito B — el SaaS factura la licencia al estudio.** No se suma el dinero de las clases del estudio al
ingreso del SaaS. La factura del proveedor de software al estudio, la venta del estudio a la clienta y la
liquidación de la pasarela son tres hechos distintos. Si la facturación electrónica (FEL) integrada no está
disponible al inicio, documentar un proceso manual aprobado — el panel no debe afirmar que emitió una factura
que aún no existe.

**Finanzas operativas:** guardar sede donde se vendió, sede donde se recibió el pago y sede donde se consumió
cada clase — puede ser distinto. Mostrar venta, cobro, liquidación, clase consumida e ingreso reconocido como
métricas separadas. Una compra global usada en tres sedes es una venta, no tres.

---

## 11. Sitio, portal, widget y app propia

| Canal | Experiencia del estudio | Trabajo para la plataforma |
|---|---|---|
| Web pública existente | Conserva su contenido y diseño | Botones o calendario/precios integrados; enlaces profundos a compra o clase |
| Portal con marca | `reservas.<dominio del estudio>` si lo controla y verifica | Dominio resuelve tenant; login, catálogo, compra, reservas y panel propios |
| Widget transaccional | Reserva/pago sin salir de la web, si se contrata | Orígenes autorizados, autenticación, privacidad, accesibilidad, soporte |
| App de marca | Nombre, icono, colores, notificaciones y acceso a la cuenta del tenant | Build nativo de marca sobre backend y lógica compartidos; publicación y mantenimiento pactados |

Una app de marca **no es una copia independiente del programa** — comparte reservas, catálogo, permisos y
datos; sí tiene identificador, distribución, notificaciones y actualizaciones propios. Si la app es requisito
para la inauguración de un tenant, entra explícitamente en el hito de lanzamiento con tiempo y presupuesto
propios; de lo contrario, portal primero y app en entrega contratada posterior.

---

## 12. Matriz de permisos completa

Especificación de producto — no una constatación de que ya esté implementada. Cada fila es una acción.
**P** = solo metadatos técnicos/comerciales de la plataforma · **E** = acceso excepcional y temporal autorizado
por el estudio · **G** = todo el tenant · **S** = sedes asignadas · **I** = clases propias en sedes asignadas ·
**L** = información mínima de clientas vinculadas a la sede/clase/factura · **C** = datos propios de clienta y
dependientes autorizados · **—** = denegado. El sufijo `*` requiere delegación expresa y/o umbral de
autorización indicado en la regla. Toda celda supone que el módulo está contratado y activo y que la persona
pertenece al tenant correspondiente. **La matriz se implementa en RLS, servicios y pruebas — no solo en
navegación.**

**Decisiones de privacidad que cierra la matriz:** la sede habitual no da acceso a la ficha completa; una
administradora local consulta la información necesaria de clientas que atiende, no un directorio completo del
tenant; la instructora accede al roster mínimo, no al importe pagado; la contadora accede a datos fiscales
necesarios, no a fichas CRM. Soporte de la plataforma necesita autorización y bitácora. Ningún error de
correo/teléfono duplicado revela a una persona ajena o datos de otro estudio.

| ID | Área | Acción | SaaS | Dueña | Gte. gral. | Admin sede | Recepción | Instructora | Contadora | Clienta | Regla / límite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P01 | Plataforma | Crear / suspender tenant y gestionar plan | P | — | — | — | — | — | — | — | Operador administra contrato, módulos y límites; conserva exportación y obligaciones en suspensión. |
| P02 | Plataforma | Ver facturación SaaS y uso técnico | P | — | — | — | — | — | — | — | Sin datos personales, ventas ni ganancias del estudio; agregados técnicos mínimos. |
| P03 | Plataforma | Soporte temporal sobre datos del estudio | E | — | — | — | — | — | — | — | Aprobación del titular, motivo, alcance mínimo, caducidad, registro y revisión posterior. |
| P04 | Empresa | Editar marca, dominio y configuración general | P | G | G* | — | — | — | — | — | Operador verifica dominio; dueña configura marca; gerente solo si se delega. |
| P05 | Empresa | Crear / cerrar una sede | P | G | G* | — | — | — | — | — | Alta ligada a plan; cierre no borra transacciones ni reservas históricas. |
| P06 | Personal | Invitar personal y asignar roles / sedes | — | G | G* | S* | — | — | — | — | Admin local solo roles operativos de su sede con delegación; nunca crea dueña ni amplía su ámbito. |
| P07 | Personal | Consultar calendario de personal | — | G | G | S | S | I | — | — | Instructora ve sus clases; gerente local y recepción ven solo personal de sus sedes. |
| P08 | Personal | Asignar instructora a sedes y clases | — | G | G | S | — | — | — | — | Validar habilitación, disponibilidad, solapamientos y margen de traslado entre sedes. |
| P09 | Clientas | Crear ficha e invitar a clienta | — | G | G | S | S | — | — | C | Sede habitual es preferencia; mismo correo puede pertenecer a otro tenant sin filtrar datos. |
| P10 | Clientas | Consultar directorio completo del tenant | — | G | G | — | — | — | — | — | Consulta global solo para gestión central; local puede buscar coincidencia sin exposición ajena. |
| P11 | Clientas | Ver ficha y contacto necesarios | — | G | G | L | L | I | L | C | Local: clientas atendidas o reservadas en su sede; instructora: roster y contacto mínimo; contadora: datos de factura. |
| P12 | Clientas | Editar ficha, consentimientos y familia | — | G | G | S | S | — | — | C | Personal local limitado a datos de atención; consentimientos de menor y cambios sensibles auditados. |
| P13 | Agenda | Crear / cambiar horarios semanales | — | G | G | S | — | — | — | — | Cada horario pertenece a una sede, sala y clase; conflictos de instructora entre sedes se bloquean. |
| P14 | Agenda | Cambiar cupos, excepciones y cierres | — | G | G | S | S* | — | — | — | Reducir cupo bajo reservas confirmadas requiere resolución expresa; cambios quedan en bitácora. |
| P15 | Agenda | Ver agenda de todas las sedes | — | G | G | — | — | — | — | — | La vista consolidada respeta ámbito de rol; no otorga acceso a caja ajena. |
| P16 | Agenda | Ver agenda de sede / clases propias | — | G | G | S | S | I | — | C | La clienta ve oferta pública; cupos internos y nombres ajenos quedan protegidos. |
| P17 | Reservas | Reservar / cancelar para sí o dependientes | — | G | G | S | S | — | — | C | Comprobar pertenencia, capacidad, sede válida del paquete, créditos y política de cancelación. |
| P18 | Reservas | Reservar / cancelar por una clienta | — | G | G | S | S | — | — | — | Personal solo en sede asignada; misma validación de elegibilidad y crédito que en autoservicio. |
| P19 | Reservas | Ver listas nominales de la clase | — | G | G | S | S | I | — | — | Instructora ve únicamente sus clases; mostrar datos mínimos para el servicio. |
| P20 | Reservas | Gestionar lista de espera / promoción | — | G | G | S | S | I | — | C | Cambio de plaza atómico y elegibilidad revalidada al promocionar; clienta solo su posición. |
| P21 | Asistencia | Registrar QR, asistencia y no-show | — | G | G | S | S | I | — | C | Instructora en sus clases; QR de clienta propio; no volver a descontar créditos. |
| P22 | Asistencia | Ver reportes de asistencia / ocupación | — | G | G | S | S | I | — | C | Clienta solo su historial; instructora sus clases; local su sede; global todas. |
| P23 | Paquetes | Crear catálogo, precios y cobertura de sedes | — | G | G* | — | — | — | — | — | Definir sede única, conjunto o todas; cambios futuros no alteran membresías ya vendidas. |
| P24 | Paquetes | Vender / asignar paquete con cobro | — | G | G | S | S | — | — | C | Personal registra método y sede de venta; clienta compra solo oferta elegible y confirma pago. |
| P25 | Paquetes | Otorgar paquete gratis / ajustar créditos | — | G | G* | S* | — | — | — | — | Requiere motivo, responsable y autorización; no se presenta como venta cobrada. |
| P26 | Paquetes | Cambiar cobertura de una membresía vendida | — | G | G* | S* | — | — | — | — | Ampliación facturada/autorizada; reducción revisa reservas futuras, conserva historial. |
| P27 | Paquetes | Ver saldo y consumo de clienta | — | G | G | L | L | I | — | C | Personal local solo en contexto de atención; instructora ve elegibilidad mínima, no precio pagado. |
| P28 | Pagos | Activar pasarela y cuenta comercial | P | G | — | — | — | — | — | — | Operador verifica conexión técnica; cuenta comercial, titular y liquidación corresponden al tenant. |
| P29 | Pagos | Registrar pago presencial / transferencia | — | G | G | S | S | — | — | C | Cliente aporta comprobante; personal registra/valida caja o referencia de su sede. |
| P30 | Pagos | Aprobar transferencia y liberar créditos | — | G | G* | S* | S* | — | — | — | Separación de funciones o doble revisión según importe; comprobante subido no prueba dinero recibido. |
| P31 | Pagos | Solicitar / aprobar reembolso | — | G | G* | S* | — | — | — | C | Clienta solicita; aprobación por límite/rol; conciliación y revisión de reservas futuras. |
| P32 | Caja | Abrir / cerrar caja de sede | — | G | G | S | S | — | — | — | Turno, responsable, medio de pago y diferencias; solo caja de sedes asignadas. |
| P33 | Finanzas | Ver ingresos y conciliación consolidados | — | G | G* | — | — | — | G* | — | Distinguir venta, cobro, liquidación e ingreso reconocido; contadora según mandato. |
| P34 | Finanzas | Ver ingresos y conciliación por sede | — | G | G | S | S | — | G* | — | La caja local solo su sede; ninguna compra global se duplica al consumirse en otra. |
| P35 | Finanzas | Registrar gastos de sede | — | G | G | S | S* | — | G* | — | Separar gasto local de central y autorización; conservar responsable y soporte. |
| P36 | Finanzas | Editar activos, pasivos, balance e IVA | — | G | G* | — | — | — | G* | — | Contadora prepara y dueña valida según flujo; DTE/FEL usa emisor del tenant. |
| P37 | Finanzas | Exportar finanzas / datos fiscales | — | G | G* | — | — | — | G* | — | Exportación registrada y protegida; archivos aislados por tenant y plazo de descarga. |
| P38 | Datos | Exportar clientas y reservas nominales | — | G | G* | S* | — | — | — | C | Cliente solo sus datos; sede con autorización expresa; evitar exportación masiva por defecto. |
| P39 | Tienda | Configurar catálogo, inventario y pedidos | — | G | G | S | S | — | — | C | Clienta puede comprar y ver sus pedidos; local gestiona inventario y entregas de su sede. |
| P40 | Promos | Crear descuentos, regalos y referidos | — | G | G* | S* | — | — | — | C | Clienta usa sus beneficios; creación y excepciones sujetas a plan y aprobación. |
| P41 | CRM | Consultar riesgo y segmento de clientas | — | G | G | L | L | — | — | — | Solo clientas de atención local para roles de sede; consentimiento y minimización. |
| P42 | Marketing | Crear campaña y enviar WhatsApp/email/push | — | G | G* | S* | — | — | — | — | Solo con módulo/canal activo, audiencia autorizada, consentimiento y remitente del tenant. |
| P43 | Auditoría | Ver logs de acciones y accesos | P | G | G* | S* | — | — | — | C | Operador solo logs técnicos; sede solo acciones locales; clienta solo acciones propias si expuestas. |

---

## 13. Fases, entregables y puertas de avance

| Hito | Alcance verificable | Condición de salida |
|---|---|---|
| A. Auditoría y oferta | Inventario real de código/esquema y riesgos; entrevista a VIM; precio, app y pagos pactados | Estimación con dependencias y aceptación comercial; Forma intacta |
| B. Base SaaS | Entornos separados, tenants/sedes, dominio, roles, GRANT/RLS, matriz y provisionamiento | Dos tenants ficticios, tres sedes, ninguna fuga por rutas/API/exportaciones |
| C. Núcleo del tenant | Alta de clienta, paquetes 1/varias/todas, agenda/personal por sede, reservas, créditos, espera, asistencia y caja | Flujos de compra-reserva-check-in, dos cobros y un reembolso conciliados; pruebas negativas por sede |
| D. Portal y lanzamiento | Portal del tenant, conexión a su sitio, panel dueña/local, reportes comprometidos, pasarela propia si aplica | Ensayo con el tenant y validación de dueño/caja |
| E. Paridad y producto repetible | Resto de módulos de Forma comprometidos, panel operador, alta de terceros, observabilidad y migraciones | Nuevo estudio activado por configuración, sin ramificar código |
| F. Canales adicionales | Widget transaccional y app de marca, según contrato | Prueba web/app, tienda de apps, soporte y compatibilidad de builds |
| G. Otras disciplinas | Reglas de capacidad/equipo/disciplina configurables con cliente piloto real | Piloto pagado con caso operativo comprobado |

Los plazos se fijan tras la auditoría (Hito A) — ninguna estimación de este documento es un compromiso.

---

## 14. Pruebas de aceptación mínimas

**Seguridad:** dos tenants ficticios y VIM con tres sedes, administradora asignada a dos sedes, instructora
rotando, misma persona con correo en dos empresas, acceso excepcional de soporte. Rechazar IDs ajenos en
UI/API/DB, exportación, ficheros, QR, webhook y cron. RLS y GRANT pasan juntos por CI; no desplegar políticas
nuevas sin ensayo de transacción y rollback preparado.

**Operación:** una clienta creada por recepción adquiere paquete solo sede A; reserva A y recibe bloqueo en B;
luego adquiere paquete A+B y reserva B, con un crédito cargado una vez. Ensayar lista de espera, clase privada,
horario fijo, familias, cierre de sede, cambios de catálogo, congelación, reembolso, promoción y reservas
simultáneas por el último cupo. Verificar que una instructora en dos sedes no se programe a la vez.

**Dinero:** tres métodos de cobro según contrato, webhook duplicado o tardío, pago fallido, comprobante falso,
cierre por sede y conciliación consolidada. No duplicar ventas de paquetes globales. Probar exportaciones,
restauración ensayada y compatibilidad de la app instalada antes de abrir producción.

---

## 15. Riesgos y decisiones pendientes

| Asunto | Regla o decisión propuesta | Responsable / momento |
|---|---|---|
| Validez de paquetes | Soportar una, varias y todas las sedes; definir producto y precios reales VIM | VIM, antes de configurar catálogo |
| Reportes financieros | Consolidado y por sede; decidir reparto de paquetes y gastos centrales | VIM y contadora, antes de pruebas de cierre |
| Pasarela y caja | Titular de cuenta, medio por sede, comisiones, contracargos y liquidaciones | VIM y proveedor, antes de desarrollo de checkout |
| App de marca | Requisito de salida o entrega posterior; cuenta de publicación y mantenimiento | VIM y Andrés, antes de cerrar cronograma |
| Módulos del lanzamiento | Lista firmada de must-have frente a resto Forma y canales adicionales | VIM y Andrés, antes de cotizar |
| Precio y planes | Implantación, licencia, sede extra, app, mensajes, soporte y límites | Andrés, antes de oferta comercial |
| Datos previos | Existencia, calidad, autorización y conciliación de saldos | VIM, antes de importar |
| Emisión fiscal | Emisor, certificador y proceso manual temporal si falta integración | VIM y contadora, antes de recibir ventas |
| Suspensión / salida | Retención contractual, exportación, saldos, obligaciones y migración de datos | Andrés y VIM, antes de firma |

---

## 16. Empieza aquí — Hito A, primer paso concreto

Si estás retomando este proyecto ahora mismo, esto es literalmente lo primero que se hace, antes de escribir
una sola línea de producto nuevo:

1. **Crear el proyecto de Supabase nuevo** para el SaaS (staging primero) — separado por completo del proyecto
   de Forma. Anotar su `project ref` y credenciales en un lugar seguro, nunca en el repo.
2. **Crear el repo nuevo** (o rama/línea de desarrollo claramente separada) para el SaaS.
3. **Correr el inventario de auditoría** contra el código y la base real de Forma (no contra la documentación
   por sí sola):
   - Exportar el esquema real (`pg_dump --schema-only` o el `db dump` de Supabase CLI) y compararlo con
     `supabase/migrations/*.sql` de Forma para detectar el desajuste ya conocido entre migraciones y estado
     aplicado.
   - Listar cada tabla, RPC, política RLS y GRANT real con una consulta a `information_schema` y `pg_policies` —
     no confiar solo en el inventario de 43 tablas del documento técnico.
   - Marcar qué tablas/RPCs se necesitan para el núcleo del Hito C (clientes, horarios, reservas, membresías,
     lista_espera, pagos básicos) vs. el resto.
4. **Diseñar y migrar el esquema base multi-tenant** (Hito B): `tenants`, `tenant_domains`, `sedes`,
   `tenant_memberships`, `staff_sedes`, `module_catalog`, `tenant_entitlements`, `tenant_module_settings`,
   `role_permissions` — antes de tocar cualquier tabla de negocio.
5. **Escribir las políticas de RLS de aislamiento por tenant primero**, probarlas en transacciones de prueba
   (`begin; ...; rollback;`) con dos tenants ficticios, y solo entonces aplicarlas.
6. **No avanzar al Hito C** (núcleo funcional para VIM) hasta que el Hito B pase su condición de salida: dos
   tenants ficticios, tres sedes, cero fugas de datos entre ellos, verificado con pruebas automatizadas.

---

## 17. Fuentes

- `Forma-Pilates-Documentacion-Tecnica.md` (28/09/2026) — documentación técnica real de Forma Pilates.
- `Plan_Maestro_Forma_SaaS_VIM_2026.md` / `.pdf` y `Matriz_permisos_Forma_SaaS_VIM.xlsx` (28/09/2026) — plan de
  negocio, producto y matriz de permisos.
- Supabase, «Row Level Security»: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase, «API keys»: https://supabase.com/docs/guides/getting-started/api-keys
- Recurrente, «Cuentas conectadas»: https://docs.recurrente.com/guias-espanol/guias/cuentas-conectadas
- Recurrente, «Webhooks»: https://docs.recurrente.com/guias-espanol/comenzar/webhooks
- Apple, «Directrices de App Review», regla 4.2.6: https://developer.apple.com/app-store/review/guidelines/es/

**Uso de este documento:** sirve para decidir, vender, contratar y **empezar a construir**. Cada acción de la
matriz de la sección 12 se convierte en políticas de RLS, servicios y pruebas. Los compromisos de precio y
alcance con VIM se cierran con las decisiones de la sección 15 y una cotización basada en la auditoría real del
Hito A.
