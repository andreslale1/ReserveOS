-- El catálogo del portal expone qué sedes admite cada paquete, para que la clienta elija dónde lo usará.
drop function if exists public.catalogo_paquetes(uuid);
create or replace function public.catalogo_paquetes(p_tenant_id uuid)
returns table(id uuid, nombre text, descripcion text, num_clases integer, precio numeric, vigencia_dias integer, cobertura text, sedes text, sede_ids uuid[])
language sql stable security definer set search_path to 'public' as $$
  select p.id, p.nombre, p.descripcion, p.num_clases, p.precio, p.vigencia_dias, p.cobertura,
    case p.cobertura when 'todas' then 'Todas las sedes' else (select string_agg(s.name, ', ' order by s.name) from public.paquete_sedes ps join public.sedes s on s.id = ps.sede_id where ps.paquete_id = p.id) end,
    case p.cobertura when 'sedes' then coalesce((select array_agg(ps.sede_id) from public.paquete_sedes ps where ps.paquete_id = p.id), '{}') else '{}'::uuid[] end
  from public.paquetes p
  where p.tenant_id = p_tenant_id and p.activo and p_tenant_id in (select c.tenant_id from public.clientes c where c.user_id = auth.uid())
  order by p.precio;
$$;
revoke all on function public.catalogo_paquetes(uuid) from public;
grant execute on function public.catalogo_paquetes(uuid) to authenticated;
