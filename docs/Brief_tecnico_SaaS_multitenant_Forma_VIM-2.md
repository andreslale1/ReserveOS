# Encargo técnico: convertir Forma en una plataforma SaaS multiestudio

**Fecha:** 28 de septiembre de 2026  
**Destinatario:** programador responsable / equipo de desarrollo  
**Producto de referencia:** Forma Pilates  
**Primer cliente del nuevo SaaS:** VIM Pilates Studio, tres sedes  
**Tipo de documento:** especificación de alcance y criterios de entrega; se debe validar contra los repositorios y la base reales antes de estimar plazos.

## 1. Objetivo y decisión de arquitectura

Construir una plataforma SaaS que ofrezca a estudios independientes las capacidades ya documentadas en Forma Pilates: reservas, paquetes con créditos, lista de espera, cuentas familiares, clases privadas, asistencia QR, pagos online y manuales, tienda, promociones, CRM, comunicaciones y finanzas. Cada empresa o **tenant** tendrá marca, dominio, datos, personal, configuración, pasarela y reportes propios. Un tenant puede tener una o muchas **sedes**.

VIM debe poder operar sus tres sedes como **una empresa**: clientas y sus paquetes a nivel VIM, agendas y asistencia por sede, reportes consolidados y desglosados. La validez de cada paquete entre sedes es configurable y queda pendiente de decisión de VIM.

La distribución del SaaS tendrá tres canales que consumen el mismo núcleo: (1) portal web con marca y dominio del estudio; (2) componentes integrables en su web, empezando por calendario y precios; (3) app nativa de marca como opción comercial. VIM puede tener una app llamada **VIM Pilates**, pero no se debe mantener una copia independiente y divergente de todas las reglas de negocio para cada cliente.

**Decisión obligatoria para proteger Forma:** no hacer la conversión sobre la base de datos ni el despliegue web/app que hoy atienden a las clientas de Forma. Crear repositorio o línea de desarrollo del SaaS, proyectos Supabase propios para staging y producción del SaaS, y despliegues independientes. VIM será el primer tenant real en esa nueva producción. Forma seguirá en su instalación actual y se evaluará su incorporación al SaaS después de validar VIM. Esta decisión sustituye el orden inicial que suponía migrar Forma primero.

## 2. Límites de intervención y evidencia inicial

1. No alterar esquema, RLS, funciones, cron, variables ni despliegues de producción de Forma para desarrollar este proyecto. Correcciones ordinarias de Forma se gestionan por separado.
2. No copiar credenciales ni datos personales reales al repositorio, staging o pruebas. Si una prueba necesita forma de datos realista, usar datos sintéticos o una copia debidamente desidentificada; desactivar envíos, webhooks salientes y cargos en staging.
3. No asumir que los archivos de migración representan fielmente producción. La documentación informa posibles desajustes entre migraciones y estado aplicado. Inventariar y reconciliar ese estado antes de generar migraciones nuevas. No usar `db push` a ciegas ni aplicar SQL improvisado en producción como mecanismo habitual.
4. El MD técnico describe dos repositorios de Forma, web y app Capacitor, que comparten Supabase pero duplican gran parte del código. Auditar las diferencias reales entre ambos y definir cómo compartir módulos sin romper la app vigente de Forma.
5. La documentación enumera **43 tablas** y funciones, pero este encargo no da por auditado su esquema real ni certifica cobertura exacta de las pruebas existentes. El primer entregable es el inventario verificable.
6. Preparar estimación de tiempo y costo por fase **después de la auditoría**. Separar en el presupuesto el núcleo SaaS, integración web VIM y app nativa VIM.

## 3. Entregable inicial de auditoría

Presentar antes de programar una matriz por tabla, vista, RPC, trigger, Edge Function, ruta API, archivo/storage, exportación y tarea programada con:

- nombre, repositorio, propósito, dependencias y volumen aproximado;
- propietario lógico de cada dato: global de plataforma, tenant, sede o usuario;
- operaciones y roles autorizados; estado actual de GRANT y RLS;
- uso de `service_role` o funciones `security definer`, y autorización efectuada antes de ejecutarlas;
- posibles referencias fijas a Forma: dominio, marca, bancos, correos, zona horaria, claves de pasarela, textos y URLs;
- llamadas desde web y app nativa; compatibilidad al modificar firmas de RPC;
- pruebas existentes y huecos de cobertura;
- impacto de la migración y prioridad de implementación.

Revisar expresamente los módulos documentados: `clientes`, `perfiles`, `horarios`, `reservas`, lista de espera, `paquetes`, `membresias`, pagos, tienda y pedidos, gift cards, descuentos, gastos, activos, pasivos, balance, metas, caja, comunicación, configuraciones, logs, salud y más de 25 exportaciones descritas. Registrar cualquier discrepancia entre MD y código, sin completarla por suposición.

**Entregar:** diagrama real de dependencias, esquema y políticas exportadas, lista de cambios, riesgos, plan de migraciones y presupuesto por hitos.

## 4. Modelo mínimo de datos del SaaS

Adaptar el esquema existente en vez de replicar estas entidades ciegamente. Se esperan, como mínimo, los siguientes conceptos:

| Concepto | Datos y reglas |
|---|---|
| `tenants` | ID, nombre, estado, plan, moneda, zona IANA, identidad de marca, configuración y titular fiscal. |
| `tenant_domains` | Dominios únicos, verificados, canónicos y asociados a exactamente un tenant activo. |
| `sedes` | ID y `tenant_id`, dirección, horarios, capacidad, salas/equipo, configuración local y estado. |
| `tenant_memberships` | Relación de `auth.users` con tenant y roles; un mismo correo puede estar en más de un estudio. |
| `staff_sedes` | Asignación de personal a cero, una o varias sedes dentro de su tenant. |
| `clientes` | Perfil de clienta por tenant, consentimientos, contacto, dependientes y vínculo opcional a usuario global. |
| `paquetes` y `membresias` | Catálogo por tenant, créditos, vigencia, elegibilidad de sedes, congelación y saldo. |
| `horarios`, ocurrencias y `reservas` | Clase, sede, sala, instructora, capacidad, excepciones, estado, clienta, paquete y consumo de crédito. |
| `ordenes`, `pagos`, `transacciones` | Importe fijado al comprar, tenant, cuenta comercial, sede de venta, proveedor, identificadores externos, estados y devoluciones. |
| `payment_connections` | Proveedor/cuenta por tenant y, solo si se requiere, por sede; referencias a secretos protegidos. |
| `movimientos_creditos` | Trazabilidad de emisión, reserva, devolución, penalización, expiración, ajuste y reversión. |
| configuración operativa | Tarifas, reglas, canales, plantillas, feature flags, configuración financiera y fiscal por tenant. |

Definir `tenant_id` en los registros de negocio, incluidos gastos, tienda, campañas, almacenamiento, logs funcionales, exportaciones y colas; `sede_id` en hechos locales como clase, check-in y cierre. No agregar `sede_id` indiscriminadamente al paquete si es válido en toda la empresa: representar su **regla de elegibilidad** por separado. Las entidades globales de plataforma y `auth.users` son excepciones documentadas.

Crear restricciones que impidan relaciones cruzadas incluso cuando una ruta omita un filtro. Ejemplo: una reserva de VIM no puede referenciar un horario de Forma ni una membresía de otro tenant. Definir claves/índices compuestos o validación transaccional equivalente, índices por `tenant_id` y fecha, y unicidad apropiada al tenant (teléfono/cliente, códigos, referencias). Nunca tomar el `tenant_id` enviado por el navegador como autorización suficiente.

### 4.1 Producto estándar y módulos configurables

**Una base de código, un modelo de datos y un catálogo de módulos para todos los estudios.** Dar de alta a VIM o a un estudio de una sede debe consistir en configurar la plataforma, no en crear una variante del software. Separar cuatro conceptos: (a) *capacidades disponibles en el producto*; (b) *derechos contratados por el tenant*; (c) *módulos activados en ese tenant*; (d) *permisos de cada usuario*. Una función aparece y funciona solo cuando las cuatro condiciones se cumplen, además de las reglas propias de la sede y de la operación. El plan comercial establece límites o derechos, pero no sustituye los permisos ni la configuración.

| Área del catálogo | Base o módulo opcional | Configuración por tenant y, cuando corresponda, sede |
|---|---|---|
| Identidad, aislamiento, sedes, roles y auditoría | Base obligatoria | Una o muchas sedes; marca, dominio, zona horaria, responsables y ámbito de personal. |
| Agenda, reservas, cupos, créditos y cancelaciones | Base operativa | Reglas de paquetes, elegibilidad por sede, no-show, horarios fijos y ventanas de cancelación. |
| Lista de espera, clases privadas, familia y congelaciones | Opcional por función | Activación y política propias; conservar los datos ya creados al suspender la función. |
| Cobros presenciales, transferencia, pago online y reembolsos | Medios de cobro configurables | Pasarela/cuenta del estudio; banco y caja; medios admitidos por sede cuando aplique. |
| Caja, gastos, activos, pasivos, balance, IVA/FEL, reportes | Módulos financieros separados | Centros de costo, permisos contables, cierre y tratamiento fiscal propio; reportes consolidados y por sede. |
| Tienda, productos, gift cards, descuentos y referidos | Opcional por módulo | Catálogo y reglas del estudio; inventario y atribución por sede si se contrata. |
| CRM, campañas, WhatsApp, email, push y encuestas | Opcional por canal/función | Remitentes, consentimiento, presupuesto, plantillas, proveedores y frecuencias. |
| Web de marca, widget y app de marca | Canales comerciales separados | Dominio, orígenes autorizados, identidad gráfica, distribución y soporte de la app. |

Mantener un **registro de módulos** con clave estable, versión, dependencias, nivel permitido (`tenant` o `sede`), límites, estados y política de suspensión. Guardar **licencias/entitlements** (plan y extras contratados) aparte de `tenant_module_settings` (activación, parámetros, actor y fecha). Los parámetros de sede solo pueden restringir o concretar una función habilitada para el tenant; nunca habilitar un módulo no contratado. Un mismo estudio puede activar pago online y tienda, desactivar campañas, usar paquetes globales y asignar horarios distintos en cuatro sedes. Un estudio de una sede usa el mismo esquema y las mismas pantallas filtradas, sin código exclusivo.

**Dependencias explícitas:** pago online necesita cuenta comercial conectada, webhook verificado y configuración de reembolso; crédito provisional por transferencia exige transferencia, límites y aprobación; lista de espera exige reservas y avisos; gift cards exige ventas y reglas de emisión; facturación electrónica exige datos fiscales y proveedor acordado. Si falta una dependencia, la activación debe fallar con una explicación en el panel. La disponibilidad de un medio de cobro también depende de que su cuenta esté operativa; mostrar otros medios disponibles o impedir la compra sin crear créditos gratis.

**Gobierno de cambios:** el operador SaaS define catálogo, planes, licencias, límites y excepciones; la dueña configura únicamente reglas y medios dentro de lo contratado; gerencia de sede ajusta solo su sede y según permiso. Registrar quién activó, cambió o suspendió cada módulo, con motivo, versión de configuración y fecha efectiva. Probar cambios primero en staging y poder hacer rollback de la **configuración**; si cambió el esquema, aplicar migraciones comunes y reversibles. El sistema debe validar módulos y permisos en backend/API, consultas, webhooks y tareas programadas: ocultar un botón no desactiva una capacidad.

**Suspensión y baja:** desactivar ventas o reservas nuevas puede requerir mantener clases ya vendidas, reservas futuras, reembolsos, exportaciones y comprobantes. Definir por módulo si la suspensión bloquea altas, ejecución futura o uso completo; no borrar historial financiero ni impedir atender obligaciones ya creadas. Los cambios de plan al superar un límite deben generar aviso y regla explícita (periodo de gracia, solo lectura o bloqueo de nuevas altas), nunca eliminar datos. Los jobs de mensajería de un canal desactivado deben detener nuevos envíos sin perder registro de comunicaciones anteriores. Mantener auditoría y acceso de exportación durante la retención contractual.

**Prueba de producto:** dar de alta tres tenants ficticios solo por configuración: uno con una sede y caja/transferencia; VIM con tres sedes, paquetes globales y cobro propio; y uno con cuatro sedes, paquetes locales y marketing apagado. Comprobar permisos, dependencias, límites, suspensión/reactivación, historiales, jobs y paneles en los tres. La configuración inicial concreta de VIM se cierra con VIM y se documenta como plantilla de alta, nunca como una bifurcación del código.

## 5. Identidad, dominios, permisos y seguridad

### Contexto y acceso

- El portal resuelve un dominio verificado a tenant. `reservas.vim.com.gt` muestra VIM; una URL desconocida no debe caer en Forma. El `proxy.ts` actual de Forma contiene un dominio canónico fijo y debe rediseñarse **en el proyecto nuevo**.
- La app VIM lleva una configuración de marca/tenant; el backend comprueba esa identidad contra sesión, pertenencia y autorización. El nombre de app o el hostname no confiere permisos.
- Login, registro, invitaciones, recuperación y enlaces por correo deben regresar al dominio correcto del estudio. El usuario puede tener acceso a dos empresas con el mismo correo sin mezclar perfiles, consentimiento, familia ni créditos.
- Roles configurables: super-admin de la plataforma, dueña del tenant, gerencia multi-sede o de sede, recepción/caja, instructora, contadora con ámbito limitado y clienta. Definir permisos de **ver, crear, modificar, exportar, reembolsar y administrar** por recurso.
- Soporte SaaS con acceso excepcional, temporal, registrado y autorizado; no dejar a todos los desarrolladores con acceso rutinario a fichas personales de los estudios.

### Defensa en profundidad

- Implementar **GRANT y RLS**, ambos, para tablas expuestas. Revisar SELECT, INSERT, UPDATE y DELETE, además de políticas `WITH CHECK` para escrituras.
- Auditar vistas, RPC, funciones `security definer`, storage, rutas API, webhooks, exportaciones y crons. Evitar políticas recursivas. Fijar `search_path` y limitar ejecución de funciones privilegiadas.
- Cualquier uso de `service_role`/clave secreta omite RLS: verificar identidad, tenant y autorización antes de leer o escribir; mantener la clave solo en servidor.
- Incorporar pruebas negativas con dos tenants y tres sedes: intentar acceder a IDs ajenos por URL, consultas, exportaciones, imágenes, QR, API y callbacks.
- Restringir datos en caché y archivos por tenant; las métricas o páginas con información privada no pueden reutilizar una respuesta de otro dominio o sesión.

**Criterio bloqueante:** ninguna página, función, exportación, job o webhook de VIM puede ver o alterar datos de Forma ni de un tercer estudio; el personal de una sede no administra otra sin asignación explícita.

## 6. Flujos operativos a conservar y generalizar

La migración funcional debe mantener las reglas documentadas de Forma, con variaciones configurables por tenant:

1. **Agenda:** clases recurrentes, clases únicas, fechas canceladas o privadas, horario fijo, instructora, sala, cupo y sede.
2. **Reserva atómica:** comprobar tenant, sede habilitada, capacidad, paquete, vigencia y saldo; descontar **un crédito al reservar**, no al asistir; impedir sobreventa y doble reserva concurrente.
3. **Cancelación:** aplicar plazo configurable, devolver crédito cuando corresponde, penalizar cancelación tardía y liberar cupo. Mantener trazabilidad de ajustes.
4. **Lista de espera:** cola por clase/sede, promoción automática al liberarse un cupo, vencimiento y notificación sin promover dos personas al mismo lugar.
5. **Asistencia:** check-in QR de la sede y marcación del staff; ventana horaria y estado de no-show; no volver a descontar créditos.
6. **Membresías:** compra, renovación, congelación de vigencia, expiración, descuentos, clases de prueba, paquetes multi-sede y familiares/dependientes.
7. **Clases privadas y eventos:** conservar la lógica documentada de privatización de fechas; cursos/vídeo/alquiler de salas se consideran futuros módulos si se venden a un cliente real y se presupuestan aparte.
8. **Cobro anulado:** cancelar o reasignar de forma explícita reservas futuras financiadas por el paquete anulado; no dejar reservas huérfanas.
9. **Compra provisional por transferencia:** Forma documenta habilitar una primera clase al subir comprobante. En el SaaS esta regla queda **desactivada por defecto**; si VIM la solicita, configurar límite, vencimiento, evidencia, aprobación y tratamiento del rechazo. No confundir comprobante con dinero recibido.

La dueña de VIM decidirá si un paquete funciona en todas sus sedes o solo en algunas. El sistema debe poder representar ambos casos sin ramificaciones de código exclusivas de VIM.

## 7. Vistas del producto

### Dueña de VIM

Un panel VIM con filtro persistente **Todas / Etú Plaza / Plaza Decorísima / Vista Hermosa**:

| Área | Consolidado | Vista por sede |
|---|---|---|
| Inicio | Ventas, dinero recibido, reservas, ocupación, clientas activas, retención y alertas | Los mismos indicadores de esa sede. |
| Agenda | Clases de las tres sedes y conflictos | Cupos, instructoras, listas de espera y excepciones locales. |
| Asistencia | Asistencia, cancelaciones y no-show comparados | QR, lista de clase y resolución manual. |
| Clientas | Historial unificado VIM, familia, saldo, riesgo de fuga | Clases utilizadas en esa sede. |
| Membresías | Paquetes, pendientes, activas, congeladas, expiradas y créditos | Distribución y uso local; no duplicar el saldo global. |
| Pagos | Online, transferencias pendientes, tarjeta/efectivo en sede, refunds y diferencias | Caja de la sede y cobros atribuidos. |
| Finanzas | Ingresos, gastos, activos, pasivos, balance, IVA, cuentas pendientes, metas y exportaciones | Gastos imputados, cierre y rentabilidad local. |
| Marketing | Comunicados, WhatsApp, correo, satisfacción, referidos, promociones y campañas | Segmentos y rendimiento local. |
| Configuración | Marca, dominios, paquetes, finanzas, medios de pago, permisos | Horarios, cupos, salas, equipo y cierres. |

Las etiquetas financieras deben definir **venta, cobro, liquidación, clase consumida e ingreso reconocido** por separado. Conservar sede de adquisición/venta, sede de cobro si existe y sede de uso. Una compra global seguida de tres reservas en sedes distintas es una venta, no tres ventas. Los cálculos contables y fiscales finales se revisan con la contadora y configuración de cada empresa.

### Equipo de VIM

- Gerencia general: tres sedes y permisos delegados.
- Gerente local/recepción: agenda, clientas y caja de sedes asignadas; acciones manuales auditadas.
- Instructora: sus clases y clientas pertinentes, asistencia y avisos; sin acceso a balances o datos clínicos ajenos a su función.
- Contadora: finanzas y exportaciones autorizadas, con acceso restringido a datos personales.

### Clienta VIM

Una sola cuenta VIM para elegir sede o calendario conjunto; registrar dependientes; comprar paquete, ver validez, vigencia, créditos y comprobantes; reservar/cancelar, entrar en espera, hacer check-in, ver historial; tienda, gift cards, referidos y comunicaciones cuando esos módulos estén habilitados. La cuenta VIM no muestra su actividad en Forma aunque use el mismo correo en ambos estudios.

### Operador SaaS

Panel separado para crear tenants, dominios, sedes iniciales, planes, licencias, configuración de marca, estado de integración, uso, incidentes, soporte y facturación B2B. Nunca sumar ingresos de las clases como ingresos del SaaS. La dueña VIM ve su negocio, no la lista de otros tenants.

## 8. Pagos y conciliación por empresa

Separar dos circuitos: **VIM vende clases y productos a sus clientas**; **la plataforma cobra a VIM una licencia**. No mezclar titulares de fondos, saldos ni facturación.

1. Modelo de orden: guardar importes, moneda, descuentos, impuesto, paquete/producto, cliente, tenant, sede de venta y estado antes de redirigir a un proveedor.
2. Conector abstracto: `createCheckout`, `getPayment`, `verifyWebhook`, `refund` cuando exista, `reconcile`. Cada tenant elige medios habilitados: pasarela, transferencia, caja/POS. Un proveedor se integra una vez y se configura por estudio.
3. VIM conecta su propia cuenta comercial. Si el proveedor ofrece cuentas conectadas para plataformas, evaluar esa modalidad y dejar por escrito titularidad, comisiones, liquidación, refunds y obligaciones de cada parte. En Recurrente, los checkouts de cuentas conectadas usan identificador de cuenta; confirmar contrato y activación con el proveedor.
4. Webhook: comprobar firma, cuenta externa, tenant, orden, monto y moneda; deduplicar por evento **y** operación económica; confirmar pago y emitir créditos dentro de una operación idempotente. La URL de retorno del navegador nunca es prueba de pago.
5. Recurrente documenta webhooks legacy y unificados que pueden llegar por el mismo pago. Elegir un formato de eventos o impedir explícitamente doble procesamiento.
6. Transferencias: banco de VIM por tenant, comprobante privado, revisión del staff y aprobación auditada; no marcar ingreso recibido con el mero upload.
7. Caja: sede, turno, responsable, referencia externa y cierre; conciliar con POS/banco/pasarela. Guardar comisiones y liquidación separadas del valor bruto.
8. Reembolso, disputa, contracargo y anulación: ajustar dinero y créditos con trazabilidad; revisar reservas futuras. No borrar registros de ventas para corregir cifras.
9. FEL: almacenar emisor y datos fiscales por tenant, estado y referencias DTE; integrar certificador cuando esté definido. La factura de VIM al cliente y la factura SaaS a VIM son documentos distintos.

## 9. Web, widget y app de marca

### Web VIM

- Conservar `vim.com.gt` como sitio público. Crear portal VIM en `reservas.vim.com.gt` o dominio acordado. Los botones actuales enlazan horarios, compra y reserva.
- Fase 1 de integración: calendario y precios públicos integrables, con filtros de sedes; al necesitar login/checkout, abrir la ruta canónica del portal y mantener contexto de clase/sede. Fase 2 opcional: widget de reserva y pago completamente integrado, después de resolver autenticación en webs ajenas, compatibilidad y soporte.
- Ofrecer componentes integrables a otros estudios sin exponer `service_role` ni secretos. Lista de orígenes permitidos, controles de abuso y diseño accesible.
- El dominio resuelve marca y tenant; no se hardcodean VIM, bancos o rutas en el frontend. Configurar callbacks de Auth, correos y enlaces bajo el dominio correcto.

### App VIM Pilates

- Opción comercial con icono, nombre, splash, colores, bundle ID y enlaces propios de VIM, conectada al mismo tenant y backend. Puede incluir push, QR, biometría y calendario como la app documentada de Forma.
- Extraer lógica compartida entre web y app. Mantener un proceso de compilación configurable por marca; no copiar y editar el código completo para cada estudio. Un build nativo sigue teniendo configuración y ciclo de revisión propios.
- Asociar tokens APNs/FCM a tenant, app, dispositivo y entorno; las notificaciones nunca salen con la identidad de otro estudio. Revisar versión mínima y compatibilidad de RPC entre web y builds instalados.
- Para una app VIM separada preparada por una plataforma comercial, acordar con VIM la cuenta y la presentación en App Store según las reglas de Apple para apps basadas en plantillas. No prometer publicación garantizada.
- La app de Forma existente continúa sobre su sistema hasta una migración futura acordada.

## 10. Tareas automáticas, comunicaciones y monitoreo

Migrar cada cron documentado: recordatorios de clase y confirmación, prueba, horario fijo, inactividad, password, asistencia, inasistencia, aviso operativo, lista de espera, liberación de cupos, membresía por vencer, nudge, conciliación y salud. Cada ejecución debe indicar tenant, procesar un lote acotado, aplicar zona IANA y política de ese estudio, ser reintentable e idempotente, y registrar fallos sin bloquear el resto. No fijar `UTC-6` globalmente aunque VIM y Forma operen hoy en Guatemala.

Configurar canales y remitentes por tenant: email, WhatsApp y push; plantillas, preferencias, consentimiento, baja, costos y métricas. Los comunicados, testimonios, encuestas y riesgo de fuga de un tenant no se mezclan con otro. Al usar un proveedor común para todos, definir aislamiento lógico, límites de volumen y respuesta ante fallas. Separar el monitoreo de salud por tenant del estado global del SaaS.

## 11. Pruebas, CI y puesta en marcha

Automatizar pruebas de DB/RLS, funciones, integración y E2E con datos ficticios. El MD informa que hay Vitest y Playwright pero no CI garantizado por push: configurar CI para cambios de esquema y código. Probar como mínimo:

- dos tenants, tres sedes de VIM, misma persona/correo en dos empresas y empleados asignados a más de una sede;
- toda ruta de lectura, escritura, exportación, storage, QR, servicio y cron contra IDs de otro tenant;
- dos reservas simultáneas para el último cupo, dos cancelaciones, lista de espera y crédito debitado exactamente una vez;
- pagos fallidos, pendientes, aprobados, callbacks duplicados/desordenados, reembolso, disputa y transferencia con comprobante falso;
- reserva provisional aprobada/rechazada, membresía congelada, no-show y anulación de cobro con reservas futuras;
- reportes consolidados vs. sedes y conciliación con venta, cobro y consumo distintos;
- enlaces de login/recuperación, emails y push desde web y app VIM sin saltar a Forma;
- migraciones repetibles, compatibilidad del binario de app instalado, respaldo y restauración **ensayada**;
- alta de un tercer estudio ficticio únicamente mediante configuración, sin cambios de código.

En staging, usar sandbox de pasarela y destinos de comunicación de prueba. Nunca lanzar pruebas E2E que envíen correos a contactos de producción o hagan cargos reales. Verificar el plan de backups y recuperación del nuevo SaaS antes de recibir pagos.

### Hitos y criterios de aceptación

| Hito | Entrega revisable | Puerta de avance |
|---|---|---|
| A. Auditoría | Inventario, riesgos, esquema real y estimación por fase | Aprobación del alcance técnico; Forma permanece intacta. |
| B. Base SaaS | Entornos separados, migraciones reproducibles, tenants/sedes/roles, dominio y RLS | Matriz de acceso cruzado automatizada sin fugas. |
| C. Núcleo de Forma | Reservas, créditos, pagos, caja, CRM, finanzas y tienda configurables | Flujos funcionales en dos tenants ficticios. |
| D. VIM web | Tres sedes, portal de marca, web enlazada, cobro VIM e importación autorizada | Ensayo completo y conciliación en staging. |
| E. Lanzamiento VIM | Checklist de producción, soporte y monitoreo; validación operativa con VIM | VIM vende y reserva sin afectar Forma. |
| F. Widget / app | Integración embebida avanzada y app VIM, si se contrataron | Pruebas de canales, publicación y soporte definidos. |

Entregar al final: código, migraciones, documentación de arquitectura, matriz de permisos, manual de alta de tenant, manual de incidencias y reversión, prueba de restauración, dashboard de salud y una demostración operativa. No cerrar el proyecto solo porque VIM pueda hacer una reserva: debe poder **cobrar, conciliar, operar y reportar** en sus tres sedes.

## 12. Decisiones de negocio que requieren respuesta de Andrés y VIM

Estas preguntas no bloquean la auditoría ni el núcleo de aislamiento. Resolverlas antes de terminar el módulo correspondiente:

1. ¿Los paquetes de VIM son globales, por sede o existen ambos tipos? ¿Cómo se asigna económicamente el uso entre sedes?
2. ¿Las tres sedes usan una cuenta de pasarela/banco o cuentas y cierres separados? ¿Qué proveedor contractual usará VIM?
3. ¿VIM acepta un crédito provisional por comprobante sin verificar? ¿Cuál es el límite y quién aprueba?
4. ¿Cuáles son sus paquetes, cupos, cancelaciones, no-show, horarios fijos y reglas de clases privadas?
5. ¿Qué datos actuales de VIM hay que migrar, quién los autoriza y cómo se validan saldos de clases pendientes?
6. ¿Qué indicadores financieros desean por sede y qué gastos centrales necesitan repartir? ¿Quién emite FEL y con qué certificador?
7. ¿Necesitan la app VIM en el lanzamiento o en una segunda entrega? ¿Bajo qué cuenta se publicará y quién asume sus actualizaciones?
8. ¿Qué canales de email, WhatsApp y push son necesarios al inicio? ¿Quién paga el consumo de mensajes?
9. ¿Cuánto se cobrará por implementación, licencia mensual, sedes adicionales, widget y app? ¿Qué soporte y exportación se pactan al terminar?

## 13. Fuentes y notas para el equipo

- Documento aportado: `Forma-Pilates-Documentacion-Tecnica.md`, actualizado el 28/09/2026. Fuente de las funciones actuales descritas, sujeta a contraste con código y base.
- Supabase, entornos y migraciones: https://supabase.com/docs/guides/deployment/managing-environments
- Supabase, GRANT y RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase, claves con privilegios: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase, respaldos: https://supabase.com/docs/guides/platform/backups
- Recurrente, cuentas conectadas: https://docs.recurrente.com/guias-espanol/guias/cuentas-conectadas
- Recurrente, webhooks y coexistencia de formatos: https://docs.recurrente.com/guias-espanol/guias/migrar-a-webhooks-unificados
- Vercel, arquitectura de plataformas multi-tenant: https://vercel.com/changelog/introducing-vercel-for-platforms
- Apple, revisión de apps creadas con plantillas comerciales: https://developer.apple.com/app-store/review/guidelines/es/

**Resumen para decidir:** desarrollar el nuevo producto desde Forma sin tocar su producción; demostrar el multi-tenant con VIM y tres sedes en un proyecto separado; incorporar Forma a la plataforma común solo después de una migración voluntaria y ensayada.
