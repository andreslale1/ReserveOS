# Núcleo del Hito C vs. resto — clasificación de tablas y RPCs reales de Forma

Fecha: 2026-09-28
Fuente: mismo dump que `02_esquema_real_rls_grants.md` (46 tablas, 185 funciones, proyecto real de Forma).

Objetivo: decidir qué hay que portar/rediseñar multi-tenant **primero** (Hito C — motor de reservas
mínimo) y qué se puede dejar para después sin bloquear a VIM.

Criterio de "núcleo": lo mínimo para que una clienta pueda ver horarios, reservar, pagar/tener
membresía activa, entrar a lista de espera y hacer check-in — y para que el staff administre eso mismo.
Todo lo demás (finanzas avanzadas, tienda, marketing, CMS del sitio, encuestas) es "resto": vive después,
como módulo activable (ver Regla de entitlements del documento maestro), no bloquea vender a VIM.

## 1. Tablas

### Núcleo (18)

| Tabla | Por qué es núcleo |
|---|---|
| `clientes` | identidad del cliente, base de todo |
| `perfiles` | vínculo auth ↔ persona (cliente/staff/instructora) |
| `horarios` | catálogo de clases/horarios |
| `horario_cancelaciones` | cancelación de una clase puntual |
| `horario_fechas_privadas` | privatización de horario (venta B2C real de VIM/Forma) |
| `horario_fechas_privadas_personas` | quién va en una privatización |
| `reservas` | la reserva en sí — corazón del sistema |
| `lista_espera` | flujo completo de espera cuando se llena una clase |
| `lista_espera_notificaciones` | aviso al promover de lista de espera |
| `paquetes` | catálogo de paquetes/membresías vendibles |
| `membresias` | membresía comprada por cliente, con créditos (`clases_usadas`) |
| `pago_transacciones` | registro de pago básico (pasarela) atado a una membresía/reserva |
| `configuracion_reservas` | reglas de negocio de reservas (cancelación, anticipación, etc.), por tenant |
| `configuracion_pago` | credenciales/□config de pasarela, por tenant |
| `configuracion_app` | nombre, branding mínimo, por tenant |
| `push_tokens` | necesario para confirmaciones/recordatorios de reserva (no opcional en la práctica) |
| `notificaciones_push_enviadas` | idempotencia de esas notificaciones |
| `error_logs` | diagnóstico — barato de portar, alto valor para no repetir el incidente del 27-sept |

### Resto (28) — módulos posteriores, activables por tenant

| Grupo | Tablas |
|---|---|
| POS / cobros manuales | `cobros_personalizados`, `cierre_caja` |
| Tienda / productos | `productos`, `producto_variantes`, `carritos`, `carrito_items`, `pedidos`, `pedido_items`, `gift_cards` |
| Descuentos | `codigos_descuento`, `codigos_descuento_paquetes`, `codigos_descuento_productos` |
| Finanzas avanzadas | `activos`, `pasivos`, `gastos`, `gasto_marketing`, `metas_mensuales` |
| Comunicación / marketing | `comunicados`, `comunicados_vistos`, `avisos_operativos_enviados`, `whatsapp_mensajes` |
| CMS sitio público | `contenido_sitio`, `contact_submissions`, `testimonios` |
| Feedback | `encuestas_satisfaccion` |
| Config secundaria | `configuracion_contacto`, `configuracion_finanzas` |
| Auditoría admin | `admin_acciones_log` |

Nota: `cierres_caja_pos` ya no existe en la base real (confirmado en el audit anterior) — no se lista.

## 2. Funciones/RPCs (núcleo, 63 de 185)

Filtradas por dominio (`reserva`, `membres`, `paquete`, `lista_espera`, `horario`, `checkin`,
`asistencia`, `cliente`, `pago`, `cobro`). Se portan/rediseñan junto con las tablas núcleo de arriba:

```
_cancelar_reservas_de_membresia_rechazada, _decrementar_uso_codigo_al_borrar_membresia,
_fecha_coincide_horario, admin_agregar_reserva, admin_cancelar_reserva, admin_editar_tipo_reserva,
agregar_cobro_personalizado, agregar_membresia_manual, anular_cobro_membresia,
bloquear_reserva_clase_empezada, cancelar_fecha_horario, cancelar_mi_reserva, checkins_disponibles,
clientas_frecuentes_para_cobro, clientas_para_cobro, cobros_de_hoy, cobros_pendientes_hace_tiempo,
codigos_activos_por_paquete, confirmar_mi_reserva, confirmar_pago_membresia,
confirmar_pago_privatizacion, confirmar_pago_transaccion, congelar_membresia, descongelar_membresia,
devolver_clase_a_membresia, editar_cobro_membresia, eliminar_cobro_pendiente,
eliminar_membresia_pendiente, export_resumen_clientes, hacer_checkin, hacer_checkin_multiple,
historial_cobros_paquetes, horarios_por_comenzar, horarios_por_terminar, kpi_afluencia_horarios,
kpi_afluencia_horarios__interno, kpi_clientas_paquete_activo_mensual,
kpi_clientas_paquete_activo_mensual__interno, kpi_reservas_lealtad, kpi_reservas_mensual,
kpi_reservas_mensual__interno, kpi_tiempo_confirmacion_cobro, lista_espera_vencida,
marcar_membresia_pagada, membresias_para_recordatorio_inactividad,
membresias_para_recordatorio_vencimiento, membresias_por_vencer, mi_lista_espera,
mis_proximas_reservas_instructora, pagos_pasarela_pendientes, pagos_recurrente_historial,
privatizar_fecha_horario, promover_lista_espera, rechazar_membresia_pendiente,
registrar_error_cliente, reservas_asistencia_por_notificar, reservas_liberadas_no_confirmar,
reservas_para_recordar_confirmacion, reservas_para_recordatorio_agendada, salir_lista_espera,
solicitar_membresia, transferir_membresia, unirse_lista_espera
```

Sub-nota importante (no bloquea Hito C, pero hay que tenerlo presente al diseñar Hito B/C): dentro de
este mismo grupo, los `kpi_*` son dashboards de staff, no flujo transaccional de la clienta — se pueden
implementar de forma más simple/tosca en la primera versión multi-tenant sin arriesgar el cronograma;
`hacer_checkin_multiple` es el que casi causó el bug de doble descuento de créditos en Forma (ver Regla
de créditos del documento maestro: los créditos se descuentan **al reservar**, nunca al hacer check-in) —
al reescribir esto para multi-tenant, mantener esa misma regla explícita en el nuevo esquema.

Las 122 funciones restantes (POS, tienda, marketing, CMS, encuestas, finanzas avanzadas) siguen el mismo
mapeo que sus tablas: quedan para después, como parte de los módulos "resto".

## 3. Qué desbloquea esto

Con esta lista, el Hito B (esquema base multi-tenant) puede diseñarse ya apuntando directo a estas 18
tablas núcleo + `tenants`/`sedes`/`tenant_memberships`/`staff_sedes`/`module_catalog`/
`tenant_entitlements`/`tenant_module_settings`/`role_permissions`, sin tener que decidir todavía cómo
correr multi-tenant las 28 tablas de "resto".
