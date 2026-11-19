---
title: "Forma SaaS | Plan maestro de negocio y producto"
subtitle: "Plataforma de gestión para estudios boutique · VIM como primer tenant, tres sedes"
author: "Documento de trabajo para socios y desarrollo"
date: "28 de septiembre de 2026"
lang: es-GT
---

# Resumen para socios

**Decisión:** convertir el núcleo que opera Forma Pilates en una plataforma SaaS estándar para distintos estudios, comenzando por VIM Pilates y sus tres sedes. Cada empresa tendrá sus propios datos, marca, permisos, medios de cobro, reglas operativas y módulos contratados. Una empresa puede tener una o muchas sedes sin adquirir un sistema diferente. El sitio público de VIM podrá conectar con su portal de reservas; una app llamada VIM Pilates podrá utilizar el mismo núcleo si se contrata y planifica su entrega.

**Protección de la operación actual:** Forma continúa en su base, despliegue y app actuales. El SaaS nace en un proyecto, base y entornos separados. VIM será el primer tenant productivo de la nueva plataforma. Incorporar Forma después exige un ensayo de migración, reconciliación de saldos y una decisión explícita; no se cambia su producción para desarrollar el SaaS.

**Estado de la evidencia:** las funciones actuales de Forma se describen en `Forma-Pilates-Documentacion-Tecnica.md` (28/09/2026), no mediante una auditoría completa de repositorios, políticas y base en vivo. La documentación informa 43 tablas y dos repositorios web/app con una base Supabase compartida. Ningún porcentaje de reutilización ni plazo fijo se presenta como estimación validada. Todo lo marcado «existente en Forma» necesita contraste técnico antes de presupuestarlo como reutilizable.

**Condición para lanzar VIM:** tres sedes funcionando con horarios, cupos, instructoras y asistencia propios; administradoras limitadas a sus sedes; clientas únicas dentro de VIM; paquetes válidos para una, varias o todas las sedes; una reserva en una sede no cubierta se rechaza desde cualquier canal; cobros conciliables a nombre de VIM; panel de dueña consolidado y por sede. El método de cobro online y la fecha de entrega de una app VIM son decisiones contractuales previas al cierre del alcance.

## 1. Propuesta comercial y cliente objetivo

El primer segmento son estudios boutique que venden acceso a clases con cupo, trabajan con paquetes de créditos y necesitan operar desde una a varias sedes. La oportunidad propuesta está en ofrecer una experiencia en español adaptada a cobros online, transferencias y pagos presenciales del estudio, con vistas de dueña, recepción, instructoras y clientas. La hipótesis de demanda y disposición a pagar se valida con VIM y otros estudios; este plan no afirma un tamaño de mercado ni una cuota capturable sin investigación comercial.

| Oferta | Cliente previsto | Configuración incluida | Forma de entrega |
|---|---|---|---|
| Estudio | Una sede | Núcleo de agenda, paquetes, cobros y panel de gestión; módulos adicionales a elección | Portal con marca y conexión a web existente |
| Cadena | Dos a cinco sedes; VIM como caso inicial | Lo anterior, agenda y personal por sede, panel consolidado, paquetes multi-sede | Portal de marca; app propia si se contrata |
| Empresarial | Seis o más sedes, requisitos especiales | Límites, integraciones, operación y soporte pactados | Propuesta y alcance propios, mismo núcleo |

**Producto estándar:** una sola base de código y un catálogo de módulos. La licencia define derechos, sedes y límites; la configuración define qué funciones se activan y cómo; los permisos definen quién las puede usar. Ni el plan comercial ni ocultar un botón conceden permisos sobre datos. Un estudio de una sede y otro de cuatro pueden usar configuraciones distintas sin que el equipo mantenga copias de código.

**Ingreso del SaaS:** cargo de implementación por alta/importación cuando corresponda, licencia mensual por empresa y extras pactados (sedes adicionales, app de marca, integración web compleja, canales de comunicación o soporte). La referencia comercial propuesta es licencia y extras, sin comisiones automáticas sobre cada clase. Los cobros de paquetes pertenecen al estudio; el SaaS cobra su licencia al estudio por un circuito separado. Una app propia requiere precio que cubra alta, publicación, notificaciones, mantenimiento y soporte.

**Economía que hay que modelar antes de fijar tarifa:** ingreso mensual por tenant menos infraestructura asignable, mensajes, almacenamiento, pasarela si la plataforma asume comisiones, soporte, costo de app y atención de incidentes. Añadir costo inicial de implantación y meses hasta recuperar adquisición e implantación. Medir clientes de pago, ingreso mensual recurrente, ingreso por tenant, margen de contribución, bajas y tiempo real de alta. Los precios en quetzales, límites de clientas y niveles de servicio se definirán tras entrevistas y costos medidos; no están cotizados en este documento.

## 2. Qué se hereda de Forma y qué se construye

| Capacidad | Evidencia documental de Forma | Trabajo para el SaaS |
|---|---|---|
| Clientas, familia y consentimiento | Fichas, dependientes y consentimiento informados | Ficha por tenant, alta asistida, acceso por sede y misma identidad en más de una empresa sin filtrar datos |
| Clases y reservas | Horarios recurrentes, reservas, cupos, clases privadas, cancelaciones y horario fijo | Horarios por sede, personal multi-sede, control de conflictos y elegibilidad de paquetes |
| Créditos y lista de espera | Débito al reservar, devolución condicionada, promoción automática | Movimientos auditables, reserva transaccional, revalidación de sede al promocionar y reembolsar |
| Asistencia | QR de estudio, check-in manual y no-show | QR y asistencia por clase/sede; instructoras limitadas a sus clases |
| Ventas y cobros | Transferencia, cobro presencial, Recurrente, promociones, gift cards | Cuenta comercial de cada estudio, conciliación por empresa/sede y cobro SaaS B2B separado |
| Finanzas y tienda | Gastos, activos, pasivos, balance, IVA, caja, productos/pedidos | Informes por sede y consolidados, atribución correcta, módulos configurables y referencia fiscal del emisor |
| CRM, comunicación y app | WhatsApp, email, push, riesgo de fuga; web y app Capacitor | Audiencias, remitentes y dispositivos por tenant; portal/widget/app de marca con backend compartido |

Las cifras «43 tablas» y «más de 25 rutas de exportación» provienen de la documentación de Forma y se comprueban en auditoría. No se da por construido el acceso multi-sede, el panel del operador SaaS, la asignación de sede a paquetes ni un flujo completo de alta de clientas por recepción. Son requisitos de la nueva plataforma.

## 3. Producto configurable: módulos y dependencias

| Capa | Contenido | Regla de activación |
|---|---|---|
| Obligatoria | Identidad, tenants, sedes, roles, seguridad, auditoría y datos base | Siempre encendida; ninguna suspensión comercial puede desactivar aislamiento |
| Núcleo | Agenda, reservas, créditos, paquetes, cancelaciones y asistencia | Incluido según licencia; reglas y horarios configurables por empresa y sede |
| Operación | Lista de espera, horarios fijos, familia, clases privadas, congelaciones y QR | Módulos independientes con dependencias y política de suspensión |
| Cobros | Online, transferencia, caja/POS, reembolsos | Habilitar cada medio solo si su cuenta, conciliación y permisos están listos |
| Finanzas | Cierre de caja, gastos, activos, pasivos, balance, metas, IVA y FEL | Separar cada función según demanda, emisor y asesoría contable del estudio |
| Crecimiento | Tienda, inventario, descuentos, gift cards, referidos, CRM, encuestas y campañas | Activar por licencia, canal, consentimiento y proveedor de comunicaciones |
| Canales | Portal, calendario integrado, widget transaccional y app propia | Cada canal usa las mismas reservas, permisos, precios y cobros |

Se guardan por separado: `module_catalog` (capacidad y dependencias), `tenant_entitlements` (qué contrató cada empresa), `tenant_module_settings` (estado y parámetros) y `role_permissions` (acciones autorizadas). Un override por sede restringe o detalla un módulo habilitado para VIM; no puede activar por sí solo algo que VIM no contrató. Toda activación/suspensión registra actor, fecha efectiva, parámetros, motivo y versión.

Ejemplos de dependencia: pago online requiere cuenta comercial activa, checkout, webhook validado y proceso de devolución; FEL requiere emisor y proveedor acordado; lista de espera requiere reserva y regla de avisos; crédito provisional tras subir comprobante exige límites, vencimiento, control de rechazo y aprobador. Apagar ventas nuevas no borra pedidos, reservas, obligaciones de devolución ni datos financieros históricos. Las rutas API, jobs y webhooks comprueban la configuración, no solo la interfaz.

## 4. Estructura de VIM: empresa, sedes, personas y datos

**VIM es un tenant.** Sus tres sedes son entidades operativas separadas con dirección, salas, capacidad, horarios semanales, cierres, instructoras, clases, asistencia y caja propios. Una cuarta sede se crea por configuración y se prueba antes de abrirla. El sistema puede filtrar un calendario único por sede, día, tipo de clase e instructora, sin mezclar cupos. Una misma instructora puede estar autorizada en varias sedes, pero no en clases simultáneas; contemplar duración y margen de traslado configurable.

**Perfiles de personal:** una dueña o gerente general ve las sedes autorizadas del tenant; una administradora o recepcionista local ve y actúa solo en sedes asignadas; una instructora ve sus clases en las sedes donde trabaja; una contadora recibe permiso financiero separado. La asignación de sedes es una relación de muchos a muchos (`staff_sedes`), no una copia del usuario por local. El operador SaaS administra licencia y salud de la plataforma, sin acceso rutinario a fichas personales ni balances de VIM.

**Clientas:** la ficha e historial son de VIM; una clienta no se duplica por visitar otra sede. Su sede habitual es una preferencia de interfaz y segmentación, no una barrera comercial. La administradora local ve las clientas que atiende o que tienen reservas en sus sedes y la información necesaria para operar; la dueña ve la ficha unificada. Búsquedas para evitar duplicados no revelan registros de otros tenants ni datos innecesarios de otra sede. Una misma persona puede tener identidad de acceso en dos empresas sin mezclar perfil, familia, consentimiento ni créditos.

**Alta asistida:** recepción autorizada crea una ficha VIM con datos mínimos, sede habitual opcional y consentimiento pendiente cuando aplique, y envía invitación para activar acceso. También registra una venta o asignación con paquete, importe, medio de pago, sede de venta y responsable. Una cortesía o ajuste se registra como tal, con autorización; nunca se hace pasar por dinero cobrado.

## 5. Paquetes válidos para una, varias o todas las sedes

El catálogo VIM ofrece tres coberturas: **sede única**, **conjunto explícito de sedes** o **todas las sedes de VIM**. A la venta se guarda una instantánea de la cobertura en la membresía emitida, con versión de reglas y fecha; editar luego el catálogo no modifica en silencio derechos pagados. Definir si «todas» incluye nuevas sedes futuras. Las reglas de tipo de clase, instructor, dependiente o franjas también se evalúan cuando se contraten.

**Ejemplo:** paquete A de 8 clases solo Zona 10; paquete B de 12 clases Zona 10 y Zona 14; paquete C válido en cualquier sede VIM. Una clienta con sede habitual Zona 10 y paquete A puede ver Zona 14 si VIM publica ese calendario, pero no reservar allí. Si compra B, el servidor puede elegir un paquete elegible o permitirle seleccionar cuál consume. Un upgrade conserva importe, autorización y cobertura anterior/nueva. La misma membresía nunca sirve en otro tenant.

La comprobación ocurre dentro de la transacción que crea la reserva y descuenta exactamente un crédito. Aplica también a reserva por recepción, horario recurrente, lista de espera y promoción automática. Al anular o reembolsar la compra se resuelven reservas futuras y cupos en espera; ninguna reserva debe seguir respaldada por un paquete invalidado sin regla expresa. Si se reduce cobertura, revisar reservas ya confirmadas antes de efectuar el cambio. La app no puede autorizarse a sí misma enviando una lista de sedes.

## 6. Agenda, reservas y servicio por sede

| Momento | Regla | Resultado visible |
|---|---|---|
| Configuración | Administradora crea plantilla semanal u ocurrencia para su sede, sala, instructora, capacidad y excepciones | Calendario de esa sede y vista consolidada de la dueña |
| Exploración | Clienta filtra una sede o todas; puede ver validez y precio del paquete | Clases disponibles y motivo de bloqueo en sede no cubierta |
| Reserva | Verificar tenant, clase, sede, cupo, membresía vigente, saldo, beneficiaria y duplicados | Confirmación; débito de un crédito al reservar |
| Espera/cancelación | Promoción y devolución según plazo y paquete elegible | Cupo libre reasignado una sola vez; ajuste en bitácora |
| Check-in | QR de sede, lista de instructora o recepción; no-show si aplica | Asistencia local; no vuelve a descontar crédito |
| Reporte | Ocupación, reservas, cancelaciones y asistencia por sede | Comparativo consolidado para dueña, solo sede para administración local |

Las reglas existentes de Forma incluyen cancelación tardía y congelación; se hacen configurables por tenant. Mantener clase privada, familia, clase de prueba y listas de espera solo donde el módulo esté activo. Para evitar conflictos de recursos, una clase no puede asignar una sala o una instructora que ya está ocupada; la edición de horarios respeta reservas confirmadas.

## 7. Qué ve cada persona

| Pantalla | Dueña de VIM | Administradora de sede | Instructora | Clienta |
|---|---|---|---|---|
| Inicio | Ingresos, cobros, ocupación, clientas activas, retención y alertas; filtro Todas/sede | Agenda, cupos, cobros pendientes y alertas de sus sedes | Próximas clases y asistencia propia | Próximas clases, créditos y vencimientos |
| Agenda | Todas las clases, conflictos y excepciones | Horarios, plazas y lista de espera locales | Sus clases en sedes asignadas | Calendario por sede y clases elegibles |
| Clientas | Ficha única VIM, familias y membresías | Ficha necesaria de clientas atendidas; alta e invitación | Roster mínimo de sus clases | Sus datos y dependientes |
| Pagos | Todos los medios, pendientes, reembolsos y conciliación | Caja/transferencias de sus sedes según permiso | Sin acceso | Sus compras, recibos y pagos pendientes |
| Finanzas | Consolidado y por sede; gastos y metas | Caja e ingresos locales; no balance global por defecto | Sin acceso | Sin acceso |
| Configuración | Marca, catálogo, reglas, pasarela y delegaciones | Horarios, salas, instructoras y parámetros locales autorizados | Disponibilidad propia cuando se habilite | Preferencias y consentimientos |

La matriz operativa del apéndice y el archivo Excel son la fuente específica por **acción**. Esta tabla explica las vistas de producto; ninguna pantalla sustituye las políticas del servidor.

## 8. Cobros del estudio y cobro del SaaS

**Circuito A: VIM cobra sus paquetes y productos.** VIM define precios, descuentos, impuestos, método de cobro, banco y titular comercial. La plataforma conecta su cuenta de pasarela o el modelo de cuentas conectadas que VIM contrate; un checkout se crea con orden, importe, moneda, sede de venta y cuenta comercial del tenant. Si VIM tiene cuentas separadas por sede, el proveedor y la conciliación deben permitir mapear correctamente cada cobro. Antes de comprometer modalidad de cuentas conectadas, acordar por contrato quién es comercio de registro, quién recibe liquidaciones y quién soporta comisiones, contracargos y FEL. La documentación actual de Recurrente permite configurar cuentas conectadas, pero la distribución concreta de comisiones varía según el modelo elegido [R1].

La respuesta del navegador no acredita pago. Webhooks firmados verifican cuenta, tenant, orden, importe y moneda, se deduplican por evento y por operación económica, y emiten créditos una sola vez. Recurrente documenta distintos formatos de eventos; la implementación elige uno o previene duplicidad [R2]. Los cobros presenciales y las transferencias son medios de primera clase: comprobante privado, verificación humana, referencia y caja de sede; subir un archivo no equivale a dinero recibido. El crédito provisional de primera clase usado en Forma queda desactivado por defecto hasta que VIM apruebe límites y manejo de impagos. Reembolsos y contracargos actualizan saldos, dinero y reservas futuras con trazabilidad.

**Circuito B: el SaaS factura la licencia a VIM.** No se suma el dinero de sus clases al ingreso del SaaS. La factura del proveedor de software a VIM, la venta de VIM a la clienta y la liquidación de la pasarela son tres hechos distintos. Cualquier emisión fiscal electrónica se define con la contadora y el emisor correspondiente. Si FEL integrado no está disponible al inicio, documentar un proceso manual aprobado con referencia del documento fiscal; el panel no debe afirmar que emitió una factura que aún no existe.

**Finanzas operativas:** guardar sede donde se vendió, sede donde se recibió el pago y sede donde se consumió cada clase; puede ser distinto. Mostrar ventas, cobros, liquidaciones, clases consumidas e ingreso reconocido como métricas separadas. Una compra global usada en tres sedes es una venta, no tres. Definir criterio para repartir económicamente paquetes globales y gastos centrales; los reportes por sede indican esa política. Mantener gastos, activos, pasivos, balance, metas, caja y exportaciones de Forma según módulo contratado, con validación contable antes de presentar cifras fiscales como oficiales.

## 9. Sitio, portal, widget y app propia

| Canal | Experiencia de VIM | Trabajo para la plataforma |
|---|---|---|
| Web pública existente | Conserva su contenido y diseño | Botones o calendario/precios integrados; enlaces profundos a compra o clase |
| Portal con marca | `reservas.<dominio de VIM>` si VIM controla y verifica ese dominio | Dominio resuelve tenant; login, catálogo, compra, reservas y panel propios |
| Widget transaccional | Reserva/pago sin salir de la web si se contrata | Orígenes autorizados, autenticación, privacidad, accesibilidad y soporte |
| App VIM Pilates | Nombre, icono, colores, notificaciones y acceso a la cuenta VIM | Build nativo de marca sobre backend y lógica compartidos, publicación y mantenimiento pactados |

La primera integración web puede usar calendario y precios públicos y completar autenticación/pago en el portal VIM, conservando contexto de clase y sede. El widget de pago dentro de una web ajena se desarrolla si el cliente lo compra y se validan autenticación y soporte. Una app VIM no es una copia independiente del programa: comparte reservas, catálogo, permisos y datos; sí tiene identificador, distribución, notificaciones y actualizaciones propios. Si la app es requisito para la inauguración, entra explícitamente en el hito de lanzamiento con tiempo y presupuesto propios; de lo contrario, portal primero y app en entrega contratada posterior. Apple publica reglas específicas para apps producidas con plantillas comerciales, por lo que la cuenta de publicación y responsabilidad del contenido se acuerdan antes de venderla [A1].

## 10. Seguridad, aislamiento y operación

La identidad del tenant se deriva de dominio/app verificados y de la sesión autorizada. Cada registro de negocio lleva `tenant_id`; los hechos locales llevan `sede_id`. `tenant_memberships` relaciona usuario, empresa y rol; `staff_sedes` limita sedes; las membresías compradas conservan cobertura; las reservas referencian horario, clienta y paquete del mismo tenant. Claves/validaciones relacionales evitan referencias cruzadas aun si una ruta omite un filtro.

En Supabase, cada tabla expuesta requiere permisos base de Postgres **y** políticas RLS; ambas comprobaciones son distintas [S1]. Probar lectura, inserción, cambio y borrado según rol y sede. Las claves de servicio/secretas de servidor eluden políticas de usuario y exigen comprobar rol y tenant en el servidor [S2]. También proteger RPC, `security definer`, vistas, storage, exports, QR, colas, crons, caché y webhooks. Las políticas no deben autorreferenciarse; un error de RLS ya causó una incidencia documentada en Forma.

Un acceso de soporte del operador SaaS a datos de VIM exige autorización, motivo, alcance, caducidad y bitácora. El personal local no exporta directorios globales por defecto. El mismo correo usado por personas que operan varias empresas no produce sesión cruzada ni fuga de datos. La zona horaria IANA es por tenant/sede; la lógica operativa no fija UTC-6 en todos los estudios. Los jobs se ejecutan en lotes por tenant y son reintentables e idempotentes; las comunicaciones usan remitente, plantilla, consentimiento y tokens del estudio correcto.

## 11. Alta de estudio y salida de VIM

1. Firmar alcance, módulos, número de sedes, precio, soporte, uso de datos, pagos y responsabilidades de publicación de app.
2. Crear tenant en entorno SaaS, plan, sedes, marca, dominio verificado, zona horaria, módulos y límites. Para VIM se admite un script de provisionamiento seguro y auditado al inicio; el panel autoservicio del operador se construye después. Ningún alta exige editar código.
3. Invitar dueña; asignar administradoras e instructoras a una o varias sedes; aprobar matriz de permisos y flujo de altas asistidas.
4. Cargar catálogo propio, cobertura de sedes, precios, cupos, horarios semanales, excepciones, reglas de cancelación y plantillas.
5. Conectar cuenta comercial propia, banco y cajas. Ensayar compra, webhook, transferencia, devolución, cierre y conciliación antes de abrir ventas.
6. Si hay datos previos, importar solo con autorización y mapeo de clientas, saldos, vigencias, sedes y reservas; reconciliar importes y clases antes de cortar.
7. Configurar sitio/portal VIM y, si se contrató, app propia. Probar enlaces, correos, notificaciones, clase en otra sede y compra desde ambos canales.
8. Hacer ensayo completo de operación con las tres sedes; definir responsable de soporte, reversión y monitoreo. Activar producción VIM sin cambiar Forma.

## 12. Fases, entregables y puertas de avance

| Hito | Alcance verificable | Condición de salida |
|---|---|---|
| A. Auditoría y oferta | Inventario real de código/esquema y riesgos; entrevista a VIM; precio, app y pagos pactados | Estimación con dependencias y aceptación comercial; Forma intacta |
| B. Base SaaS | Entornos separados, tenants/sedes, dominio, roles, GRANT/RLS, matriz y provisionamiento | Dos tenants ficticios, tres sedes, ninguna fuga por rutas/API/exportaciones |
| C. Núcleo VIM | Alta de clienta, paquetes 1/varias/todas, agenda/personal por sede, reservas, créditos, espera, asistencia y caja | Flujos de compra-reserva-check-in, dos cobros y un reembolso conciliados; pruebas negativas por sede |
| D. Portal y lanzamiento | Portal VIM, conexión a su sitio, panel dueña/local, reportes comprometidos, pasarela VIM **si online es requisito contractual** | Ensayo con VIM y validación de dueño/caja; plan fiscal interino documentado cuando aplique |
| E. Paridad y producto repetible | Resto de módulos Forma comprometidos, panel operador, alta de terceros, observabilidad y migraciones | Nuevo estudio activado por configuración, sin ramificar código |
| F. Canales adicionales | Widget transaccional y app VIM u otras marcas **según contrato** | Prueba web/app, tienda de apps, soporte y compatibilidad de builds |
| G. Otras disciplinas | Reglas de capacidad/equipo/disciplina configurables con cliente piloto real | Piloto pagado con caso operativo comprobado |

Si VIM contrata la app para su salida, F se adelanta y se convierte en puerta de D. Si VIM contrata cobro online, el conector de **su** proveedor y su cuenta son parte de C/D aunque el adaptador general para varias pasarelas venga después. Si se prometen finanzas completas o FEL al inicio, también pasan a D o se pacta claramente el proceso manual. Los plazos se fijan tras auditoría; «6-8 semanas» y «85-90 % de código reutilizable» del material anterior no son compromisos ni mediciones comprobadas.

## 13. Pruebas de aceptación y métricas de lanzamiento

**Seguridad:** probar con dos tenants ficticios y VIM con tres sedes, administradora asignada a dos sedes, instructora rotando, misma persona con correo en dos empresas y acceso excepcional de soporte. Rechazar IDs ajenos en UI/API/DB, exportación, ficheros, QR, webhook y cron. RLS y GRANT pasan juntos por CI; no desplegar políticas nuevas sin ensayo de transacción y rollback preparado.

**Operación:** una clienta creada por recepción adquiere paquete solo sede A; reserva A y recibe bloqueo en B; luego adquiere paquete A+B y reserva B, con un crédito cargado una vez. Paquete «todas» se prueba con nueva cuarta sede según regla acordada. Ensayar lista de espera, clase privada, horario fijo, familias, cierre de sede, cambios de catálogo, congelación, reembolso, promoción y reservas simultáneas por el último cupo. Verificar que una instructora en dos sedes no se programe a la vez.

**Dinero y servicio:** prueba de tres métodos de cobro según contrato, webhook duplicado o tardío, pago fallido, comprobante falso, cierre por sede y conciliación consolidada. Controlar venta/cobro/liquidación/consumo por separado; no duplicar ventas de paquetes globales. Probar exportaciones, restauración ensayada y compatibilidad de la app instalada antes de abrir producción.

**Panel de resultados:** el éxito inicial se mide por reservas completadas, ocupación, asistencia, compra y renovación, créditos y pagos conciliados, exactitud de reportes y tiempo de respuesta a incidentes; para el SaaS, tiempo de alta del siguiente tenant, ingreso recurrente, costo de atención y bajas. Establecer metas numéricas con VIM a partir de datos reales; este documento no crea objetivos de ocupación o ventas sin línea base.

## 14. Riesgos y decisiones pendientes

| Asunto | Regla o decisión propuesta | Responsable / momento |
|---|---|---|
| Validez de paquetes | Soportar una, varias y todas las sedes; definir producto y precios reales VIM, incluyendo sedes futuras | VIM, antes de configurar catálogo |
| Reportes financieros | Consolidado y por sede; decidir reparto de paquetes y gastos centrales | VIM y contadora, antes de pruebas de cierre |
| Pasarela y caja | Titular de cuenta, medio por sede, costo de comisiones, contracargos y liquidaciones | VIM y proveedor, antes de desarrollo de checkout |
| App VIM | Requisito de salida o entrega posterior; cuenta de publicación y mantenimiento | VIM y Andrés, antes de cerrar cronograma |
| Módulos del lanzamiento | Lista firmada de must-have frente a resto Forma y canales adicionales | VIM y Andrés, antes de cotizar |
| Precio y planes | Implantación, licencia, sede extra, app, mensajes, soporte y límites; validar costos y entrevistas | Andrés, antes de oferta comercial |
| Datos previos | Existencia, calidad, autorización y conciliación de saldos | VIM, antes de importar |
| Emisión fiscal | Emisor, certificador y proceso manual temporal si falta integración | VIM y contadora, antes de recibir ventas |
| Suspensión / salida | Retención contractual, exportación, saldos, obligaciones y migración de datos | Andrés y VIM, antes de firma |

## 15. Matriz de permisos: reglas de lectura

La matriz adjunta es una especificación de producto, no una constatación de que los permisos ya estén implementados. Cada fila representa una acción. **P** = solo metadatos técnicos/comerciales de la plataforma; **E** = acceso excepcional y temporal a datos autorizado por el estudio; **G** = todo el tenant; **S** = sedes asignadas; **I** = clases propias en sedes asignadas; **L** = información mínima de clientas vinculadas a la sede/clase/factura; **C** = datos propios de clienta y dependientes autorizados; **—** = denegado. El sufijo `*` requiere delegación expresa y/o umbral de autorización indicado en la regla. Toda celda supone que el módulo está contratado y activo y que la persona pertenece al tenant correspondiente. La matriz se implementa en RLS, servicios y pruebas, no solo en navegación.

**Decisiones de privacidad que cierra la matriz:** la sede habitual no da acceso a la ficha completa; una administradora local puede consultar la información necesaria de clientas que atiende, no un directorio VIM completo; la instructora accede al roster mínimo, no al importe pagado; la contadora accede a datos fiscales necesarios, no a fichas CRM. Soporte de la plataforma necesita autorización y bitácora. Ningún error de correo/teléfono duplicado revela a una persona ajena o datos de otro estudio.

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
| P10 | Clientas | Consultar directorio completo VIM | — | G | G | — | — | — | — | — | Consulta global solo para gestión central; local puede buscar coincidencia sin exposición ajena. |
| P11 | Clientas | Ver ficha y contacto necesarios | — | G | G | L | L | I | L | C | Local: clientas atendidas o reservadas en su sede; instructora: roster y contacto mínimo; contadora: datos de factura. |
| P12 | Clientas | Editar ficha, consentimientos y familia | — | G | G | S | S | — | — | C | Personal local limitado a datos de atención; consentimientos de menor y cambios sensibles auditados. |
| P13 | Agenda | Crear / cambiar horarios semanales | — | G | G | S | — | — | — | — | Cada horario pertenece a una sede, sala y clase; conflictos de instructora entre sedes se bloquean. |
| P14 | Agenda | Cambiar cupos, excepciones y cierres | — | G | G | S | S* | — | — | — | Reducir cupo bajo reservas confirmadas requiere resolución expresa; cambios quedan en bitácora. |
| P15 | Agenda | Ver agenda de todas las sedes | — | G | G | — | — | — | — | — | La vista consolidada respeta ámbito de rol; no otorga acceso a caja ajena. |
| P16 | Agenda | Ver agenda de sede / clases propias | — | G | G | S | S | I | — | C | La clienta ve oferta pública; los cupos internos y nombres ajenos quedan protegidos. |
| P17 | Reservas | Reservar / cancelar para sí o dependientes | — | G | G | S | S | — | — | C | Comprobar pertenencia, capacidad, sede válida del paquete, créditos y política de cancelación. |
| P18 | Reservas | Reservar / cancelar por una clienta | — | G | G | S | S | — | — | — | Personal solo en sede asignada; misma validación de elegibilidad y crédito que en autoservicio. |
| P19 | Reservas | Ver listas nominales de la clase | — | G | G | S | S | I | — | — | Instructora ve únicamente sus clases; mostrar datos mínimos para el servicio. |
| P20 | Reservas | Gestionar lista de espera / promoción | — | G | G | S | S | I | — | C | Cambio de plaza atómico y elegibilidad revalidada al promocionar; clienta solo su posición. |
| P21 | Asistencia | Registrar QR, asistencia y no-show | — | G | G | S | S | I | — | C | Instructora en sus clases; QR de clienta propio; no volver a descontar créditos. |
| P22 | Asistencia | Ver reportes de asistencia / ocupación | — | G | G | S | S | I | — | C | Cliente solo su historial; instructora sus clases; local su sede; global todas. |
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


## 16. Referencias y alcance de la evidencia

- **Documentos aportados:** `Forma-Pilates-Documentacion-Tecnica.md` (28/09/2026), `Forma-SaaS-Completo.pdf` (28/09/2026) y discusión de producto sobre VIM, módulos, sedes, perfiles y paquetes. Son insumos de negocio, no sustituyen auditoría del código y la base.
- [S1] Supabase, «Row Level Security»: https://supabase.com/docs/guides/database/postgres/row-level-security (consultado 28/09/2026).
- [S2] Supabase, «API keys»: https://supabase.com/docs/guides/getting-started/api-keys (consultado 28/09/2026).
- [R1] Recurrente, «Cuentas conectadas»: https://docs.recurrente.com/guias-espanol/guias/cuentas-conectadas (consultado 28/09/2026).
- [R2] Recurrente, «Webhooks»: https://docs.recurrente.com/guias-espanol/comenzar/webhooks (consultado 28/09/2026).
- [A1] Apple, «Directrices de App Review», regla 4.2.6: https://developer.apple.com/app-store/review/guidelines/es/ (consultado 28/09/2026).

**Uso:** este plan sirve para decidir, vender y contratar. El equipo de desarrollo convierte cada acción de la matriz en políticas, servicios y pruebas; los compromisos con VIM se fijan con las decisiones de la sección 14 y una cotización basada en auditoría.
