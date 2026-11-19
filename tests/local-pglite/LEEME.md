# Pruebas locales de reglas de dinero y reservas (sin tocar Supabase)

Reconstruyen la base con las migraciones en PGlite (Postgres en memoria) y reproducen cada hallazgo de la auditoría
**antes** y **después** de la migración que lo corrige.

    cd tests/local-pglite && npm i --no-save @electric-sql/pglite
    node prueba_dinero1.mjs     # tanda 1: pagos, ingreso doble, zona horaria, espera duplicada
    node prueba_reservas2.mjs   # tanda 2: reservas, créditos y lista de espera
    node humo.mjs               # humo: reservar, cancelar con devolución, promover, cobrar precio pactado
    node defs.mjs <funcion>     # imprime la definición FINAL de una función (con todos los parches)

El cargador compensa tres bloqueos de la auditoría (pg_cron, catálogo de módulos del seed y la columna `estado_lead`)
solo para la copia de pruebas; no cambia las migraciones. Es la base para la meta «reset desde cero con pruebas verdes».
