-- Tercera pasada de la superficie pública: las funciones creadas después de la regla seguían heredando EXECUTE para anon,
-- porque ALTER DEFAULT PRIVILEGES sin FOR ROLE solo vale para el rol que ejecuta la migración. Se fija para los roles que
-- realmente crean objetos en Supabase y se hace un barrido final. El anónimo queda SOLO con esta lista blanca.
do $$
declare r record;
begin
  begin execute 'alter default privileges for role postgres in schema public revoke execute on functions from anon, public'; exception when others then null; end;
  begin execute 'alter default privileges for role supabase_admin in schema public revoke execute on functions from anon, public'; exception when others then null; end;
  for r in select p.oid::regprocedure as firma from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
      and p.proname not in ('horarios_publicos','tenant_por_dominio','captar_lead','invitacion_clienta_por_token','invitacion_personal_por_token','testimonios_publicos','pago_webhook')
  loop
    execute format('revoke execute on function %s from anon, public', r.firma);
  end loop;
end $$;
