-- SEGURIDAD (auditoría SEC-01..06): funciones internas que cualquier cuenta autenticada podía ejecutar.
-- Comprobado en la base real: una clienta común ejecutó cola_resultado, fiscal_resultado, devolver_credito_reserva y
-- _snapshot_cobertura_membresia. «revoke ... from public» no basta: Supabase concede EXECUTE a anon y authenticated por defecto.
--
-- Esta migración cierra esas funciones a anon/authenticated/public. Las de cola y fiscal las usa solo el servidor (service_role).
-- SEGURO: antes de cerrar, comprueba que ninguna función normal (security invoker), trigger ni política de RLS dependa de ellas;
-- si alguna depende, la migración se detiene con un mensaje y NO cambia nada.

do $$
declare
  v_nombres text[] := array['cola_tomar','cola_resultado','fiscal_tomar','fiscal_resultado','devolver_credito_reserva',
                            '_cancelar_reservas_de_membresia_rechazada','_snapshot_cobertura_membresia','_segmento_clientes'];
  v_dep text;
  r record;
begin
  -- 1) Funciones que se ejecutan con los permisos de quien las llama y mencionan alguna de las internas.
  select string_agg(distinct g.proname || ' → ' || n.nombre, '; ') into v_dep
  from pg_proc g
  join pg_namespace ns on ns.oid = g.pronamespace and ns.nspname = 'public'
  cross join lateral unnest(v_nombres) as n(nombre)
  where g.prokind = 'f' and not g.prosecdef and g.proname <> n.nombre and g.prosrc ~ ('\m' || n.nombre || '\M');
  if v_dep is not null then
    raise exception 'Se detiene: estas funciones se ejecutan con permisos del usuario y usan una función interna: %', v_dep;
  end if;

  -- 2) Políticas de RLS que usan alguna de las internas (se evalúan con el rol del usuario).
  select string_agg(distinct pol.polname || ' (' || c.relname || ')', '; ') into v_dep
  from pg_policy pol join pg_class c on c.oid = pol.polrelid
  cross join lateral unnest(v_nombres) as n(nombre)
  where coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') || coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') ~ ('\m' || n.nombre || '\M');
  if v_dep is not null then
    raise exception 'Se detiene: estas políticas de RLS usan una función interna: %', v_dep;
  end if;

  -- 3) Cerrar todas las sobrecargas de cada función.
  for r in select p.oid::regprocedure as fn, p.proname from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.proname = any(v_nombres) loop
    execute format('revoke all on function %s from public, anon, authenticated', r.fn);
    if r.proname in ('cola_tomar','cola_resultado','fiscal_tomar','fiscal_resultado') then
      execute format('grant execute on function %s to service_role', r.fn);
    end if;
  end loop;
end $$;

-- Verificación de solo lectura (debe devolver 0 filas): funciones internas que aún puede ejecutar un usuario autenticado.
--   select p.oid::regprocedure from pg_proc p
--   where p.pronamespace = 'public'::regnamespace
--     and p.proname in ('cola_tomar','cola_resultado','fiscal_tomar','fiscal_resultado','devolver_credito_reserva',
--                       '_cancelar_reservas_de_membresia_rechazada','_snapshot_cobertura_membresia','_segmento_clientes')
--     and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'));
