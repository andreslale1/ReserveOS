-- Hueco cerrado: _encolar_transaccional (security definer) era ejecutable por cualquier persona con sesión, y permitía encolar mensajes a clientas de
-- cualquier estudio. Todos sus llamadores (_tg_reserva_mensajes, cancelar_clase_fecha, _encolar_auto) son security definer: no la necesitan abierta.
revoke all on function public._encolar_transaccional(uuid, uuid, text, jsonb, text) from public, anon, authenticated;
