-- A pedido explícito de Andrés (dueño de ReserveOS): el operador de plataforma puede ver todo el
-- contenido de cualquier estudio sin pedir motivo/autorización por evento -- decisión de producto
-- suya como dueño de la plataforma, no una regla de seguridad que se esté evadiendo. Cada estudio
-- entiende que este acceso existe para mantenimiento y supervisión de flujos. Sigue gateado
-- exclusivamente por soy_staff_plataforma() -- nadie más que el operador puede llamar esto.

create or replace function public.owner_tenant_detalle(p_tenant_id uuid)
returns json
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_tenant record;
  v_sedes json;
  v_personal json;
  v_clientas json;
  v_paquetes json;
  v_proximas_clases json;
  v_pagos_pendientes json;
  v_ingreso_mes numeric;
  v_gastos_mes numeric;
begin
  if not public.soy_staff_plataforma() then
    raise exception 'No autorizado';
  end if;

  select id, slug, name, status, created_at into v_tenant from public.tenants where id = p_tenant_id;
  if v_tenant is null then raise exception 'Estudio no encontrado'; end if;

  select coalesce(json_agg(json_build_object('id', s.id, 'name', s.name, 'timezone', s.timezone, 'status', s.status)), '[]')
    into v_sedes from public.sedes s where s.tenant_id = p_tenant_id;

  select coalesce(json_agg(json_build_object('id', tm.id, 'nombre', tm.nombre, 'role', tm.role, 'email', u.email)), '[]')
    into v_personal from public.tenant_memberships tm join auth.users u on u.id = tm.user_id
    where tm.tenant_id = p_tenant_id order by tm.role;

  select coalesce(json_agg(json_build_object('id', c.id, 'nombre', c.nombre, 'telefono', c.telefono, 'email', c.email, 'tiene_acceso', c.user_id is not null) order by c.nombre), '[]')
    into v_clientas from public.clientes c where c.tenant_id = p_tenant_id limit 200;

  select coalesce(json_agg(json_build_object('id', p.id, 'nombre', p.nombre, 'precio', p.precio, 'num_clases', p.num_clases, 'activo', p.activo) order by p.activo desc, p.precio), '[]')
    into v_paquetes from public.paquetes p where p.tenant_id = p_tenant_id;

  select coalesce(json_agg(json_build_object('id', h.id, 'nombre_clase', h.nombre_clase, 'dia_semana', h.dia_semana, 'hora_inicio', h.hora_inicio, 'cupo_maximo', h.cupo_maximo, 'sede', s.name) order by h.dia_semana, h.hora_inicio), '[]')
    into v_proximas_clases from public.horarios h join public.sedes s on s.id = h.sede_id
    where h.tenant_id = p_tenant_id and h.activo = true limit 50;

  select coalesce(json_agg(json_build_object('id', m.id, 'cliente_nombre', c.nombre, 'metodo_pago', m.metodo_pago, 'referencia_pago', m.referencia_pago, 'created_at', m.created_at)), '[]')
    into v_pagos_pendientes from public.membresias m join public.clientes c on c.id = m.cliente_id
    where m.tenant_id = p_tenant_id and m.pagada = false and m.estado = 'activa';

  select coalesce(sum(coalesce(m.precio_final, pq.precio, 0)), 0) into v_ingreso_mes
    from public.membresias m join public.paquetes pq on pq.id = m.paquete_id
    where m.tenant_id = p_tenant_id and m.pagada = true and m.confirmado_at is not null
      and date_trunc('month', m.confirmado_at) = date_trunc('month', now());

  select coalesce(sum(g.monto), 0) into v_gastos_mes from public.gastos g
    where g.tenant_id = p_tenant_id and date_trunc('month', g.fecha) = date_trunc('month', now());

  return json_build_object(
    'tenant', json_build_object('id', v_tenant.id, 'slug', v_tenant.slug, 'name', v_tenant.name, 'status', v_tenant.status, 'created_at', v_tenant.created_at),
    'sedes', v_sedes,
    'personal', v_personal,
    'clientas', v_clientas,
    'paquetes', v_paquetes,
    'proximas_clases', v_proximas_clases,
    'pagos_pendientes', v_pagos_pendientes,
    'ingreso_mes', v_ingreso_mes,
    'gastos_mes', v_gastos_mes
  );
end;
$$;
revoke all on function public.owner_tenant_detalle(uuid) from public;
grant execute on function public.owner_tenant_detalle(uuid) to authenticated;
