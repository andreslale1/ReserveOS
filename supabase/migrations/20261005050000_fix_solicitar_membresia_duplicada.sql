-- Bug real encontrado al probar Pagos pendientes: 20260929161431_cierra_pendientes_descuentos_
-- mostrador.sql redefinió 3 funciones agregando parámetros de código de descuento, pero con firma
-- de parámetros distinta a la original (20260928210113_hito_c_rpc_membresias.sql) -- CREATE OR
-- REPLACE con firma distinta no reemplaza, crea una función sobrecargada nueva. Las viejas quedaron
-- vivas en producción junto a las nuevas, y PostgREST no puede elegir cuál usar -- cualquier
-- llamada sin especificar los 6 parámetros con nombre falla ahora mismo. Exactamente el bug de
-- clase #2 documentado en el maestro de instrucciones (sección 2.3): se agrega aquí, no se repitió,
-- pero sucedió igual porque esa migración vino de antes de tener este documento a mano. Se
-- revisaron todas las funciones redefinidas más de una vez en el historial (grep de firmas) --
-- estas 3 son las únicas con parámetros realmente distintos entre versiones.

drop function if exists public.solicitar_membresia(uuid, text, text, text, uuid);
drop function if exists public.editar_cobro_membresia(uuid, numeric);
drop function if exists public.agregar_membresia_manual(uuid, uuid, uuid, text, date);
