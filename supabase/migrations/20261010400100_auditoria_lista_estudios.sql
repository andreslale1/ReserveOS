-- Lista mínima (id y nombre) de estudios para el filtro de la auditoría; el auditor no puede leer el listado completo.
create or replace function public.plataforma_auditoria_estudios()
returns table(id uuid, nombre text)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['auditor']) then raise exception 'No autorizado'; end if;
  return query select t.id, t.name from public.tenants t order by t.name;
end $$;
revoke all on function public.plataforma_auditoria_estudios() from public, anon;
grant execute on function public.plataforma_auditoria_estudios() to authenticated;
