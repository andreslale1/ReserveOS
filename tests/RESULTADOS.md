# Resultados de verificación — ReserveOS

Generado: **12 de octubre de 2026 a las 3:02 p. m.** (hora de Guatemala) · Base verificada: staging `agkqppuhyltirrhngybq`

## Resumen

| Qué | Resultado |
|---|---|
| Pruebas por API directa (Vitest) | **271 de 277 pasan** — 3 FALLAN |
| Escenarios de punta a punta + concurrencia | **FALLAN** |
| Migraciones locales / desplegadas | 106 locales · 106 desplegadas · **coinciden** |
| Funciones que un visitante sin cuenta puede ejecutar | captar_lead, horarios_publicos, invitacion_clienta_por_token, invitacion_personal_por_token, pago_webhook, tenant_por_dominio, testimonios_publicos |
| Base | 108 tablas (108 con RLS) · 511 funciones · 103 políticas |

## Pruebas por API directa, con sesión real de cada rol

### aislamiento_rpcs.test.ts

**aislamiento entre tenants — RPCs de negocio**

- ✔ usuario A no puede unirse a la lista de espera de un horario de tenant B
- ✔ usuario A no puede listar clientas de cobro del tenant B (RPC devuelve vacío, no error de datos ajenos)
- ✔ usuario A no puede pedir KPIs del tenant B (null, no datos)
- ✔ mi_permiso: dueña de tenant A tiene scope G en P35 (gastos de sede)
- ✔ mi_permiso: usuario A no tiene ningún permiso en el tenant B

**aislamiento entre tenants — RPCs nuevas (sedes, finanzas, marca)**

- ✔ usuario A no puede ejecutar crear_sede sobre el tenant B
- ✔ usuario A no puede ejecutar guardar_reglas_reservas sobre el tenant B
- ✔ usuario A no puede ejecutar delegacion_crear sobre el tenant B
- ✔ usuario A no puede ejecutar cerrar_fechas sobre el tenant B
- ✔ usuario A no puede ejecutar importar_clientes sobre el tenant B
- ✔ usuario A no puede ejecutar actualizar_marca sobre el tenant B
- ✔ usuario A no puede ejecutar definir_meta_mensual sobre el tenant B
- ✔ usuario A no puede ejecutar registrar_gasto sobre el tenant B
- ✔ usuario A no puede ejecutar registrar_activo_pasivo sobre el tenant B

### aislamiento_storage.test.ts

**aislamiento entre tenants — Storage (bucket comprobantes)**

- ✔ usuario A sube un comprobante a su propia carpeta (tenant/cliente)
- ✔ usuario A no puede subir a la carpeta de la clienta del tenant B

**aislamiento entre tenants — Storage (bucket public-assets)**

- ✔ dueña de tenant A sube un asset a su propio tenant
- ✔ dueña de tenant A no puede subir un asset a la carpeta del tenant B
- ✔ lectura pública (anon, sin sesión) funciona — es contenido de portal, a propósito abierto

### aislamiento_tablas.test.ts

**aislamiento entre tenants — lectura directa de tablas**

- ✔ clientes: usuario A solo ve filas de su propio tenant
- ✔ horarios: usuario A solo ve filas de su propio tenant
- ✔ reservas: usuario A solo ve filas de su propio tenant
- ✔ paquetes: usuario A solo ve filas de su propio tenant
- ✔ clientes: usuario B solo ve filas de su propio tenant
- ✔ horarios: usuario B solo ve filas de su propio tenant
- ✔ reservas: usuario B solo ve filas de su propio tenant
- ✔ paquetes: usuario B solo ve filas de su propio tenant
- ✔ anon sin sesión recibe 401 (permission denied), no una lista vacía
- ✔ un tenant nunca aparece en la respuesta del otro (tenants)

### automatizaciones.test.ts

**lógica con hora simulada (miércoles 14/10/2026 09:00 de Guatemala)**

- ✘ las 14 automatizaciones encolan lo correcto, una sola vez, respetando módulos, apagado por estudio, preferencias y la hora de la sede
- ✔ no deja datos de prueba (el escenario se deshace)

**programación y seguridad**

- ✔ los 15 trabajos están programados y activos, y el antiguo diario en UTC ya no existe
- ✔ ninguna función de automatización se puede ejecutar desde el navegador (ni sin sesión ni con sesión)
- ✔ las tablas nuevas tienen RLS y no son legibles directamente

**panel de la dueña, con sesión real**

- ✔ la dueña ve las 15 automatizaciones con su estado
- ✔ recepción y administración de sede no entran al panel ni apagan nada
- ✔ la dueña apaga y vuelve a prender una automatización; las de núcleo no se pueden apagar
- ✔ «Verificar ahora» guarda el chequeo de salud del día
- ✔ otro estudio no puede consultar ni cambiar el de VIM

### clases_instructoras.test.ts

**historial de reservas: cada rol ve solo lo suyo**

- ✔ la dueña ve las tres sedes: quién reservó y quién asistió
- ✔ la administradora y la recepción de Centro ven solo Centro; la de Sur, solo Sur; la de Norte, nada de estas clases
- ✔ la instructora ve solo las clases que da ella
- ✔ contabilidad, marketing, una clienta, otro estudio y quien no es del estudio quedan fuera
- ✔ filtra por asistencia, día de la semana, hora, sede, estado e instructora, y reporta el total para paginar

**clases por instructora**

- ✔ cuenta alumnas, asistencia, sin marcar y ocupación de cada clase dada
- ✔ el resumen por instructora suma sus clases, y cada instructora solo ve el suyo
- ✔ cambiar la instructora del horario solo vale hacia adelante: lo ya dado no cambia

**corregir quién dio una clase y registrar sustituciones (solo la dueña, con auditoría)**

- ✔ la administradora, la recepción y la instructora no pueden
- ✔ exige motivo, una clase, y que la persona sea instructora del estudio
- ✔ la dueña corrige y registra una sustitución en varias clases a la vez; el reporte lo refleja
- ✔ la sustituta puede marcar asistencia de esa clase y la titular ya no

**corregir una asistencia errónea**

- ✔ otra sede no puede; exige motivo; la recepción de la sede sí
- ✔ anular y devolver regresa el crédito a la membresía exacta, una sola vez

**cancelar la clase de un día**

- ✔ cancela las reservas, devuelve cada crédito y deja un aviso propio en la cola
- ✔ después de cancelada, esa fecha ya no admite reservas; las demás fechas siguen igual

**confirmación de asistencia y liberación de cupos**

- ✘ quien no confirma pierde el cupo cuando la clase está llena, y entra la primera de la lista de espera

**reto mensual**

- ✔ la clienta ve su avance real hacia la meta y la dueña configura la meta del estudio

**clases privadas 1 a 1**

- ✘ la agenda respeta el alcance: la sede, la dueña y la instructora de esa clase
- ✘ sin paquete privado no se reserva; la recepción de otra sede no asigna; la de la sede sí
- ✘ cancelar a tiempo devuelve el crédito del paquete privado, y se puede volver a reservar con él

**asistencia por QR**

- ✘ el personal de la sede registra la asistencia con el código de la clienta; otra sede no, y repetirlo no duplica

### matriz_alcance.test.ts

**clientas: cada rol ve solo las que atiende**

- ✔ duena ve exactamente 4 clienta(s) de VIM
- ✔ regional ve exactamente 3 clienta(s) de VIM
- ✔ admin1 ve exactamente 2 clienta(s) de VIM
- ✔ admin2 ve exactamente 2 clienta(s) de VIM
- ✔ recep1 ve exactamente 2 clienta(s) de VIM
- ✔ recep3 ve exactamente 1 clienta(s) de VIM
- ✔ instr12 ve exactamente 0 clienta(s) de VIM
- ✔ instr3 ve exactamente 0 clienta(s) de VIM
- ✔ contadora ve exactamente 0 clienta(s) de VIM
- ✔ marketing ve exactamente 0 clienta(s) de VIM
- ✔ multi ve exactamente 2 clienta(s) de VIM
- ✔ el personal de otro estudio no ve ninguna clienta de VIM
- ✔ una clienta solo se ve a sí misma
- ✔ la recepción de Centro no puede abrir la ficha de una clienta de Sur ni por su id

**reservas, paquetes, pagos y caja: alcance por sede**

- ✔ duena: reservas=4 paquetes=4 cierres=2 cobros=2
- ✔ contadora: reservas=0 paquetes=4 cierres=2 cobros=2
- ✔ regional: reservas=3 paquetes=3 cierres=1 cobros=1
- ✔ admin1: reservas=1 paquetes=2 cierres=1 cobros=1
- ✔ admin2: reservas=2 paquetes=2 cierres=0 cobros=0
- ✔ recep1: reservas=1 paquetes=2 cierres=1 cobros=1
- ✔ recep3: reservas=1 paquetes=1 cierres=1 cobros=1
- ✔ instr12: reservas=3 paquetes=0 cierres=0 cobros=0
- ✔ instr3: reservas=1 paquetes=0 cierres=0 cobros=0
- ✔ marketing: reservas=0 paquetes=0 cierres=0 cobros=0
- ✔ la instructora ve el roster mínimo: nombre y asistencia, sin teléfono ni id de clienta
- ✔ la instructora de Sur no recibe el roster de las clases de Centro

**finanzas por sede: la dueña ve las tres sedes por separado y consolidadas**

- ✔ la dueña recibe 3 sedes y el consolidado cuadra con la suma de las sedes
- ✔ la contabilidad ve el mismo consolidado
- ✔ la gerencia regional ve solo Centro y Norte y NO recibe el consolidado del estudio
- ✔ admin de Centro y recepción de Sur ven únicamente su sede
- ✔ la instructora y marketing no pueden pedir finanzas; el estudio ajeno tampoco
- ✔ la recepción de Sur no puede ver ni cerrar la caja de Centro
- ✔ gastos: cada sede ve solo los suyos

**estudios: personal en más de un estudio y estudio ajeno**

- ✔ una persona de personal en dos estudios tiene dos membresías separadas y ve cada estudio con su rol
- ✔ el estudio ajeno no puede leer ni ejecutar nada de VIM

**estudio de una sola sede**

- ✔ su dueña ve una sola sede, el consolidado cuadra y la recepción de VIM no ve nada de él
- ✔ su recepción no ve clientas de VIM y viceversa

### matriz_operaciones.test.ts

**invitaciones de personal: quién invita a quién, y a qué sedes**

- ✔ la recepción no puede invitar a nadie
- ✔ la admin de sede NO puede invitar mientras la dueña no se lo delegue (P06 es delegable)
- ✔ la dueña delega P06 a admin de sede y a gerencia regional
- ✔ con delegación, la admin de Centro invita recepción a Centro
- ✔ pero no a una sede que no es suya
- ✔ no puede invitar a otra administradora, a gerencia, ni a roles de todo el estudio
- ✔ una sede de otro estudio es rechazada
- ✔ la gerencia regional invita admin a sus sedes, pero no gerencia general ni sedes ajenas
- ✔ la dueña invita gerencia regional (con sedes) y marketing (sin sedes); exige sedes a los roles de sede

**asignar y quitar sedes: nadie amplía su propio alcance ni el de quien no le corresponde**

- ✔ la admin de Centro no puede ampliar su propio alcance
- ✔ no puede dar una sede que no es suya a nadie
- ✔ no puede tocar el alcance de otra administradora, de la gerencia regional ni de roles de todo el estudio
- ✔ sí puede asignar y quitar una de SUS sedes a una recepción (con delegación)
- ✔ la recepción no puede asignar sedes a nadie
- ✔ no se puede quitar una sede a una instructora que aún tiene clases activas ahí

**horarios: la instructora debe estar asignada a la sede y no tener clases incompatibles**

- ✔ rechaza una instructora que no trabaja en esa sede
- ✔ rechaza clases que se traslapan para la misma instructora, también entre sedes distintas
- ✔ rechaza que una persona que no es instructora dé clase
- ✔ la recepción no puede crear horarios
- ✔ crea una clase válida y no deja cambiarle a una instructora de otra sede

**paquetes por sede: compra, cobertura y crédito exacto**

- ✔ la clienta elige la sede al comprar y esta queda registrada con su cobertura
- ✔ un paquete de una sola sede queda atado a la sede de la clienta, y a nada más
- ✔ el crédito vuelve exactamente a la membresía que se consumió (no a otra)
- ✔ un paquete de Centro no deja reservar en Norte (cobertura adquirida)

**asistencia y exportaciones**

- ✔ solo quien corresponde puede marcar asistencia: otra sede o la instructora de otra clase, no
- ✔ el resumen exportable de clientas solo sale para dueña y gerencia, completo o con su alcance
- ✔ seguimiento de clientas: cada sede ve solo las suyas

**altas y consultas que usan las pantallas, con el alcance de cada rol**

- ✔ una clienta dada de alta por la recepción de Centro es visible para ella y no para la de Sur
- ✔ las consultas de las pantallas (lista de clientas, ficha, pagos pendientes, tienda, caja) responden para todos los roles de sede
- ✔ las consultas de cobro de cada sede solo traen las clientas de esa sede
- ✔ un pedido de otra sede no se puede confirmar ni entregar

**cobro en recepción (pantalla Cobrar)**

- ✔ la recepción de Centro cobra un paquete en Centro y queda activo y pagado
- ✔ la recepción de Sur NO puede cobrar en Centro, y nadie de recepción da cortesías
- ✔ limpieza: la dueña anula el cobro y borra la clienta de prueba

### negocio_finanzas.test.ts

**centro de mando: cada rol ve su parte, por sede**

- ✔ la dueña recibe las siete secciones y las alertas
- ✔ la dueña puede filtrar por sede y la cifra de la sede es menor o igual al total
- ✔ la admin de Centro ve solo lo suyo: sin metas, retención, adquisición ni encuestas
- ✔ la admin de Centro y la gerencia regional no pueden pedir una sede que no es suya
- ✔ la contadora solo recibe finanzas agregadas, sin datos de clientas
- ✔ recepción, instructora y marketing no entran; tampoco una dueña de otro estudio

**una sola regla de ingreso confirmado**

- ✔ resumen financiero, IVA, atribución por sede y centro de mando dan la misma cifra
- ✔ la contadora ve exactamente las mismas cifras que la dueña
- ✔ la utilidad acumulada del balance es ingreso confirmado menos gastos operativos
- ✔ los gastos de preinversión no entran en el IVA ni en la utilidad
- ✔ la serie mensual usa la misma regla y respeta el alcance

**anulación de cobros: sale de todos los reportes y devuelve el código de descuento**

- ✔ anular lo saca del ingreso, devuelve el uso del código y solo la dueña puede
- ✔ en el reporte «Ingresos confirmados» lo anulado cuenta 0 y la suma de la columna es el ingreso confirmado

**metas con avance real y proyección**

- ✔ la dueña define metas, ve el avance y la proyección; nadie más puede

**retención: lista de clientas para contactar**

- ✔ responde para la dueña y la admin de sede con sus clientas; contadora, instructora y marketing no ven clientas

**ficha de clienta: detalle, acceso, consentimiento y eliminación**

- ✔ el detalle lo ve quien atiende a la clienta, no otra sede
- ✔ reenviar el acceso y recordar el consentimiento: solo dueña o gerencia general, y no se envía nada real
- ✔ eliminar la cuenta: solo la dueña, con el nombre exacto, deja auditoría y se frena si hay pagos

**carritos abandonados: recordar solo encola**

- ✔ la dueña recuerda un carrito activo; las demás no; no se duplica el mismo día

**exportaciones: cada rol recibe lo suyo**

- ✔ la dueña ejecuta los reportes del catálogo sin errores
- ✔ la contadora puede los financieros y no los nominales; recepción e instructora ninguno
- ✔ la admin de sede recibe cierres y ventas solo de su sede, y los reportes financieros globales no son suyos
- ✔ un reporte pedido por API directa sin permiso de base de datos tampoco devuelve datos
- ✔ el CSV neutraliza fórmulas y conserva acentos

**aislamiento entre estudios**

- ✔ la dueña de otro estudio no obtiene nada de este con las funciones nuevas

### owner_comercial.test.ts

**O-09 · fecha de Guatemala**

- ✔ a las 8:30 p. m. en Guatemala el día sigue siendo el de Guatemala, aunque en UTC ya sea el siguiente
- ✔ formato dd/mm/aaaa y último día del mes
- ✔ la base y la consola coinciden en qué día es hoy

**O-03 · planes y suscripciones sin Q0**

- ✔ los planes que estaban en Q0 quedaron en borrador y no se pueden asignar
- ✔ no se publica un plan en Q0 salvo que sea prueba gratuita explícita
- ✔ clave única: crear con una clave que ya existe falla, y cambiar precio sube la versión
- ✔ las suscripciones solo usan planes publicados del catálogo (nada de «estandar» libre)
- ✔ el impacto de un plan se puede consultar antes de cambiarlo

**O-04 · pipeline → propuesta → contrato con estados**

- ✔ una oportunidad abierta exige próxima acción con fecha
- ✔ «Ganado» sin propuesta ni contrato se rechaza; con excepción de motivo corto también; con motivo suficiente queda registrada
- ✔ la propuesta exige un plan publicado y precio; aceptada, gana la oportunidad y permite crear el contrato (en borrador)
- ✔ estados del contrato: no se salta pasos, firmar exige firmantes, solo vigente se aplica o da de alta

**O-04 · alta guiada desde el contrato**

- ✔ solo implementación/operador da de alta; ventas no
- ✔ detecta duplicados: un enlace existente bloquea; un nombre repetido pide confirmación
- ✔ crea el estudio en borrador con sede, suscripción en pausa ligada al contrato, módulos del plan y dueña invitada
- ✔ es reanudable: repetirlo no duplica nada y devuelve el mismo estudio

**O-03/O-04 · puertas para salir en vivo y estados por módulo**

- ✔ la puerta lista qué falta y bloquea la salida
- ✔ estados del módulo: contratado → habilitado → configurado → probado (con evidencia) → en producción, sin saltos
- ✔ sin dueña no sale en vivo: hace falta una excepción con motivo, que queda registrada; entonces la suscripción se activa

**O-04 · alta manual excepcional**

- ✔ exige motivo, no admite enlaces repetidos y deja la excepción registrada en el proyecto

**Cobros · vista previa y generación segura**

- ✔ la vista previa lista lo que se generará, sin generar nada, y separa excepciones
- ✔ un estudio suspendido sale como excepción y no se cobra
- ✔ generar usa el mes de Guatemala por defecto, no duplica y rechaza períodos lejanos
- ✔ solo finanzas/operador generan cobros

### owner_estudios.test.ts

**O-01 · estados reales con bloqueo en la base**

- ✔ solo el operador cambia el estado; ventas es rechazada
- ✔ estado inválido, mismo estado y falta de motivo se rechazan
- ✔ pausado: bloquea altas nuevas pero deja configurar y leer
- ✔ suspendido: bloquea configuración y altas; la dueña sigue leyendo; el operador sí puede operar
- ✔ un visitante sin cuenta tampoco puede dar de alta clientas en un estudio suspendido
- ✔ reactivar con motivo restablece la operación y todo queda en historial y auditoría
- ✔ un estudio suspendido sigue sin afectar a otro estudio

**O-02 · la ficha no expone datos de clientas ni finanzas**

- ✔ el operador ve metadatos y métricas pero no clientas, teléfonos, ingresos ni gastos
- ✔ ventas no puede abrir la ficha; la dueña de un estudio tampoco
- ✔ sin acceso excepcional las lecturas sensibles fallan, incluso para el operador
- ✔ otorgar exige rol, ticket abierto del mismo estudio, motivo, alcance y plazo válidos
- ✔ con acceso vigente solo se lee el alcance concedido, con paginación acotada, y cada lectura se registra
- ✔ el acceso caduca solo
- ✔ un visitante sin sesión no puede ejecutar ninguna de las funciones nuevas

**O-06 y O-11 · pruebas fuera de los conteos y métricas rotuladas**

- ✔ la lista trae tipo y las dos métricas de clientas, consistentes con la base
- ✔ estudios activos del resumen y de Dirección cuentan solo clientes reales
- ✔ el MRR no suma suscripciones de estudios demo o internos

### owner_gobierno.test.ts

**permisos por rol de plataforma, en la base**

- ✔ ventas no entra a equipo, auditoría, salud ni dominios
- ✔ auditor lee equipo y auditoría, pero no invita, no ve salud ni dominios
- ✔ soporte ve salud y dominios, pero no equipo ni auditoría, y no activa dominios
- ✔ un visitante sin sesión no puede ejecutar ninguna de las funciones nuevas

**equipo e invitaciones (O-12)**

- ✔ el operador invita a alguien sin cuenta previa: queda pendiente con vencimiento a 7 días
- ✔ rechaza correo inválido, rol inexistente y a alguien que ya es del equipo
- ✔ un correo distinto no puede aceptar ni ver el detalle de la invitación
- ✔ una invitación vencida no se puede aceptar
- ✔ la persona invitada acepta con su correo y entra al equipo con el rol invitado
- ✔ una invitación pendiente se puede revocar y deja de servir
- ✔ solo el operador cambia roles y quita gente; nadie puede quitarse a sí mismo
- ✔ la base nunca deja sin operador: ni borrando ni degradando al último

**auditoría accionable (O-13)**

- ✔ registra al actor y el diff antes/después de un cambio de rol, con filtros por módulo, actor y acción
- ✔ agrupa un cambio de módulos en lote y muestra cada uno con antes y después
- ✔ el período se interpreta en hora de Guatemala y la paginación respeta límite y desplazamiento
- ✔ oculta secretos y datos personales en el diff, y nunca expone el token de una invitación
- ✔ la lista de estudios para filtrar está disponible para el auditor

**salud honesta (O-14)**

- ✔ cada tarea, servicio y estudio trae un estado de los cuatro permitidos, con motivo
- ✔ sin datos no es sano: una tarea que nunca corrió y un estudio sin reservas recientes son «sin evidencia»
- ✔ un error sin resolver o un incidente crítico degradan o tumban al estudio; resolverlo lo recupera
- ✔ una tarea atrasada según su calendario se marca caída; el cálculo del intervalo entiende los calendarios usados
- ✔ «Verificar ahora» guarda la verificación con su autor y queda en el historial

**dominios verificables (O-15)**

- ✔ un dominio nuevo nace pendiente, con su token de propiedad
- ✔ no se publica sin comprobar DNS y HTTPS, ni con una comprobación con error
- ✔ quien no tiene permiso no registra comprobaciones
- ✔ con DNS y HTTPS correctos el operador lo publica, el visitante lo resuelve, y al despublicar deja de resolver
- ✔ una comprobación vieja (más de 24 horas) ya no alcanza para publicar

### owner_matriz_roles.test.ts

**matriz ruta → consultas → rol, con sesión real**

- ✔ operador: cada ruta del menú carga todas sus consultas y las ocultas se niegan en el servidor
- ✔ ventas: cada ruta del menú carga todas sus consultas y las ocultas se niegan en el servidor
- ✔ marketing: cada ruta del menú carga todas sus consultas y las ocultas se niegan en el servidor
- ✔ finanzas: cada ruta del menú carga todas sus consultas y las ocultas se niegan en el servidor
- ✔ soporte: cada ruta del menú carga todas sus consultas y las ocultas se niegan en el servidor
- ✔ implementacion: cada ruta del menú carga todas sus consultas y las ocultas se niegan en el servidor
- ✔ ingenieria: cada ruta del menú carga todas sus consultas y las ocultas se niegan en el servidor
- ✔ auditor: cada ruta del menú carga todas sus consultas y las ocultas se niegan en el servidor

**Dirección entrega a cada rol solo su parte (F-12)**

- ✔ ventas ve pipeline y no dinero ni servicio
- ✔ finanzas ve dinero y no pipeline ni servicio
- ✔ soporte ve servicio y no pipeline ni dinero
- ✔ implementacion ve servicio y no pipeline ni dinero
- ✔ ingenieria ve servicio y no pipeline ni dinero
- ✔ la cola de acciones también se filtra por rol
- ✔ marketing ya no ve el enlace de Dirección

### publico_registro.test.ts

**página pública: lo que ve un visitante sin cuenta**

- ✔ devuelve horarios, sedes, paquetes con precio y cobertura, y no filtra datos de clientas
- ✔ un estudio inexistente o no activo responde vacío, no error con datos
- ✔ cada estudio solo muestra lo suyo (aislamiento entre estudios)
- ✔ las funciones de gestión nuevas NO están abiertas al visitante sin cuenta

**el estudio edita su página: solo dueña/gerencia, con límites**

- ✔ la dueña guarda título y se ve en la página pública; apagar un bloque queda guardado
- ✔ recepción, instructora y la dueña de OTRO estudio no pueden editarla
- ✔ rechaza campos inexistentes, imágenes que no son https y textos gigantes
- ✔ contacto: valida el número, solo la dueña lo cambia, y aparece en la página

**registro autónomo: ficha de clienta sin pedir datos innecesarios**

- ✔ una persona nueva se registra sin género ni «cómo te enteraste», y queda ligada solo a ESE estudio
- ✔ si recepción ya había creado su ficha con ese correo, se FUSIONA (no se duplica)
- ✔ un teléfono ya usado por otra cuenta del mismo estudio se rechaza
- ✔ el código de referido se guarda y el bono llega a quien invitó al pagarse el primer paquete (con cobertura de sedes)
- ✔ el código de referido es solo de quien lo pide, y otro estudio no lo obtiene

**clase de prueba: reserva y seguimiento (sin contactar → contactada → convertida)**

- ✔ la persona nueva reserva su clase de prueba y queda como «sin contactar»
- ✔ la recepción de ESA sede la ve y la marca como contactada; la de otra sede no la ve ni la toca
- ✔ «convertida» no se pone a mano: la pone sola la primera compra pagada
- ✔ una clienta no puede hacer una segunda clase de prueba

**comunicados para la clienta**

- ✔ la dueña publica; la clienta del estudio lo ve y lo marca leído; la de otro estudio no lo ve
- ✔ solo la dueña/gerencia publica, y solo para audiencias válidas; un aviso para instructoras no llega a clientas

**destinos seguros y cabeceras de incrustación**

- ✔ el destino tras entrar/registrarse solo puede ser una ruta interna
- ✔ solo /e/{slug} se puede incrustar; login, cuenta, panel, consola y API lo prohíben

### superficie_funciones.test.ts

**superficie de funciones expuestas**

- ✔ un visitante sin cuenta no puede ejecutar confirmar_pago_transaccion
- ✔ un visitante sin cuenta no puede ejecutar confirmar_transaccion_carrito
- ✔ un visitante sin cuenta no puede ejecutar devolver_clase_a_membresia
- ✔ un visitante sin cuenta no puede ejecutar gasto_productos_clienta
- ✔ un visitante sin cuenta no puede ejecutar otorgar_bono_referido_si_corresponde
- ✔ un visitante sin cuenta no puede ejecutar clientas_para_recordatorio_password
- ✔ un visitante sin cuenta no puede ejecutar usuario_tiene_password
- ✔ un visitante sin cuenta no puede ejecutar crear_sede
- ✔ un visitante sin cuenta no puede ejecutar plataforma_resumen
- ✔ un visitante sin cuenta no puede ejecutar mis_contextos
- ✔ un usuario con cuenta tampoco puede ejecutar la interna confirmar_pago_transaccion
- ✔ un usuario con cuenta tampoco puede ejecutar la interna confirmar_transaccion_carrito
- ✔ un usuario con cuenta tampoco puede ejecutar la interna devolver_clase_a_membresia
- ✔ un usuario con cuenta tampoco puede ejecutar la interna liberar_cupos_no_confirmados
- ✔ el visitante SÍ puede ver la página pública de un estudio (lista blanca)
- ✔ el webhook de pagos rechaza una firma falsa o un estudio inexistente (sin revelar nada)

## Escenarios de punta a punta

- ✔ crm    
- ✔ bill   
- ✔ sup    
- ✔ st     
- ✔ del    
- ✔ elig   
- ✔ shop   
- ✔ stock  
- ✔ pay    
- ✔ caja   
- ✔ gv     
- ✔ fel    
- ✔ com    
- ✔ qr     
- ✔ cat    
- ✘ auto   FALTA: [semanal nuevos>0=t, repetir=0, martes-no=t]
- ✔ espera 
- ✔ Último cupo: dos reservas simultáneas, solo una gana — confirmadas=1; segunda: Failed to run sql query: ERROR:  P0001: Ese horario ya no ti
- ✔ Gift card: dos canjes simultáneos, solo uno gana — membresías nuevas=0; segundo: Failed to run sql query: ERROR:  P0001: Este códig
- ✔ El visitante sin cuenta solo puede ejecutar las 7 funciones públicas
- ✔ Sin datos de prueba residuales
- 1 ESCENARIO(S) FALLARON
