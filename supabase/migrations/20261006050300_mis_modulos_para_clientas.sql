-- mis_modulos solo reconocía al personal del estudio; una clienta recibía una lista vacía y la app ocultaba la tienda.
create or replace function public.mis_modulos(p_tenant_id uuid)
returns text[] language sql stable security definer set search_path to 'public' as $$
  select case when p_tenant_id in (select public.current_tenant_ids())
                or p_tenant_id in (select c.tenant_id from public.clientes c where c.user_id = auth.uid())
    then coalesce(array_agg(e.module_key), '{}') else '{}' end
  from public.tenant_entitlements e
  where e.tenant_id = p_tenant_id and e.enabled and (e.effective_at is null or e.effective_at <= now());
$$;
