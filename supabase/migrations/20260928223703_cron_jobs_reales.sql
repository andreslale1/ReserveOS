-- Cron real: pg_cron corriendo dentro de la misma base, sin depender de un scheduler externo.
--
-- Solo se programan las 2 funciones que tienen efecto real en la base (cancelar/limpiar filas) —
-- las demás funciones "para notificar" (membresias_para_recordatorio_*, reservas_para_recordar_*,
-- clientas_para_recordatorio_password, horarios_por_comenzar/terminar) quedan SIN programar a
-- propósito: sin una integración de WhatsApp/email/push que consuma su resultado, ejecutarlas solo
-- gastaría cómputo sin ningún efecto — programarlas ahora sería trabajo falso. Se agregan al cron
-- en la misma tarea donde se conecte cada canal de notificación.

create extension if not exists pg_cron;

-- Cada 10 minutos: libera cupos de reservas no confirmadas a tiempo (regla real de negocio, no limpieza).
select cron.schedule(
  'liberar_cupos_no_confirmados',
  '*/10 * * * *',
  $$select public.liberar_cupos_no_confirmados();$$
);

-- Cada 15 minutos: limpia entradas de lista de espera ya vencidas.
select cron.schedule(
  'lista_espera_vencida',
  '*/15 * * * *',
  $$select public.lista_espera_vencida();$$
);
