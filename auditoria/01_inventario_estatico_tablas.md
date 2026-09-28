# Inventario estático de tablas — Forma Pilates (Frontend)

Fecha: 2026-09-28
Fuente: `~/Desktop/Forma Pilates/Frontend/supabase/` (repo real, no la documentación técnica)
Método: grep de `CREATE TABLE` sobre `migrations/*.sql` (210 archivos) y sobre los `schema_*.sql` sueltos en la raíz.

**Esto es un primer pase local. No reemplaza el paso 2 (pg_dump / information_schema contra la
base real), que requiere sesión de Supabase CLI iniciada.**

## Tablas encontradas vía `migrations/*.sql` (47 CREATE TABLE, 2 luego eliminadas → 45 vigentes)

activos, admin_acciones_log, avisos_operativos_enviados, carrito_items, carritos, cierre_caja,
cierres_caja_pos (❌ eliminada después, ver abajo), clientes, cobros_personalizados,
codigos_descuento, codigos_descuento_paquetes, codigos_descuento_productos, comunicados,
comunicados_vistos, configuracion_app, configuracion_contacto, configuracion_finanzas,
configuracion_pago, configuracion_reservas, contact_submissions, contenido_sitio,
encuestas_satisfaccion, error_logs, gasto_marketing, gastos, gift_cards, horario_cancelaciones,
horario_fechas_privadas, horario_fechas_privadas_personas, horarios, lista_espera,
lista_espera_notificaciones, membresias, metas_mensuales, notificaciones_push_enviadas,
pago_transacciones, paquetes, pasivos, pedido_items, pedidos, perfiles, producto_variantes,
productos, push_tokens, reservas, testimonios, whatsapp_mensajes

## Tablas creadas y luego eliminadas (DROP TABLE en una migración posterior)

- `cierres_caja_pos`
- `metas_ingreso_mensual` (no aparece en la lista final — correcto, ya no existe)

**Riesgo:** si el documento técnico o cualquier prompt futuro menciona `cierres_caja_pos`, es un
nombre muerto. Verificar contra el esquema real antes de reusar.

## ⚠️ Hallazgo — drift ya presente, tal como advierte la Regla 4 del documento maestro

12 archivos `schema_*.sql` viven sueltos en la raíz de `supabase/` (fuera de `migrations/`) y
contienen sus propios `CREATE TABLE` / cambios de esquema, aplicados probablemente a mano desde el
SQL Editor en algún momento, no vía CLI:

```
schema.sql
schema_booking.sql
schema_comunicados.sql
schema_comunicados_leidos.sql
schema_contacto.sql
schema_contenido_sitio.sql
schema_kpis_encuesta.sql
schema_membresias.sql
schema_penalizacion_cancelacion.sql
schema_push_tokens.sql
schema_testimonios.sql
schema_ux_upgrade.sql
```

No se puede asumir que lo que estos 12 archivos describen coincide con lo que corrió realmente en
producción, ni que las 210 migraciones versionadas capturan el 100% del esquema vivo. Esto confirma
literalmente la Regla 4 de la sección 1 del documento maestro: **no asumir que las migraciones
representan fielmente producción.**

## Comparación con el inventario documentado (`Forma-Pilates-Documentacion-Tecnica.md` §4)

Hecho el cruce nombre por nombre: las **46 tablas listadas explícitamente** en la sección 4 del
documento técnico coinciden 1:1 con las 46 tablas encontradas en `migrations/*.sql` (45 vigentes +
`cierres_caja_pos`, ya eliminada — el documento la sigue listando como viva, primer dato desalineado
encontrado). Sin discrepancias de nombres más allá de esa.

**Pero el propio documento técnico dice "43 tablas" en el texto** (línits 87) mientras lista 46 —
el conteo narrativo del documento está desactualizado respecto a su propio listado. Señal más de
que "ya está documentado" no equivale a "ya está verificado", tal como advierte la Regla 5 del
documento maestro.

Ninguna de las dos fuentes (documentación ni migraciones) se toma como verdad final hasta
confirmarla contra `information_schema` / `pg_policies` de la base real — eso es lo que sigue,
bloqueado por login de Supabase CLI (ver abajo).

## Bloqueado — requiere acción del usuario

Supabase CLI (`v2.115.0`, instalado) no tiene sesión iniciada (`Unauthorized` en `projects list` y
`link`). El siguiente paso del Hito A —dump del esquema real y comparación con RLS/GRANTS reales—
necesita:

```
supabase login
```

Esto abre el navegador para OAuth; no se puede automatizar sin la sesión del usuario. Una vez
logueado, se corre desde este mismo repo (sin tocar el repo de Forma):

```
supabase db dump --db-url "<connection string de Forma, solo lectura si es posible>" --schema public -f auditoria/02_schema_real.sql
```

o, más simple y sin exponer la contraseña de la base, usando el `project-ref` ya identificado
(`qikmfysaaabzwyzdfvav`) con `supabase link` + `supabase db dump --linked`.
