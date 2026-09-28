-- Cierra el ciclo de role_permissions: sin esto la matriz es solo una tabla con datos, no un
-- servicio de autorización. El frontend/servicios preguntan "¿qué puedo hacer con esta acción?" y
-- reciben el scope real de la matriz — nunca deciden ellos mismos qué mostrar/permitir.
--
-- Nota: esto NO reemplaza el chequeo de cada RPC (staff_puede_en_sede/tengo_rol_en_tenant siguen
-- siendo la autorización real de escritura). mi_permiso() es para que la UI sepa qué mostrar/ocultar
-- y para auditoría — la fuente de verdad de qué se permite ejecutar sigue viviendo en cada función.
create or replace function public.mi_permiso(p_tenant_id uuid, p_action_id text)
returns table(scope text, requiere_delegacion boolean)
language sql stable security definer
set search_path to 'public'
as $$
  select rp.scope, rp.requiere_delegacion
  from public.role_permissions rp
  where rp.action_id = p_action_id
    and rp.role in (
      select role from public.tenant_memberships where user_id = auth.uid() and tenant_id = p_tenant_id
      union
      select 'clienta' where exists (select 1 from public.clientes where user_id = auth.uid() and tenant_id = p_tenant_id)
    )
  order by case rp.scope when 'G' then 1 when 'S' then 2 when 'L' then 3 when 'I' then 4 when 'C' then 5 else 6 end
  limit 1;
$$;
revoke all on function public.mi_permiso(uuid, text) from public;
grant execute on function public.mi_permiso(uuid, text) to authenticated;
