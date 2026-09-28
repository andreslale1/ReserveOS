-- Supabase otorga por defecto a `anon` todos los privilegios (SELECT/INSERT/UPDATE/DELETE/...) sobre
-- tablas nuevas del esquema public, no solo lo declarado en la migración anterior. RLS ya bloqueaba
-- cualquier fuga real (0 filas para anon, inserts sin política de INSERT se rechazan por defecto),
-- pero el GRANT quedaba más ancho de lo decidido — se aprieta para que el GRANT refleje exactamente
-- la decisión, no un default de la plataforma (regla 6 del maestro: RLS y GRANT juntos, a propósito).

revoke all on public.tenants, public.tenant_domains, public.sedes, public.tenant_memberships,
  public.staff_sedes, public.module_catalog, public.tenant_entitlements,
  public.tenant_module_settings, public.role_permissions
from anon;

-- authenticated también recibía por defecto TRUNCATE/REFERENCES/TRIGGER además de lo declarado.
-- Se deja solo lo que de verdad se otorgó a propósito.
revoke all on public.tenants, public.tenant_domains, public.sedes, public.tenant_memberships,
  public.staff_sedes, public.tenant_entitlements, public.tenant_module_settings
from authenticated;
grant select, insert, update, delete on public.tenants to authenticated;
grant select, insert, update, delete on public.tenant_domains to authenticated;
grant select, insert, update, delete on public.sedes to authenticated;
grant select, insert, update, delete on public.tenant_memberships to authenticated;
grant select, insert, update, delete on public.staff_sedes to authenticated;
grant select, insert, update, delete on public.tenant_entitlements to authenticated;
grant select, insert, update, delete on public.tenant_module_settings to authenticated;

revoke all on public.module_catalog, public.role_permissions from authenticated;
grant select on public.module_catalog to authenticated;
grant select on public.role_permissions to authenticated;
