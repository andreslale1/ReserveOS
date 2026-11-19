# Guion de pruebas para ti (sin código)

Sirve para recorrer ReserveOS **como lo usaría cada persona** y confirmar que todo se ve y funciona. Hazlo en
`https://reserveos.app`. Anota cualquier cosa rara con una captura y dime en qué paso fue.

**Antes de empezar:** necesitas tu cuenta de operador (la tuya). Para el resto, **vas a crear un estudio de prueba desde cero**:
así pruebas también el alta. Usa correos que controles (por ejemplo, `tunombre+duena@gmail.com`, `tunombre+clienta@gmail.com`).

---

## 1. Tú, como dueño de ReserveOS (`/login` → te lleva a `/owner/direccion`)

| # | Qué hacer | Qué debe pasar |
|---|---|---|
| 1.1 | Entra a **Dirección** | Ves tarjetas (tareas, cobros, soporte…). Si está vacío, un mensaje te dice cómo empezar. |
| 1.2 | **Pipeline → + Nuevo prospecto** (gimnasio de prueba, tu contacto, valor 1500) | Aparece en la columna *Prospecto*. |
| 1.3 | Abre el prospecto: agrega un contacto, registra una llamada, crea una tarea para hoy | Todo queda en su ficha. En **Tareas** aparece la tarea de hoy. |
| 1.4 | En la ficha: **Crear propuesta** (plan, sedes, mensualidad) → **enviada** → **aceptada** | La oportunidad pasa a *Ganado* y en **Activaciones** nace un proyecto con su lista. |
| 1.5 | En la propuesta aceptada: **Crear contrato** | Aparece en **Contratos** con su fecha de vencimiento. |
| 1.6 | **Estudios → Crear estudio** (nombre, identificador, sede, correo de la dueña) | Te da un enlace de invitación para la dueña. |
| 1.7 | **Planes**: revisa los planes; en el estudio nuevo **Plan y módulos → Aplicar plan "profesional"** | Los módulos del plan quedan activos; los demás, apagados. |
| 1.8 | **Cobros → Suscripción** del estudio: precio 800, día 5 → **Generar cobros de este mes** | Aparece el cobro. Pulsa de nuevo "Generar": **no** debe duplicarse. |
| 1.9 | **Registrar pago** parcial (300) y luego el resto | Pasa a *parcial* y luego *pagado*; el saldo baja bien. |
| 1.10 | **Rentabilidad**: registra un costo | Cambia el margen del mes. |
| 1.11 | **Marketing → nueva campaña** con fuente `prueba-1`; abre `reserveos.app/contacto?fuente=prueba-1` en otra pestaña y envía el formulario | Aparece un prospecto nuevo con esa fuente y una tarea "Responder consulta". |
| 1.12 | **Soporte**: mira que esté vacío ahora; vuelve tras el paso 2.14 | El ticket de la dueña aparece. |
| 1.13 | **Salud**, **Equipo**, **Auditoría**, **Dominios** | Cargan sin errores. En Auditoría ves lo que hiciste. |

## 2. La dueña del estudio (abre el enlace de invitación en una ventana privada)

| # | Qué hacer | Qué debe pasar |
|---|---|---|
| 2.1 | Activa su cuenta con la invitación | Entra a `/panel`. |
| 2.2 | **Configuración**: nombre, color, logo; **Reglas de reserva** (cancelar con 2 h, 14 días) | Se guarda. Copia el enlace público `/e/su-identificador` y ábrelo sin sesión: se ve su página. |
| 2.3 | **Sedes → Nueva sede**; **Salas → nueva sala** | Se crean. |
| 2.4 | **Paquetes**: crea "Mensual 8 clases", Q800, 30 días | Aparece en la lista. |
| 2.5 | **Calendario**: crea una clase para mañana, cupo 2 | Aparece. Intenta crear otra a la misma hora con la **misma instructora**: debe rechazarla. |
| 2.6 | **Personal → invitar** a una recepción (tu otro correo) | Te da un enlace. |
| 2.7 | **Clientas → Importar CSV** (un archivo con 3 filas, una repetida) | Revisa antes de guardar; dice cuántas son válidas y por qué omite las otras. |
| 2.8 | **Clientas → una ficha → Vender paquete** (efectivo) | La clienta queda con 8 clases. Intenta venderla otra vez a la misma venta en Facturación (paso 2.12). |
| 2.9 | **Clientas → Reservar por ella** en la clase de mañana | Se descuenta 1 clase. |
| 2.10 | **Caja**: mira lo esperado del día y ciérrala | El efectivo esperado coincide con la venta. |
| 2.11 | **Productos**: crea "Camiseta", entrada de 5 con motivo; intenta sacar 9 | Rechaza (no hay stock). El movimiento aparece en la lista. |
| 2.12 | **Facturación**: datos del emisor → *Generar factura* de la venta | IVA = monto ÷ 1.12 × 0.12. Márcala "Ya la emití". |
| 2.13 | **Gift cards → vender** una (efectivo) | Entra a la caja del día. Anula otra y comprueba que ya no se puede canjear. |
| 2.14 | **Soporte → nuevo caso** "Prueba de soporte" | Lo ves en tu lista; tú (operador) respondes y la dueña ve la respuesta. |
| 2.15 | **Delegaciones**: intenta que la recepción registre un gasto → primero rechaza; luego delega a "Recepción" la acción *Registrar gastos* | Ahora sí puede. Revócala y vuelve a rechazar. |
| 2.16 | **Campañas**: crea un segmento y una campaña | Dice cuántas personas la recibirían **solo con consentimiento**. Verás el aviso de que no hay proveedor conectado (los mensajes quedan en cola). |
| 2.17 | **Reportes**, **Seguimiento**, **Gastos y balance**, **Finanzas**, **Auditoría**, **Agenda del personal** | Cargan; Finanzas muestra "Ingresos por sede" y dice si cuadra. |

## 3. La clienta (otra ventana privada, con su correo)

| # | Qué hacer | Qué debe pasar |
|---|---|---|
| 3.1 | Activa la cuenta desde su invitación → entra a `/cuenta` | Ve su saldo y próximas clases. |
| 3.2 | **Perfil**: completa emergencia y **firma el consentimiento**; activa "recibir promociones" | Se guarda. |
| 3.3 | **Clases**: otra clase llena → "Lista de espera"; una clase sin paquete que la cubra | Dice **por qué** no puede reservar y te lleva a *Paquetes*. |
| 3.4 | **Reservar** y luego **Cancelar** con menos horas de las permitidas | Avisa que no se devuelve la clase (según la regla). |
| 3.5 | **Paquetes → Comprar** (transferencia + referencia) | Queda "pago pendiente"; en el panel aparece en *Pagos pendientes*; al aprobarlo se activa. |
| 3.6 | **Tienda**: agrega la camiseta y haz el pedido | La recepción lo ve y lo confirma. |
| 3.7 | **Canjear** un código de gift card | Se activa un paquete; no se puede usar otra vez. |
| 3.8 | **Historial → Solicitar reembolso** | La dueña lo ve en **Pagos y reembolsos**; al aprobarlo se anula la compra y su factura queda "por anular". |
| 3.9 | **Inicio → Mostrar mi código QR** | Aparece el QR. La recepción lo escanea (o escribe el código) en **Check-in** durante una clase. |
| 3.10 | Instala la app: en el teléfono, menú del navegador → "Añadir a pantalla de inicio" | Se instala con el nombre del estudio. |

## 4. Roles: cada uno debe ver solo lo suyo

Invita a una persona de cada rol y confirma el menú que ve:

- **Recepción**: Hoy, Calendario, Clientas, Pagos pendientes, Caja, Tienda, Productos, Gift cards, Check-in.
- **Instructora**: Hoy, Calendario, Check-in (solo marca asistencia en **sus** clases).
- **Contadora**: Finanzas, Gastos y balance, Facturación, Pagos, Caja.
- **Admin de sede**: lo de su sede; **no** ve las otras sedes ni sus cajas.
- **Marketing**: Seguimiento y Campañas, nada de finanzas.
- Una clienta **no** puede abrir `/panel`; el personal **no** puede abrir `/owner`.

## 5. Dominio propio (opcional)

La dueña pide un dominio en **Configuración → Tu propio dominio**; tú lo ves en `/owner/dominios`, pides el CNAME y, cuando
el DNS responde, lo activas. Al abrir ese dominio, ves **su** portada y su login, y `/owner` no existe ahí.

---

## Pruebas automáticas (para tu equipo técnico)

- `npm test` (en la raíz): aislamiento entre estudios y superficie de funciones públicas.
- `SUPABASE_ACCESS_TOKEN=… npm run test:escenarios`: 15 escenarios de punta a punta + 2 de concurrencia + verificación de que no quedan datos de prueba.
