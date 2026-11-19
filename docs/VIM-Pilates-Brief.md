# Brief para construir el CRM/booking de VIM Pilates

**Para quien retome esto en una conversación nueva de Claude Code**: este documento es autosuficiente. No tienes memoria de la conversación donde se escribió esto — todo lo que necesitas saber está aquí o en el código de referencia que se indica más abajo.

## 0. Contexto

Andrés López (el usuario) es CEO/Director de CSD Municipal y, aparte de eso, construyó junto con Claude Code un sistema completo de booking/CRM para **Forma Pilates**, un estudio de pilates en Guatemala (dueña: Mariana). El sistema le encantó a los dueños de **VIM Pilates** — un estudio de pilates **más grande**, con **3 sedes** en Guatemala:

1. C.C. Etú Plaza — 4a avenida 9-40, Zona 14, Nivel 4 — tel. 5645-1605
2. C.C. Plaza Decorísima — Blvd. Los Próceres 23-30, Zona 10, Nivel 2 — tel. 5019-7367
3. C.C. Vista Hermosa — 1a calle 18-83, Zona 15, Nivel 3 — tel. 4151-5755

Sitio actual: https://vim.com.gt · Instagram/Facebook: @vimgt. Hoy VIM NO tiene sistema de reservas en línea — todo es por llamada telefónica. Su marca usa tonos tierra (cafés, taupes cálidos), mensaje de bienestar integral ("El equilibrio perfecto comienza desde adentro"), y sus instructoras son fisioterapistas certificadas. Ofrecen Pilates Reformer (su foco principal), Mat, Pre/Post-natal, y acondicionamiento funcional.

Quieren lo mismo que tiene Forma Pilates, pero con la capacidad de operar sus 3 sedes: vistas por sede, empleados por sede, clientes por sede, y todo lo que eso implica.

## 1. ANTES de escribir una sola línea de código

**No asumas nada de diseño — pregúntale a Andrés directamente, en el chat, antes de tocar UI:**

1. Pídele **referencias visuales reales**: capturas de pantalla o links a la página web de VIM (ya tienes vim.com.gt, pero visítala tú mismo — WebFetch o similar — y pídele también capturas de su Instagram/Facebook, su logo en alta resolución si lo tiene, y cualquier manual de marca), para no inventar una paleta o tipografía que no coincida con su marca real.
2. Aclara estas preguntas de negocio ANTES de diseñar el esquema de sedes (la respuesta cambia bastante qué tan simple o compleja debe ser esa parte):
   - ¿Una clienta que se registra puede reservar en cualquiera de las 3 sedes, o queda amarrada a una sede "de origen"?
   - ¿El personal (instructoras, recepción) trabaja en una sola sede o rota entre varias?
   - ¿Los paquetes/membresías se compran por sede o son válidos en las 3?
   - ¿Quieren un panel consolidado (dueño ve las 3 sedes juntas) además de vistas por sede para cada encargada de sede?
   - ¿Van a tener número de WhatsApp Business y cuenta de Resend (correo) propios para VIM, o comparten infraestructura con algo que ya tengan?
   - ¿Dominio: van a comprar uno nuevo (ej. vim.business, o algo bajo vim.com.gt) o usar un subdominio?
3. No prometas fecha de entrega sin haber visto las respuestas de arriba — el rango de esfuerzo real está en la sección 6.

## 2. Qué es Forma Pilates — resumen funcional completo

Esto es el "checklist de paridad de funciones" — todo esto ya existe, probado en producción, y es lo que hay que igualar (adaptado a 3 sedes) para VIM:

**Clientas (portal público + `/mi-cuenta`)**
- Reservar clase de prueba gratis sin tener cuenta previa (crea la cuenta sola, login instantáneo en el mismo navegador vía magic link).
- Registro normal (correo+contraseña) y login con Google.
- Calendario semanal de clases regulares con cupo en tiempo real.
- Lista de espera automática cuando una clase está llena — si alguien cancela, se promueve sola a quien siga en la fila (y se le descuenta la clase de su paquete).
- Comprar paquetes/membresías (transferencia con comprobante, o tarjeta/efectivo en el estudio con activación instantánea).
- Cuentas familiares: una tutora puede agregar familiares (hijos/as, pareja, o quien sea — NO es solo para menores de edad, ej. una pareja que compra un pack familiar juntos) como "dependientes" (sin correo propio) y reservarles clases de prueba, paquetes normales, o un **pack familiar** (un solo paquete que consume toda la familia).
- "Mis clases": ver/cancelar/confirmar reservas propias Y de sus dependientes, ver lista de espera propia y de dependientes.
- Confirmación de asistencia con ventana de tiempo (si no confirma antes del plazo y la clase está llena, se libera el cupo automáticamente y se penaliza como cancelación tardía).
- Check-in por QR: un solo código fijo impreso en la entrada (no uno por clienta) — al escanearlo con su propio teléfono, se muestran como checkboxes todos los que califican ahora mismo (cuenta propia + familiares con reserva de hoy a esta hora), se puede marcar a varios de una vez, y si solo hay uno se marca solo sin fricción extra. **Resuelto en Forma Pilates el 2026-09-14** — ver sección 6, ítem 11, para el diseño exacto.
- Recordatorio de "no olvides tu clase" (correo, más tarde que la confirmación instantánea) — 24h después de reservar si faltaba más de un día para la clase; 3h antes de la clase si la reserva fue de último momento.
- Catálogo aparte de "Clases privadas" (paquetes y horario propio, categoría separada del calendario regular).
- Consentimiento informado (debe firmarlo antes de poder seguir reservando).
- Programa de referidos con código propio.
- Gift cards.
- Encuestas de satisfacción.

**Staff / admin**
- Roles: dueña, empleada, instructora, contadora — cada una ve un subconjunto distinto del panel.
- Horarios: crear clases recurrentes semanales o puntuales (una sola fecha), cancelar una fecha puntual (avisa automático a quien tenía reserva y le devuelve la clase), **privatizar una fecha de una clase regular** para una sesión personalizada (1 o más personas, cada una con su propio cobro — esto NO es lo mismo que "clase privada", ver nota abajo), eliminar una clase para siempre.
- Gestión de clientas: buscador por nombre/correo/teléfono, ver detalle, agregar paquete a mano, agregar familiar a mano, eliminar cuenta (con protección para no borrar sin querer el acceso de alguien que también es staff).
- Pagos pendientes: confirmar transferencias, marcar pagos en efectivo, ver comprobantes.
- Ingresos: por método de pago, por paquete, fechas privatizadas, clases privadas.
- Estadísticas: ocupación por horario (mapa de calor día×hora), embudo de conversión de prueba a paquete, retención/churn, adquisición (CAC/LTV por canal), ranking de instructoras, "Centro de mando" (leads sin contactar, clientas sin contraseña, consentimiento pendiente, cuentas sin actividad, pagos pendientes, membresías por vencer) — es la pantalla de entrada de la dueña, pensada para que no tenga que ir fila por fila en /admin/clientes adivinando a quién le falta qué (confusión real reportada por las dueñas de Forma Pilates).
- Riesgo de fuga: panel de clientas que dejaron de reservar, para seguimiento manual.
- Campañas de WhatsApp (requiere plantilla aprobada por Meta) y correos masivos.
- Log de auditoría: quién hizo qué (privatizar, cancelar, eliminar cuenta, cambiar rol de staff, etc.) — importante con más de una persona con acceso admin, y MÁS importante todavía con 3 sedes y presumiblemente más personal.
- Exportar datos (CSV) de varias vistas.

**Automatizaciones (crons)**
- Recordatorio de membresía por vencer (una vez, 3 días antes).
- Recordatorio de inactividad (paquete activo, 14+ días sin reservar).
- Recordatorio de "termina de crear tu contraseña" (24h después de crear cuenta sin completarla).
- "¿Cómo te fue en tu prueba?" el mismo día de la clase de prueba.
- "Te extrañamos" si no marcó asistencia.
- Liberación automática de cupos no confirmados a tiempo.
- Recordatorio de clase en 1 hora.

## 3. Arquitectura técnica a replicar

Dos repos Next.js (App Router) compartiendo una sola base de datos Postgres (Supabase):

- **Web** (equivalente a "Frontend" de Forma Pilates): Next.js completo (server components + API routes), Vercel. Es la ÚNICA fuente de verdad para rutas que usan `service_role`, envío de correo/WhatsApp, y **todas las migraciones SQL viven aquí, nunca en el otro repo**.
- **App** (Capacitor): export estático (`output: 'export'`), 100% client components, llama a las rutas API del repo Web vía una constante `WEB_API_BASE` para todo lo que necesite `service_role`/correo/WhatsApp. Este repo NO tiene sus propias migraciones ni rutas API propias.

Infraestructura por proyecto (repetir para VIM, todo NUEVO y separado de Forma Pilates — nunca reusar el proyecto de Supabase ni las llaves de Forma Pilates):
- Supabase (Postgres + Auth + Storage) — proyecto nuevo.
- Vercel — dos proyectos (uno por repo), dominio propio de VIM.
- Resend (correo transaccional) — cuenta/dominio propio de VIM.
- WhatsApp Business Platform (Meta) — número y plantillas propias de VIM.
- Firebase (push notifications) — proyecto propio si se replica esa parte.

**Auth**: JWT nativo de Supabase, roles vía tabla `perfiles` (no vía metadata de auth). RLS habilitado en todas las tablas.

## 4. Lo nuevo que hay que construir para VIM: sedes

Esto es lo que Forma Pilates NO tiene y VIM sí necesita. Diseño recomendado (a confirmar con las respuestas de la sección 1):

- Tabla `sedes` (id, nombre, dirección, teléfono, activo).
- `horarios.sede_id` — cada horario pertenece a una sede. Como `reservas` ya cuelga de `horario_id`, la mayoría de las funciones de reserva/cupo/lista de espera **heredan la sede automáticamente sin tocarlas** — el trabajo real está en las vistas de admin (filtrar por sede) y en los permisos de staff.
- `perfiles` necesita saber a qué sede(s) pertenece cada empleada/instructora — probablemente una tabla puente `perfiles_sedes` (muchos a muchos) en vez de una sola columna, por si alguien rota entre sedes.
- `clientes`: probablemente NO debe amarrarse a una sola sede (una clienta de VIM puede querer reservar en cualquiera de las 3) — pero confírmalo con Andrés.
- RLS: cada política que hoy dice "cualquier staff ve todo" tiene que volverse "staff ve lo de su(s) sede(s), dueña ve todo". Esto es lo más laborioso: revisar cada policy de cada tabla.
- UI: selector de sede en casi todas las pantallas de admin (horarios, reservas, clientes, pagos, estadísticas), y una vista consolidada para la dueña.
- Reportes: todo lo de Estadísticas necesita una versión "por sede" y una "las 3 juntas".

## 5. Plan de fases recomendado

**No intentes diseñar el sistema de sedes completo antes de empezar.** Orden sugerido:

1. **Copiar y desacoplar**: clonar ambos repos con nombre nuevo, nuevo Supabase, nuevo Vercel, nuevo dominio. Correr TODAS las migraciones de Forma Pilates en la base nueva (revisa el orden — hay algunas migraciones viejas que no están en el historial de git, ver sección 7). Verificar que el sistema funciona igual que Forma Pilates pero con la marca de VIM, SIN sedes todavía (una sola sede implícita).
2. **Rebranding real**: colores, tipografía, logo, copy — con las referencias visuales que te dé Andrés.
3. **Sedes, capa 1**: tabla `sedes`, `horarios.sede_id`, selector de sede en horarios/reservas/clientes, RLS básico.
4. **Sedes, capa 2**: staff por sede y permisos, vista consolidada para dueña.
5. **Sedes, capa 3**: reportes/estadísticas por sede + consolidado, campañas segmentadas por sede.

**Estimado honesto**: la fase 1-2 (copia + rebrand, sin sedes) es cuestión de días. Sedes completas (fases 3-5) es un trabajo de **3 a 6 semanas** de trabajo enfocado y cuidadoso, no de días — el sistema tiene ~30 funciones de base de datos y ~35 pantallas de admin, y meter "sede" como dimensión nueva toca una fracción grande de eso. No comprimas esto para cumplir una fecha — la sesión donde se construyó Forma Pilates tuvo varios episodios de "se rompió algo en producción por apurar un cambio", y el dueño (Andrés) es explícitamente sensible a esto.

## 6. Trampas y lecciones aprendidas (léelo con cuidado, cuesta caro repetirlas)

Todo esto pasó de verdad en Forma Pilates y costó horas encontrarlo y arreglarlo. Si copias el patrón de código correcto desde el inicio, te ahorras repetir el error:

1. **`auth.uid()` es null cuando una ruta API llama un RPC con el cliente de `service_role`.** Si un RPC valida `if not exists (select 1 from perfiles where id = auth.uid() and rol='duena') then raise exception 'No autorizado'`, y una ruta Next.js llama ese RPC con `createAdminClient()` (service_role) en vez de con la sesión real del usuario que autenticaste en la misma ruta, el RPC SIEMPRE va a rechazar con "No autorizado" — sin importar quién sea el usuario real. La ruta debe llamar el RPC con el cliente autenticado del usuario (`getAuthedClient(request)` → `supabase.rpc(...)`), reservando `service_role` solo para lecturas/escrituras directas a tablas que no dependen de `auth.uid()`.
2. **Cambiar la firma de una función Postgres (agregar/quitar parámetros, o cambiar las columnas de un `returns table`) requiere `drop function if exists nombre(firma_vieja)` antes del `create or replace function` con la firma nueva** — si no, quedan dos versiones coexistiendo (ambigüedad) o Postgres rechaza el cambio.
3. **`create policy` no es idempotente** — un segundo `create policy` con el mismo nombre falla con "ya existe". Usa siempre `drop policy if exists "nombre" on tabla; create policy ...`.
4. **El teléfono es un identificador, no solo un dato de contacto** — se usa para no duplicar cuentas (emparejar un "lead" sin cuenta con quien se registra después). Si el campo de teléfono no se valida (formato, longitud), cualquiera puede escribir el teléfono de otra persona y heredar su historial, o el emparejamiento simplemente no funciona porque el dato es basura. Valida SIEMPRE 8 dígitos (o el formato que aplique en el país de VIM) tanto en el formulario como en el RPC que lo recibe, y no dejes que un formulario público sobreescriba el nombre/correo de una fila ya existente solo porque alguien escribió el mismo teléfono.
5. **Identidad/seguridad de cuentas**: cualquier función que "reclama" una fila de cliente existente sin dueño (`user_id is null`) por teléfono o correo debe verificar que quien la reclama de verdad es esa persona. El diseño que se usó en Forma Pilates: por correo SÍ se puede auto-reclamar (viene de una sesión ya autenticada/verificada por Supabase o Google), por teléfono NO (es texto libre sin verificar) — si solo coincide el teléfono, se trata como cuenta nueva, nunca se fusiona sola.
6. **Cuentas familiares (dependientes) tocan CASI todo**: reservar, cancelar, confirmar asistencia, lista de espera, reembolso de clase al cancelar — cada una de esas funciones tiene que preguntarse explícitamente "¿esto también debe funcionar si la reserva es de un dependiente, no de la tutora misma?". En Forma Pilates, la primera versión de "pack familiar" solo cubrió reservar directo, y se encontraron y arreglaron 4 huecos reales después (tutora no podía ver/cancelar la clase de un hijo, reembolso no respaldaba al paquete familiar compartido, lista de espera no revisaba el paquete familiar, tutora no podía anotar a un hijo en lista de espera). Si VIM va a tener cuentas familiares, diseña estas 4 cosas desde el principio, no las agregues después.
7. **Migraciones**: se corren a mano en el SQL Editor de Supabase (no hay CLI/CI corriendo esto). Cada migración debe ser una sola transacción idempotente — si algo falla a medias, Supabase revierte TODO el script pegado, así que no asumas que "una parte ya corrió" sin verificarlo con una consulta directa.
8. **No pruebes en producción a ciegas**: cuando se agregó una feature que toca dinero/permisos, la validación real fue crear una cuenta de prueba temporal (marcada claramente, ej. prefijo "QATEST"), correr el flujo completo con una sesión real autenticada (no solo con `service_role`, que se salta RLS y puede ocultar bugs de permisos), y borrar la cuenta de prueba por completo al terminar. Esto encontró bugs que `tsc`/`eslint`/`npm run build` nunca hubieran encontrado.
9. **KPIs/reportes**: cualquier reporte que agrupe por horario/clase debe filtrar explícitamente por categoría (regular vs. privada) y excluir clases puntuales de una sola fecha si el reporte asume un patrón semanal recurrente — si no, una clase privada de cupo 1 se cuela y ensucia el promedio.
10. **Notificaciones: "confirmó bien" y "avisó a alguien" NO son lo mismo — hay que revisarlo explícitamente para CADA acción que cambia datos, no asumir que viene incluido.** Caso real en Forma Pilates: reservar una clase de PRUEBA sí avisaba al staff (vía `notificarAdmins`), pero reservar una clase REGULAR (la función más usada del sistema, `agendar_clase`) nunca avisó a nadie desde que se construyó — ni a la clienta, ni al staff — un hueco que nadie notó hasta que una clienta agregó a su esposo como familiar y reservaron los dos, y a la dueña no le llegó ningún correo de ninguna reserva. Mismo patrón con "agregar dependiente/familiar": el correo solo avisaba a la TUTORA, nunca al staff — si la clienta lo hacía sola desde "Mi familia" (sin que staff interviniera), nadie del equipo se enteraba. Antes de dar por completa una función que crea/cambia algo, pregúntate explícitamente: ¿a quién le debería llegar un aviso de esto (clienta, staff, ambos), y hoy le está llegando de verdad? No asumas que "ya se construyó algo parecido en otra función" significa que esta también lo tiene.
11. **Check-in por QR y cuentas familiares no se llevan bien por diseño, sin un ajuste explícito — RESUELTO en Forma Pilates el 2026-09-14, copia el diseño final.** El QR es UNO SOLO, fijo en la entrada — lo escanea el teléfono/sesión de quien sea que lo tenga en la mano, y el sistema resolvía "de quién es esta reserva" solo a partir de esa sesión (`auth.uid()`). Un familiar (hijo, pareja) no tiene su propio login — antes de este fix, era sencillamente IMPOSIBLE que se auto-marcara asistencia. Diseño final: al escanear, un RPC (`checkins_disponibles()`) devuelve TODOS los que califican ahora mismo (la cuenta con sesión + sus familiares, cada uno con reserva de hoy dentro de -15/+20 min de la hora actual) — el cliente los muestra como **checkboxes** (no un selector de uno solo — la dueña pidió explícitamente poder marcar a varios a la vez, ej. la tutora escanea y marca su asistencia y la de su pareja juntas), todos pre-marcados por default, con un botón "Confirmar asistencia" que llama `hacer_checkin_multiple(uuid[])`. Si solo hay un candidato, se salta el picker y se marca solo, sin fricción extra para el caso común.
12. **Al agregar una columna nueva tipo `_enviado_at` para un recordatorio nuevo, las filas VIEJAS que ya existían quedan elegibles de una sola vez — hay que hacer backfill ANTES de que el cron corra, o manda un correo masivo sorpresa.** Pasó en Forma Pilates: al agregar `recordatorio_agendada_enviado_at` a `reservas`, 187 reservas reales (hechas semanas antes de que existiera esta feature) quedaron con la columna en `null` — es decir, "elegibles ahora mismo" — y el cron corre cada 15 minutos. Se detectó llamando el RPC a mano ANTES de que corriera el cron, y se arregló con un `update ... set recordatorio_x_enviado_at = now() where ... is null` corrido de emergencia antes del siguiente ciclo. Regla general: cualquier migración que agregue una columna de "ya se avisó" a una tabla con filas existentes necesita, en la MISMA migración (no después), un `update` que marque las filas viejas como ya cubiertas — nunca asumas que "está vacío para todos, va a estar bien".
13. **Un `dependiente`/familiar sin correo/login propio hace que CUALQUIER notificación dirigida "al cliente" tenga que decidir a quién le llega de verdad — revísalo en cada función nueva, no solo en las obvias.** Se encontró el mismo hueco 3 veces separadas en la misma noche en Forma Pilates: el cron de "tu clase es en 1 hora", el nuevo cron de "no olvides tu clase", y la confirmación instantánea de reserva — los tres, en su primera versión, mandaban correo/push solo a `cliente.email`/`cliente.user_id`, que para un familiar siempre es `null`, así que el aviso simplemente nunca salía, en silencio, sin error. El patrón correcto: si `cliente.email` es null pero `cliente.tutor_id` existe, buscar el correo/`user_id` de la fila de la tutora (`select ... from clientes where id = tutor_id`) y usar eso como destino de respaldo — y en el texto del correo, aclarar de quién es la clase ya que le está llegando a la bandeja de otra persona (ej. "Hola, [Tutora] — la clase de [Familiar] quedó confirmada...").

## 6b. Actualización 2026-09-17 — qué cambió en Forma Pilates desde que se escribió este brief

**Este brief se quedó desactualizado varios días** (se construyó mucho en Forma Pilates sin volver a tocar este documento). Si retomas VIM después de esta fecha, lo de abajo son cosas NUEVAS que no estaban cuando se escribió la sección 2-6 original — o corrige el checklist de paridad, o son lecciones nuevas para la sección 6.

**Nuevo en el checklist de funciones (sección 2):**
- **Centro de pagos** (`/admin/centro-pagos`, solo dueña): pantalla tipo "caja" — buscar clienta, elegir paquete, código de descuento (dropdown filtrado a los que aplican al paquete elegido), método de pago, cobrar — todo en un solo lugar, en vez de ir a Clientes y expandir una fila. Incluye "Cobros pendientes de hoy" (colapsable): junta paquetes y sesiones privadas sin pagar, marca si esa clienta tiene clase hoy y a qué hora, con botón para marcar cobrado ahí mismo. Total "Cobrado hoy" (Q) visible arriba, se actualiza en vivo. Atajo de "clientas frecuentes" (chips con quienes más se les ha cobrado). Usa el mismo RPC (`agregar_membresia_manual`) que ya usa "Clientes", así ambas pantallas comparten la lógica de negocio — cualquier cobro aparece automático en Ingresos/Estadísticas/Exportar sin tocar esas pantallas.
- **Códigos de descuento multi-paquete**: antes un código solo podía amarrarse a UN paquete o a "cualquiera" (`codigos_descuento.paquete_id`, FK único nullable). Ahora es una tabla de relación (`codigos_descuento_paquetes`, muchos a muchos) — un código puede aplicar a varios paquetes específicos a la vez. Si construyes VIM desde cero, arranca directo con la tabla de relación, no repitas el FK único.
- **Código de descuento en el flujo manual de la dueña**: antes `agregar_membresia_manual()` no aceptaba ningún código — solo el autoservicio de la clienta (`solicitar_membresia()`) podía aplicar uno. Ahora ambas funciones comparten una función interna (`_aplicar_codigo_descuento`) que valida y marca usado el código — la lógica de descuento vive en un solo lugar, no duplicada.
- **Push notifications** (iOS vía APNs directo, Android vía FCM) quedaron resueltas de punta a punta, probadas en dispositivo real — ver lección nueva #14 abajo, el bug real no tenía nada que ver con permisos ni configuración de Firebase.
- Notificaciones de negocio completas: recordatorio de confirmación ANTES de perder el cupo (no solo el aviso post-hoc), lista de espera vencida sin cupo, confirmación de asistencia por push, avisos operativos de "clase por comenzar/terminar" para staff.
- "Agregar a calendario" nativo en la app (iOS): usa el picker de EventKit (`createEventWithPrompt`), no `window.print()`/share sheet genérico — más simple y es lo que de verdad "se siente nativo".
- Botón de imprimir el QR de asistencia: en la app nativa hay que usar la hoja de compartir de iOS (`@capacitor/share`) en vez de `window.print()` — WKWebView no tiene diálogo de impresión propio.

**Lecciones nuevas para la sección 6 (trampas que costaron tiempo real):**

14. **Un fetch autenticado desde la app a un dominio sin "www" que redirige (308) a "www" pierde el header `Authorization`** — el navegador/WKWebView descarta headers sensibles en redirecciones entre orígenes distintos (aunque sea el mismo dominio registrable). Si `WEB_API_BASE` no es la URL EXACTA sin redirección de por medio, cualquier fetch con `Authorization: Bearer` falla en silencio. Verifica esto con `curl -I` antes de fijar la constante, no asumas que "casi la misma URL" es intercambiable.

15. **Casi todos los botones de "Cancelar/Eliminar/Confirmar" de este sistema usan `window.confirm()` nativo — y el entorno de pruebas automatizadas con navegador (Claude in Chrome u otro) lo descarta en silencio, sin colgar, sin error.** Si vas a probar VIM con un agente de navegador, un botón "no responde" en la prueba automatizada NO significa que esté roto — puede ser solo el diálogo de confirmación bloqueado por la automatización. Verifica dos veces (otro método de clic, o probar el RPC directo vía API) antes de reportar algo como bug real. Pasó 3 veces en la misma tarde en Forma Pilates — todas fueron falsos positivos.

16. **Nunca corras agentes de navegador EN PARALELO contra el mismo Chrome para probar distintas cuentas** — el login de este sistema es una cookie de sesión compartida por todo el navegador, no por pestaña. Dos agentes logueándose con cuentas distintas al mismo tiempo se pisan la sesión en tiempo real sin avisar, y puede generar acciones reales (reservas, cobros) bajo la identidad equivocada. Prueba con cuentas distintas SIEMPRE en secuencia (login → probar → logout confirmado → siguiente cuenta), nunca en paralelo, aunque sea más lento.

17. **Toda tabla/columna nueva que agregues necesita el GRANT explícito además de RLS** — habilitar RLS y crear políticas no alcanza; Postgres también exige `grant select/insert/... on tabla to authenticated/service_role` por separado. Pasó 3 veces distintas en Forma Pilates (con `push_tokens`, y de nuevo con `avisos_operativos_enviados`) — el síntoma es "permission denied for table X" incluso con políticas de RLS que deberían permitirlo. Agrega el GRANT en la MISMA migración que crea la tabla, no lo dejes para después.

18. **`ORDER BY <alias>` dentro de una función con `RETURNS TABLE(... <mismo_nombre> ...)` es ambiguo para Postgres** — si la función devuelve una columna llamada, por ejemplo, `nombre`, y la consulta interna también selecciona algo con alias `nombre`, un `order by nombre` al final falla en tiempo de ejecución (no al crear la función) con "ORDER BY nombre is ambiguous". Usa orden por posición (`order by 3, 7`) en vez de por nombre cuando el nombre de columna de retorno pueda chocar con un alias de la consulta.

## 6c. Actualización 2026-09-22 — cierre de caja, exports y otra repetición del bug de GRANT

**Nuevo en el checklist de funciones (sección 2):**
- **Cierre de caja** (dentro de `/admin/centro-pagos`, solo dueña): calcula lo "esperado" del día por método de pago (efectivo, tarjeta en estudio, transferencia — **el pago en línea/pasarela se excluye siempre**, porque ese dinero nunca pasa por la caja física) sumando membresías + privadas + tienda pagadas ese día. La dueña cuenta físicamente y anota el "contado" por método; el sistema muestra la diferencia. Guarda histórico completo por fecha (upsert por día, corregible). Tabla `cierre_caja` sin ningún GRANT directo a `authenticated` a propósito — se accede solo por RPCs `security definer` (`caja_esperado_del_dia`, `cerrar_caja`, `historial_cierres_caja`), así ni RLS ni GRANT de la tabla pueden bloquearlo por accidente (ver lección #19 abajo). Copia este patrón para cualquier tabla de dinero/auditoría en VIM: RPC-only, cero acceso directo desde el cliente.
- **Exports ampliados**: además de lo que ya listaba este brief, ahora también exportables en CSV — ventas de tienda (`pedidos` + items), clases privadas cobradas, cierre de caja (histórico completo con sistema/contado/diferencia por método), y dentro del export de "Métricas del negocio": % cancelación y % reagendo de clase de prueba (con detalle nombre por nombre) y metas mensuales (objetivo vs. real vs. % de avance). Regla general para VIM: cualquier pantalla que la dueña usa para tomar decisiones de negocio necesita su botón de exportar CSV desde el día que se construye, no como algo que se agrega después.

**Lecciones nuevas para la sección 6:**

19. **El bug de "falta el GRANT" (lección #17) volvió a pasar una CUARTA vez, ahora con `metas_mensuales`** — tabla con RLS y políticas bien escritas, pero sin `grant select, insert, update ... to authenticated`, así que el botón "Guardar" de la pestaña Metas no hacía nada (ni error visible: el `SELECT` inicial tampoco tenía permiso, así que la pantalla mostraba silenciosamente "sin meta" en vez de fallar con un error claro). Van CUATRO veces que este mismo patrón cuesta tiempo real en Forma Pilates (`push_tokens`, `avisos_operativos_enviados`, y ahora `metas_mensuales`). **Para VIM: evita el patrón por completo.** Dos formas de hacerlo:
    - **Preferida**: cualquier tabla nueva se accede SOLO por RPC `security definer` (como se hizo con `cierre_caja` arriba) — nunca necesita GRANT a `authenticated` porque el cliente nunca la toca directo, y el bug entero deja de ser posible.
    - Si de verdad hace falta acceso directo por RLS (como `metas_mensuales`, para que la lectura sea rápida sin round-trip a un RPC), agrega el `grant` en la MISMA migración que crea la tabla, y después de escribir la migración, verifica con una consulta directa contra `information_schema.role_table_grants` que el rol `authenticated` de verdad tiene los privilegios esperados — no confíes en que "puse las políticas RLS" es suficiente.
    - Además: cualquier código que haga un `.from(tabla).select(...)` o `.upsert(...)` desde el cliente DEBE revisar el `error` que regresa y mostrarlo al usuario (aunque sea un texto genérico) — un fallo de permisos silencioso, sin mensaje de error visible, es indistinguible de "el botón no funciona" para quien lo usa, y así fue como se reportó este bug.

20. **Un mismo diccionario de labels (`METODO_LABEL`, `ESTADO_LABEL`, etc.) copiado y pegado en 8+ archivos distintos se desincroniza solo, sin que nadie lo note** — en Forma Pilates, `tarjeta_estudio` tenía el texto correcto ("Tarjeta en estudio") en 2 archivos y el texto confuso ("Tarjeta/efectivo", mezclado con el método `efectivo` que es una cosa aparte) en otros 6, acumulado a lo largo de varias semanas de features distintas tocando el mismo concepto sin coordinarse. Para VIM: define estos diccionarios de traducción UNA sola vez en un archivo compartido (ej. `lib/labels.ts`) e impórtalo donde se necesite, en vez de escribir `const METODO_LABEL = {...}` de nuevo cada vez que una pantalla nueva necesita mostrar el método de pago.

## 6d. Actualización 2026-09-22 (tarde) — auditoría completa de errores silenciosos

Tras el bug real de metas_mensuales, se hizo una auditoría sistemática de TODO Forma Pilates buscando dos patrones, no solo el que ya había fallado. Vale la pena correr esta misma auditoría en VIM cada cierto tiempo (o mejor, evitar el patrón desde el diseño, como dice la lección #19):

**Auditoría 1 — GRANT faltante**: se sacó de la base real la lista de privilegios (`information_schema.role_table_grants`) de `authenticated`/`anon` para cada tabla, y se cruzó contra un scan del código buscando todo `.from('tabla').select/insert/update/upsert/delete(` en componentes cliente y páginas — cualquier tabla que el navegador toca directo pero que le falta el privilegio correspondiente es un bug de este tipo. Se descartaron los falsos positivos que en realidad usan `admin.from(...)` (service_role, no le aplican los GRANTs). Resultado en Forma Pilates: cero casos nuevos — el diseño RPC-only ya tapaba el resto.

**Auditoría 2 — escritura sin revisar error**: se buscó todo `await supabase.from(...).insert/update/upsert/delete(...)` o `.rpc(...)` que NO desestructura `{ error }` del resultado (fire-and-forget). Se encontraron y arreglaron 3 casos reales de impacto real:
- Códigos de descuento (crear/editar): si fallaba la tabla de relación código↔paquete/producto, el código quedaba activo aplicando a TODO el catálogo en silencio, porque "sin filas de relación" se interpreta como "sin restricción" en el resto del sistema. Para VIM: cualquier feature donde "fila vacía" signifique "aplica a todo" es especialmente peligrosa si la escritura de esas filas puede fallar a medias — considera un default explícito ("aplica a ninguno") en vez de uno implícito por ausencia de datos.
- Carrito de tienda: dos de tres acciones (cambiar cantidad, agregar paquete) no avisaban si fallaban, aunque la tercera (agregar producto) en el MISMO archivo sí lo hacía bien — inconsistencia dentro del mismo componente, fácil de que pase si cada función se escribe en un momento distinto sin repasar las anteriores.
- Login con Google/Microsoft: un paso no esencial (confirmar una reserva pendiente) sin try/catch podía tumbar TODO el callback de OAuth si fallaba la red, dejando a la persona en una página de error en vez de en su cuenta — un paso "best effort" documentado como tal en el comentario, pero sin el try/catch que ese diseño exige.

**Regla general para VIM**: cuando escribes `await supabase.algo(...)`, pregúntate explícitamente "si esto falla, ¿el usuario se entera?" antes de seguir. Si la respuesta es no y no es a propósito (como el caso de OAuth arriba, que SÍ es intencional pero necesitaba el try/catch), es un bug.

## 7. Dónde está el código de referencia

En esta misma computadora (Mac de Andrés):
- `/Users/AndresLOpez/Desktop/Forma Pilates/Frontend` — repo web completo, con TODAS las migraciones en `supabase/migrations/*.sql` (en orden cronológico por nombre de archivo).
- `/Users/AndresLOpez/Desktop/Forma Pilates/App` — repo Capacitor.

Estos son la fuente de verdad — cópialos como punto de partida en vez de reescribir todo desde cero, pero **NUNCA los edites ni les hagas push** — son de Forma Pilates, un cliente real y activo (abre en ~12 días desde que se escribió este documento). Trabaja siempre en copias/repos nuevos para VIM.

Nota: no todas las migraciones históricas de Forma Pilates están en el control de versiones (algunas tablas base se crearon fuera del repo en una sesión anterior) — al levantar la base nueva de VIM, es más seguro ir corriendo las migraciones en orden y verificar contra el código (`grep` de qué tablas/columnas espera el TypeScript) en vez de asumir que el historial de `supabase/migrations/` es 100% completo.

## 8. Cómo trabajar con Andrés

- No es desarrollador — quiere respuestas directas, sin rodeos técnicos innecesarios.
- Prefiere que se le recomiende una sola opción clara en vez de una lista de alternativas para que él decida.
- Avísale ANTES de cualquier acción irreversible (borrar datos, force-push, cambios de esquema en producción).
- Una vez que aprueba una tarea, prefiere que se ejecute de corrido sin pausar a pedir permiso en cada paso — pero sí avisar antes de un push a producción o un cambio de datos reales.
- Le estresa mucho que algo quede "a medias" y se descubra roto después en producción — prioriza probar de verdad (no solo que compile) sobre ir rápido.
- Antes de cada `git push`/`vercel deploy` en este proyecto nuevo, verifica explícitamente qué credencial de CLI (GitHub/Vercel) va a usar la terminal — Andrés tiene otros proyectos (CRM Municipal, ClubOs) y a veces la terminal reusa por defecto el login de otro de ellos, lo que puede hacer que un deploy falle o quede a nombre de la cuenta equivocada. **Aclaración importante: esto es solo un problema de "qué cuenta firma el push/deploy" — nunca ha mezclado ni puede mezclar datos reales de negocio entre proyectos, porque cada uno tiene su propia base de datos (Supabase) completamente separada e independiente.**
