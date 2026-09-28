-- recordatorio_password_enviado_at se había excluido de clientes en el Hito C (bookkeeping de
-- notificación específico) — se necesita ahora que se porta clientas_para_recordatorio_password.
alter table public.clientes add column if not exists recordatorio_password_enviado_at timestamptz;
