-- ALCANCE DE LECTURA HECHO CUMPLIR EN LA BASE (matriz S / I / L / G), no solo en las pantallas.
--   dueña, gerencia general ........ todo el estudio
--   contabilidad ................... finanzas de todo el estudio (cobros, caja, pagos); nunca fichas ni reservas
--   admin de sede, gerencia regional, recepción
--                                 .. solo las clientas que atienden (sede habitual, o con reservas/compras en sus sedes, o que ellas dieron de alta)
--                                    y las reservas, ventas, pagos y caja de SUS sedes
--   instructora .................... solo las reservas de sus clases, y el roster mínimo por RPC (sin teléfono ni datos personales)
--   marketing ...................... nada directo: opera por RPC de segmentos con consentimiento

alter table public.clientes add column if not exists creada_por uuid default auth.uid();

create or replace function public._mi_rol(p_tenant_id uuid)
returns text language sql stable security definer set search_path to 'public' as $$
  select role from public.tenant_memberships where user_id = auth.uid() and tenant_id = p_tenant_id limit 1
$$;
create or replace function public._es_g(p_tenant_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce(public._mi_rol(p_tenant_id) in ('duena','gerente_general'), false)
$$;
create or replace function public._es_finanzas(p_tenant_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce(public._mi_rol(p_tenant_id) in ('duena','gerente_general','contadora'), false)
$$;
-- Sedes sobre las que el rol de sede de quien llama tiene alcance (las asignadas). Los roles de todo el estudio devuelven todas.
create or replace function public._mis_sedes(p_tenant_id uuid)
returns uuid[] language sql stable security definer set search_path to 'public' as $$
  select case when public._mi_rol(p_tenant_id) in ('duena','gerente_general','contadora')
    then coalesce((select array_agg(id) from public.sedes where tenant_id = p_tenant_id), '{}')
    else coalesce((select array_agg(ss.sede_id) from public.tenant_memberships tm join public.staff_sedes ss on ss.tenant_membership_id = tm.id
                   where tm.user_id = auth.uid() and tm.tenant_id = p_tenant_id), '{}') end
$$;
create or replace function public._mi_membership(p_tenant_id uuid)
returns uuid language sql stable security definer set search_path to 'public' as $$
  select id from public.tenant_memberships where user_id = auth.uid() and tenant_id = p_tenant_id limit 1
$$;
create or replace function public._es_rol_sede(p_tenant_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce(public._mi_rol(p_tenant_id) in ('admin_sede','gerente_regional','recepcion'), false)
$$;

-- ¿Esta clienta es una de las que atiende quien llama? (definer: evita la recursión entre políticas)
create or replace function public._cliente_atendida(p_cliente_id uuid)
returns boolean language plpgsql stable security definer set search_path to 'public' as $$
declare c record; v_sedes uuid[];
begin
  select id, tenant_id, sede_habitual_id, creada_por, tutor_id into c from public.clientes where id = p_cliente_id;
  if c is null then return false; end if;
  if public._es_g(c.tenant_id) then return true; end if;
  if not public._es_rol_sede(c.tenant_id) then return false; end if;
  v_sedes := public._mis_sedes(c.tenant_id);
  if c.sede_habitual_id = any(v_sedes) or c.creada_por = auth.uid() then return true; end if;
  if exists (select 1 from public.reservas r where r.cliente_id = c.id and r.sede_id = any(v_sedes)) then return true; end if;
  if exists (select 1 from public.membresias m where m.cliente_id = c.id and m.sede_venta_id = any(v_sedes)) then return true; end if;
  if c.tutor_id is not null and exists (select 1 from public.clientes t where t.id = c.tutor_id and (t.sede_habitual_id = any(v_sedes) or t.creada_por = auth.uid())) then return true; end if;
  return false;
end $$;
revoke all on function public._mi_rol(uuid), public._es_g(uuid), public._es_finanzas(uuid), public._mis_sedes(uuid), public._mi_membership(uuid), public._es_rol_sede(uuid), public._cliente_atendida(uuid) from public;
grant execute on function public._mi_rol(uuid), public._es_g(uuid), public._es_finanzas(uuid), public._mis_sedes(uuid), public._mi_membership(uuid), public._es_rol_sede(uuid), public._cliente_atendida(uuid) to authenticated;

-- ---------- Políticas ----------
drop policy if exists clientes_staff_select on public.clientes;
create policy clientes_staff_select on public.clientes for select using (tenant_id in (select public.current_tenant_ids()) and public._cliente_atendida(id));

drop policy if exists reservas_staff_select on public.reservas;
create policy reservas_staff_select on public.reservas for select using (tenant_id in (select public.current_tenant_ids()) and (
  public._es_g(tenant_id)
  or (public._es_rol_sede(tenant_id) and sede_id = any(public._mis_sedes(tenant_id)))
  or (public._mi_rol(tenant_id) = 'instructora' and exists (select 1 from public.horarios h where h.id = reservas.horario_id and h.instructor_membership_id = public._mi_membership(reservas.tenant_id)))));

drop policy if exists membresias_staff_select on public.membresias;
create policy membresias_staff_select on public.membresias for select using (tenant_id in (select public.current_tenant_ids()) and (
  public._es_finanzas(tenant_id)
  or (public._es_rol_sede(tenant_id) and (sede_venta_id = any(public._mis_sedes(tenant_id)) or public._cliente_atendida(cliente_id)))));

drop policy if exists pago_transacciones_staff_select on public.pago_transacciones;
create policy pago_transacciones_staff_select on public.pago_transacciones for select using (tenant_id in (select public.current_tenant_ids()) and (
  public._es_finanzas(tenant_id) or (public._es_rol_sede(tenant_id) and sede_venta_id = any(public._mis_sedes(tenant_id)))));

drop policy if exists cierre_caja_select on public.cierre_caja;
create policy cierre_caja_select on public.cierre_caja for select using (tenant_id in (select public.current_tenant_ids()) and (
  public._es_finanzas(tenant_id) or (public._es_rol_sede(tenant_id) and sede_id = any(public._mis_sedes(tenant_id)))));

drop policy if exists pedidos_staff_select on public.pedidos;
create policy pedidos_staff_select on public.pedidos for select using (tenant_id in (select public.current_tenant_ids()) and (
  public._es_finanzas(tenant_id) or (public._es_rol_sede(tenant_id) and sede_entrega_id = any(public._mis_sedes(tenant_id)))));

drop policy if exists cobros_personalizados_select on public.cobros_personalizados;
create policy cobros_personalizados_select on public.cobros_personalizados for select using (tenant_id in (select public.current_tenant_ids()) and (
  public._es_finanzas(tenant_id) or (public._es_rol_sede(tenant_id) and sede_id = any(public._mis_sedes(tenant_id)))));

drop policy if exists lista_espera_staff_select on public.lista_espera;
create policy lista_espera_staff_select on public.lista_espera for select using (tenant_id in (select public.current_tenant_ids()) and (
  public._es_g(tenant_id)
  or (public._es_rol_sede(tenant_id) and exists (select 1 from public.horarios h where h.id = lista_espera.horario_id and h.sede_id = any(public._mis_sedes(lista_espera.tenant_id))))
  or (public._mi_rol(tenant_id) = 'instructora' and exists (select 1 from public.horarios h where h.id = lista_espera.horario_id and h.instructor_membership_id = public._mi_membership(lista_espera.tenant_id)))));

-- Tablas ligadas a una clienta: solo si esa clienta es de las que atiende quien llama.
do $$
declare t text; pol text;
begin
  for t, pol in select * from (values
    ('carritos','carritos_staff_select'), ('encuestas_satisfaccion','encuestas_satisfaccion_select'),
    ('horario_fechas_privadas_personas','horario_fechas_privadas_personas_staff_select'),
    ('lista_espera_notificaciones','lista_espera_notificaciones_staff_select'), ('notificaciones_push_enviadas','notificaciones_push_enviadas_staff_select'),
    ('testimonios','testimonios_staff_select')) as x(t, pol) loop
    execute format('drop policy if exists %I on public.%I', pol, t);
    execute format('create policy %I on public.%I for select using (tenant_id in (select public.current_tenant_ids()) and (public._es_g(tenant_id) or (cliente_id is not null and public._cliente_atendida(cliente_id))))', pol, t);
  end loop;
end $$;

-- Datos operativos sensibles que no necesita todo el personal.
drop policy if exists error_logs_staff_select on public.error_logs;
create policy error_logs_staff_select on public.error_logs for select using (tenant_id in (select public.current_tenant_ids()) and public._es_g(tenant_id));
drop policy if exists invitaciones_personal_select on public.invitaciones_personal;
create policy invitaciones_personal_select on public.invitaciones_personal for select using (tenant_id in (select public.current_tenant_ids()) and (public._es_g(tenant_id) or creado_por = auth.uid()));
drop policy if exists whatsapp_mensajes_select on public.whatsapp_mensajes;
create policy whatsapp_mensajes_select on public.whatsapp_mensajes for select using (tenant_id in (select public.current_tenant_ids()) and (public._es_g(tenant_id) or public._mi_rol(tenant_id) in ('admin_sede','gerente_regional')));
drop policy if exists contact_submissions_select on public.contact_submissions;
create policy contact_submissions_select on public.contact_submissions for select using (tenant_id in (select public.current_tenant_ids()) and (public._es_g(tenant_id) or public._mi_rol(tenant_id) in ('admin_sede','gerente_regional')));

-- ---------- Roster mínimo (instructora) y por sede (resto) ----------
-- Devuelve quién viene a las clases pedidas. La instructora solo ve sus propias clases y NO recibe teléfono ni datos personales:
-- nombre, alertas de salud (cuidados) y asistencia. El resto del personal ve lo de las sedes donde trabaja.
create or replace function public.roster_horarios(p_horario_ids uuid[], p_fecha date)
returns table(horario_id uuid, reserva_id uuid, cliente_id uuid, nombre text, telefono text, cuidados text, tipo text, asistio boolean)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  return query
  select r.horario_id, r.id, case when public._mi_rol(r.tenant_id) = 'instructora' then null else c.id end, c.nombre,
         case when public._mi_rol(r.tenant_id) = 'instructora' then null else c.telefono end, c.cuidados_especiales, r.tipo, r.asistio
    from public.reservas r join public.horarios h on h.id = r.horario_id join public.clientes c on c.id = r.cliente_id
    where r.horario_id = any(p_horario_ids) and r.fecha = p_fecha and r.estado = 'confirmada'
      and ( public._es_g(r.tenant_id)
         or (public._es_rol_sede(r.tenant_id) and r.sede_id = any(public._mis_sedes(r.tenant_id)))
         or (public._mi_rol(r.tenant_id) = 'instructora' and h.instructor_membership_id = public._mi_membership(r.tenant_id)))
    order by r.created_at;
end $$;
revoke all on function public.roster_horarios(uuid[], date) from public;
grant execute on function public.roster_horarios(uuid[], date) to authenticated;

-- ---------- Funciones de lectura que ahora respetan el alcance (RLS aplica porque corren con los permisos de quien llama) ----------
do $$
declare f text;
begin
  foreach f in array array['clientas_para_cobro','clientas_frecuentes_para_cobro','cobros_de_hoy','cobros_pendientes_hace_tiempo','membresias_por_vencer','pedidos_para_entregar','pedidos_pendientes_efectivo','ventas_producto_recientes'] loop
    execute (select string_agg(format('alter function %s security invoker', p.oid::regprocedure), '; ') from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = f);
  end loop;
end $$;

-- Acciones sobre pedidos: solo en las sedes de quien actúa.
do $$
declare r record; v_def text;
begin
  for r in select p.oid from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('confirmar_pedido_efectivo','marcar_pedido_entregado','editar_venta_producto','cancelar_venta_producto') loop
    v_def := pg_get_functiondef(r.oid);
    if v_def like '%_scope_pedido%' then continue; end if;
    if position(E'\nbegin\n' in v_def) = 0 then raise exception 'No se halló el inicio de %', r.oid::regprocedure; end if;
    v_def := regexp_replace(v_def, E'\nbegin\n', E'\nbegin\n  perform public._scope_pedido(p_pedido_id);  -- alcance por sede\n');
    execute v_def;
  end loop;
end $$;
create or replace function public._scope_pedido(p_pedido_id uuid)
returns void language plpgsql stable security definer set search_path to 'public' as $$
declare p record;
begin
  select tenant_id, sede_entrega_id into p from public.pedidos where id = p_pedido_id;
  if p is null then raise exception 'Pedido no encontrado'; end if;
  if public._es_finanzas(p.tenant_id) then return; end if;
  if public._es_rol_sede(p.tenant_id) and p.sede_entrega_id = any(public._mis_sedes(p.tenant_id)) then return; end if;
  raise exception 'No autorizado: ese pedido es de otra sede.';
end $$;
revoke all on function public._scope_pedido(uuid) from public;
grant execute on function public._scope_pedido(uuid) to authenticated;

-- Reembolsos y cobros en línea: cada sede ve los suyos.
create or replace function public.reembolsos_listar(p_tenant_id uuid)
returns table(id uuid, clienta text, paquete text, monto numeric, motivo text, estado text, por_clienta boolean, created_at timestamptz, resuelto_at timestamptz, nota text, devuelto_at timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','admin_sede','contadora']) then raise exception 'No autorizado'; end if;
  return query select r.id, c.nombre, p.nombre, r.monto, r.motivo, r.estado, r.solicitado_por_clienta, r.created_at, r.resuelto_at, r.nota_resolucion, r.devuelto_at
    from public.reembolsos r join public.clientes c on c.id = r.cliente_id join public.membresias m on m.id = r.membresia_id join public.paquetes p on p.id = m.paquete_id
    where r.tenant_id = p_tenant_id and (public._es_finanzas(p_tenant_id) or m.sede_venta_id = any(public._mis_sedes(p_tenant_id)))
    order by (r.estado in ('devuelto','rechazado')), r.created_at desc limit 100;
end $$;
create or replace function public.transacciones_listar(p_tenant_id uuid)
returns table(id uuid, created_at timestamptz, clienta text, concepto text, monto numeric, estado text, proveedor text, referencia text)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','admin_sede','contadora']) then raise exception 'No autorizado'; end if;
  return query select t.id, t.created_at, c.nombre, case when t.pedido_id is not null then 'Tienda' else coalesce((select pq.nombre from public.paquetes pq where pq.id = t.paquete_id), 'Paquete') end,
      t.monto, t.estado, t.proveedor, t.proveedor_transaccion_id
    from public.pago_transacciones t join public.clientes c on c.id = t.cliente_id
    where t.tenant_id = p_tenant_id and (public._es_finanzas(p_tenant_id) or t.sede_venta_id = any(public._mis_sedes(p_tenant_id))) order by t.created_at desc limit 100;
end $$;
