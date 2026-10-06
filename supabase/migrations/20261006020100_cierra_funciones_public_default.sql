-- Segunda pasada: varias funciones seguían abiertas al anónimo por el permiso general PUBLIC (no por un grant directo).
-- Se quita PUBLIC de todas las funciones del esquema public; quienes ya podían ejecutarlas como usuarios autenticados
-- conservan ese permiso de forma explícita, y el servidor (service_role) siempre lo tiene. El anónimo queda solo con la lista blanca.
do $$
declare r record; v_auth boolean;
begin
  for r in select p.oid, p.oid::regprocedure as firma, p.proname from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' loop
    v_auth := has_function_privilege('authenticated', r.oid, 'execute');
    execute format('revoke execute on function %s from public, anon', r.firma);
    if v_auth then execute format('grant execute on function %s to authenticated', r.firma); end if;
    execute format('grant execute on function %s to service_role', r.firma);
  end loop;
end $$;
grant execute on function public.horarios_publicos(text) to anon;
grant execute on function public.tenant_por_dominio(text) to anon;
grant execute on function public.captar_lead(text, text, text, text, text, text, text, text) to anon;
grant execute on function public.invitacion_clienta_por_token(uuid) to anon;
grant execute on function public.invitacion_personal_por_token(uuid) to anon;
grant execute on function public.testimonios_publicos(uuid) to anon;
-- Para que ninguna función futura herede PUBLIC.
alter default privileges in schema public revoke execute on functions from public;
