# Esquema real, RLS y GRANTS — contra la base viva de Forma

Fecha: 2026-09-28
Fuente: proyecto real de Supabase de Forma Pilates (`qikmfysaaabzwyzdfvav`), consultado de solo lectura vía
la API de administración de Supabase (no vía `supabase db dump` — ese camino seguía bloqueado por el cruce
de `SUPABASE_ACCESS_TOKEN` / `FORMA_PILATES_SUPABASE_ACCESS_TOKEN`, documentado abajo). Nada de lo hecho aquí
escribe en la base de Forma — todo son `select` contra `information_schema` y catálogos de Postgres
(`pg_class`, `pg_policies`, `pg_proc`).

## 1. Conteo de tablas — coincide con el inventario estático

**46 tablas en `public`, todas con `relrowsecurity = true` (RLS habilitado).** Cero tablas sin RLS.

Esto confirma el inventario estático de `01_inventario_estatico_tablas.md` (45 vigentes + `cierres_caja_pos`
que el documento técnico sigue listando como viva mientras que en la base real ya no existe — confirmado
también aquí: no aparece en el catálogo real).

## 2. GRANT base — sin huecos detectados hoy

Se cruzó, para cada tabla, qué roles (`anon` / `authenticated` / `service_role`) tienen una política de RLS
que los menciona, contra qué roles tienen el `GRANT` base de Postgres en esa tabla.

**Resultado: 0 tablas con una política de RLS para un rol que no tenga también el GRANT base para ese
rol.** El estado actual de Forma está limpio en este punto — los incidentes de "permission denied" de
sesiones anteriores (`error_logs`, `cobros_personalizados`, etc.) ya están corregidos en la base real.

**Implicación para ReserveOS:** no hay que "heredar" ningún hueco de GRANT — pero sí hay que **repetir el
proceso de verificación** (RLS + GRANT juntos, nunca uno solo) para cada tabla nueva que se cree, tal como
manda la Regla 6 del documento maestro. El hecho de que hoy esté limpio no significa que el patrón de error
no vuelva a aparecer si se crea una tabla nueva sin este chequeo.

## 3. Políticas de RLS — 88 políticas, cero recursión activa hoy

88 políticas en total sobre las 46 tablas. Se revisaron con una heurística en dos pasos:

1. Primer pase (amplio): políticas cuyo `USING`/`WITH CHECK` menciona el nombre de su propia tabla —
   11 resultados, todos falsos positivos (la tabla se menciona porque la política compara una columna propia,
   ej. `reservas.cliente_id`, no porque haga una subconsulta recursiva).
2. Segundo pase (preciso): políticas cuyo `USING`/`WITH CHECK` contiene un `FROM <su propia tabla>` o
   `JOIN <su propia tabla>` — es decir, una subconsulta real sobre la misma tabla que protegen, el patrón
   exacto que causó la caída de producción del 27 de septiembre (`clientes_ver_dependientes`, ya revertida).

**Resultado del segundo pase: 0 políticas con este patrón en la base real hoy.** La política peligrosa de
la incidencia ya no existe — confirmado directo contra la base, no solo por memoria de la sesión anterior.

**Regla para ReserveOS, no solo para hoy:** cualquier política nueva que necesite consultar la ficha de
`clientes` de otra persona (el caso que causó el incidente — un tutor viendo a su dependiente) debe hacerlo
a través de una función `security definer` que internamente sí pueda leer esa fila sin pasar de nuevo por
RLS, **nunca** con un `select ... from <la misma tabla>` dentro del `USING` de una política sobre esa tabla.
Esto aplica directamente al diseño de `tenant_memberships`/`staff_sedes` del Hito B: cualquier política que
necesite "¿esta persona pertenece a este tenant/sede?" consultando la misma tabla que protege corre el mismo
riesgo multiplicado por cada tenant.

## 4. Funciones (RPCs) — 185 funciones, todas con GRANT explícito

185 funciones en `public`. Ninguna aparece sin al menos un `GRANT EXECUTE` explícito registrado (más allá de
los privilegios por defecto) — no se detectaron funciones "olvidadas" sin permisos otorgados a ningún rol.

No se auditó aquí, y queda pendiente para el resto del Hito A, cuáles de estas 185 son `security definer` sin
verificación de rol/tenant dentro del cuerpo (el riesgo real de `service_role`/`security definer` que marca
la Regla 1 de identidad del documento maestro) — eso requiere leer el cuerpo de cada función, no solo el
catálogo.

## 5. Nota operativa — por qué esto se hizo fuera del CLI

`supabase login` desde la terminal de este repo (ReserveOS) chocó con una variable de entorno global
`SUPABASE_ACCESS_TOKEN` (de otro proyecto de Andrés) que pisaba la sesión del navegador, y por separado el
entorno de ejecución de esa terminal no tenía salida de red compatible con el conector directo de Postgres
que usa `supabase db dump` (IPv6). Se resolvió el bloqueo **sin tocar el login del CLI**: se usó directo la
API de administración de Supabase (`https://api.supabase.com/v1/projects/{ref}/database/query`) con el token
`FORMA_PILATES_SUPABASE_ACCESS_TOKEN` ya presente en el entorno — el mismo camino usado en varias sesiones
anteriores de Forma para lectura/escritura de solo-SQL sin pasar por `supabase login` en absoluto.

**Para el resto del Hito A y para el Hito B (proyecto nuevo de ReserveOS):** este mismo camino sirve para
crear y consultar el proyecto de Supabase nuevo del SaaS, evitando por completo el problema de colisión de
`SUPABASE_ACCESS_TOKEN` entre proyectos — con la salvedad de que para el proyecto **nuevo** hay que generar y
usar su propio token de acceso, no reusar `FORMA_PILATES_SUPABASE_ACCESS_TOKEN` (ese es exclusivo del
proyecto de Forma, de solo lectura para efectos de este SaaS).
