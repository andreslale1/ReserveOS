-- La auditoría de plataforma mostraba al actor vacío (el disparador busca su nombre en el estudio, y estas tablas no tienen).
create or replace function public.plataforma_auditoria_listar(p_limite integer default 200)
returns table(created_at timestamptz, actor text, tabla text, operacion text, registro text, estudio text)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['auditor']) then raise exception 'No autorizado'; end if;
  return query select l.created_at,
      coalesce(l.actor_nombre, (select s.nombre from public.plataforma_staff s where s.user_id = l.actor_id), 'Sistema'),
      l.tabla, l.operacion, l.registro_id, t.name
    from public.admin_acciones_log l left join public.tenants t on t.id = l.tenant_id
    where l.tabla like 'plataforma\_%' or l.tabla = 'tenant_entitlements'
    order by l.created_at desc limit least(coalesce(p_limite,200), 500);
end $$;
