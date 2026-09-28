-- Amplía la cobertura de registrar_accion_admin. Se me quedó fuera algo que el maestro exige de
-- forma explícita (sección 5): "Toda activación/suspensión [de módulo] registra actor, fecha
-- efectiva, parámetros, motivo y versión" — tenant_entitlements/tenant_module_settings no tenían el
-- trigger. Se agregan junto con otras tablas sensibles de bajo volumen (cambios de rol/acceso,
-- códigos de descuento, cobros personalizados).
--
-- A propósito NO se agrega a: `reservas`/`clientes` (volumen altísimo — cada reserva normal inundaría
-- el log sin ser lo que "auditoría de acciones admin" busca; clientes ya tiene su propio trigger de
-- protección de columnas, que es el control real ahí) ni a `staff_sedes`/`cierre_caja` (llave
-- compuesta sin columna `id` — el trigger genérico asume `NEW.id`/`OLD.id`, incompatible tal cual).

create trigger tenant_entitlements_registrar_accion_admin after insert or update or delete on public.tenant_entitlements
  for each row execute function public.registrar_accion_admin();
create trigger tenant_module_settings_registrar_accion_admin after insert or update or delete on public.tenant_module_settings
  for each row execute function public.registrar_accion_admin();
create trigger tenant_memberships_registrar_accion_admin after insert or update or delete on public.tenant_memberships
  for each row execute function public.registrar_accion_admin();
create trigger codigos_descuento_registrar_accion_admin after insert or update or delete on public.codigos_descuento
  for each row execute function public.registrar_accion_admin();
create trigger cobros_personalizados_registrar_accion_admin after insert or update or delete on public.cobros_personalizados
  for each row execute function public.registrar_accion_admin();
create trigger role_permissions_registrar_accion_admin after insert or update or delete on public.role_permissions
  for each row execute function public.registrar_accion_admin();
