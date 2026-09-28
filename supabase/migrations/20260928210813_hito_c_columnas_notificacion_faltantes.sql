-- Faltaron estas columnas de bookkeeping de notificaciones en la migración de tablas del Hito C —
-- se necesitan para que las funciones de cron/recordatorio no reenvíen el mismo aviso dos veces.
-- No es una decisión de diseño, fue una omisión real; se corrige aquí en vez de reescribir la
-- migración original ya aplicada.

alter table public.reservas
  add column if not exists asistencia_notificada boolean not null default false,
  add column if not exists confirmacion_recordatorio_enviado boolean not null default false,
  add column if not exists recordatorio_agendada_enviado_at timestamptz;

alter table public.membresias
  add column if not exists recordatorio_vencimiento_enviado boolean not null default false,
  add column if not exists recordatorio_inactividad_enviado_at timestamptz;
