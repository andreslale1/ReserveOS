-- Garantía permanente: toda función que se cree en public nace SIN acceso para el anónimo ni para PUBLIC, aunque el
-- ALTER DEFAULT PRIVILEGES no llegue a aplicarse. Quien necesite abrir una función al público debe agregarla de forma
-- explícita (GRANT ... TO anon) en su propia migración Y a la lista blanca de abajo; las pruebas fallan si no coinciden.
create or replace function public._cerrar_funcion_nueva()
returns event_trigger language plpgsql security definer set search_path to 'public' as $$
declare r record;
begin
  for r in select * from pg_event_trigger_ddl_commands() where command_tag in ('CREATE FUNCTION','CREATE PROCEDURE') and schema_name = 'public' loop
    execute format('revoke execute on function %s from public, anon', r.object_identity);
  end loop;
end $$;
revoke all on function public._cerrar_funcion_nueva() from public;
drop event trigger if exists cerrar_funcion_nueva;
create event trigger cerrar_funcion_nueva on ddl_command_end when tag in ('CREATE FUNCTION','CREATE PROCEDURE') execute function public._cerrar_funcion_nueva();
