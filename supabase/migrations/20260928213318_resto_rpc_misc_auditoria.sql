-- Módulo resto — misceláneos: testimonios públicos, encuesta pendiente, auditoría de acciones admin,
-- chequeo de salud de la plataforma, y el event trigger que auto-habilita RLS en tablas nuevas.
--
-- registrar_accion_admin(): en Forma no se pudo confirmar a qué tablas estaba atado (la auditoría solo
-- capturó funciones, no triggers existentes) — se adjunta aquí a las tablas de dinero más sensibles
-- (membresias, pago_transacciones, gastos, activos, pasivos) como default razonable, no como réplica
-- exacta de Forma. Ajustar la lista cuando haya un caso real que lo pida.

-- Reemplaza testimonios_publicos: SIN tenant_id sería la misma fuga que se evitó en el Hito "resto
-- tablas" (RLS `using(true)`). Aquí sí es seguro porque el tenant se pide explícito como parámetro,
-- no se filtra "todo lo aprobado de cualquier tenant".
create or replace function public.testimonios_publicos(p_tenant_id uuid)
returns table(nombre_publico text, texto text, calificacion integer)
language sql stable security definer
set search_path to 'public'
as $$
  select nombre_publico, texto, calificacion from public.testimonios
  where tenant_id = p_tenant_id and aprobado = true order by created_at desc limit 24;
$$;
revoke all on function public.testimonios_publicos(uuid) from public;
grant execute on function public.testimonios_publicos(uuid) to authenticated, anon;

create or replace function public.mi_encuesta_pendiente(p_tenant_id uuid)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_cliente_id uuid; v_prueba_completada boolean; v_ya_prueba boolean; v_primer_paquete_completado boolean; v_ya_primer boolean;
begin
  v_cliente_id := public.mi_cliente_id(p_tenant_id);
  if v_cliente_id is null then return null; end if;

  select exists(select 1 from public.reservas where cliente_id = v_cliente_id and tipo = 'prueba' and estado = 'confirmada' and fecha < public.hoy_en_sede(null)) into v_prueba_completada;
  select exists(select 1 from public.encuestas_satisfaccion where cliente_id = v_cliente_id and disparador = 'prueba') into v_ya_prueba;
  if v_prueba_completada and not v_ya_prueba then return json_build_object('disparador', 'prueba'); end if;

  select exists(select 1 from public.membresias where cliente_id = v_cliente_id and origen = 'compra' and pagada = true and clases_totales is not null and clases_usadas >= clases_totales) into v_primer_paquete_completado;
  select exists(select 1 from public.encuestas_satisfaccion where cliente_id = v_cliente_id and disparador = 'primer_paquete') into v_ya_primer;
  if v_primer_paquete_completado and not v_ya_primer then return json_build_object('disparador', 'primer_paquete'); end if;

  return null;
end;
$$;
revoke all on function public.mi_encuesta_pendiente(uuid) from public;
grant execute on function public.mi_encuesta_pendiente(uuid) to authenticated;

create or replace function public.marcar_error_resuelto(p_id uuid, p_resuelto boolean)
returns void
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.error_logs where id = p_id;
  if v_tenant_id is not null and not public.tengo_rol_en_tenant(v_tenant_id, array['duena','gerente_general']) then
    raise exception 'No autorizado';
  end if;
  update public.error_logs set resuelto = p_resuelto, resuelto_por = auth.uid(), resuelto_at = case when p_resuelto then now() else null end where id = p_id;
end;
$$;
revoke all on function public.marcar_error_resuelto(uuid, boolean) from public;
grant execute on function public.marcar_error_resuelto(uuid, boolean) to authenticated;

-- Trigger genérico de auditoría (ver nota de cabecera sobre a qué tablas se adjunta aquí).
create or replace function public.registrar_accion_admin()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_nombre text;
  v_tenant_id uuid;
  v_row_id text;
begin
  select nombre into v_actor_nombre from public.tenant_memberships where user_id = v_actor_id
    and tenant_id = coalesce((to_jsonb(new)->>'tenant_id')::uuid, (to_jsonb(old)->>'tenant_id')::uuid);

  if tg_op = 'DELETE' then
    v_tenant_id := (to_jsonb(old)->>'tenant_id')::uuid;
    v_row_id := old.id::text;
    insert into public.admin_acciones_log (tenant_id, actor_id, actor_nombre, tabla, operacion, registro_id, detalle)
      values (v_tenant_id, v_actor_id, v_actor_nombre, tg_table_name, 'delete', v_row_id, to_jsonb(old));
    return old;
  elsif tg_op = 'UPDATE' then
    v_tenant_id := (to_jsonb(new)->>'tenant_id')::uuid;
    v_row_id := new.id::text;
    insert into public.admin_acciones_log (tenant_id, actor_id, actor_nombre, tabla, operacion, registro_id, detalle)
      values (v_tenant_id, v_actor_id, v_actor_nombre, tg_table_name, 'update', v_row_id, jsonb_build_object('antes', to_jsonb(old), 'despues', to_jsonb(new)));
    return new;
  else
    v_tenant_id := (to_jsonb(new)->>'tenant_id')::uuid;
    v_row_id := new.id::text;
    insert into public.admin_acciones_log (tenant_id, actor_id, actor_nombre, tabla, operacion, registro_id, detalle)
      values (v_tenant_id, v_actor_id, v_actor_nombre, tg_table_name, 'insert', v_row_id, to_jsonb(new));
    return new;
  end if;
end;
$$;

create trigger membresias_registrar_accion_admin after insert or update or delete on public.membresias
  for each row execute function public.registrar_accion_admin();
create trigger pago_transacciones_registrar_accion_admin after insert or update or delete on public.pago_transacciones
  for each row execute function public.registrar_accion_admin();
create trigger gastos_registrar_accion_admin after insert or update or delete on public.gastos
  for each row execute function public.registrar_accion_admin();
create trigger activos_registrar_accion_admin after insert or update or delete on public.activos
  for each row execute function public.registrar_accion_admin();
create trigger pasivos_registrar_accion_admin after insert or update or delete on public.pasivos
  for each row execute function public.registrar_accion_admin();

create or replace function public.chequeo_salud__interno(p_tenant_id uuid)
returns table(chequeo text, severidad text, cantidad integer, detalle jsonb)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  return query
  select 'Reserva con fecha que no corresponde al horario', 'alta', count(*)::int,
    coalesce(jsonb_agg(jsonb_build_object('reserva_id', r.id, 'clienta', c.nombre, 'fecha', r.fecha, 'horario', h.hora_inicio)) filter (where r.id is not null), '[]'::jsonb)
  from public.reservas r join public.horarios h on h.id = r.horario_id join public.clientes c on c.id = r.cliente_id
  where r.tenant_id = p_tenant_id and r.estado = 'confirmada'
    and not ((h.fecha_especifica is null and h.dia_semana = extract(dow from r.fecha)::int) or h.fecha_especifica = r.fecha);

  return query
  select 'Reserva confirmada en fecha cancelada o privatizada', 'alta', count(*)::int,
    coalesce(jsonb_agg(jsonb_build_object('reserva_id', r.id, 'clienta', c.nombre, 'fecha', r.fecha)) filter (where r.id is not null), '[]'::jsonb)
  from public.reservas r join public.clientes c on c.id = r.cliente_id
  where r.tenant_id = p_tenant_id and r.estado = 'confirmada' and r.tipo = 'regular'
    and (exists (select 1 from public.horario_cancelaciones hc where hc.horario_id = r.horario_id and hc.fecha = r.fecha)
         or exists (select 1 from public.horario_fechas_privadas hp where hp.horario_id = r.horario_id and hp.fecha = r.fecha));

  return query
  select 'Paquete con más clases usadas que las que tiene', 'alta', count(*)::int,
    coalesce(jsonb_agg(jsonb_build_object('membresia_id', m.id, 'clienta', c.nombre, 'usadas', m.clases_usadas, 'totales', m.clases_totales)) filter (where m.id is not null), '[]'::jsonb)
  from public.membresias m join public.clientes c on c.id = m.cliente_id
  where m.tenant_id = p_tenant_id and m.clases_totales is not null and m.clases_usadas > m.clases_totales;

  return query
  select 'Membresía paga sin precio guardado', 'media', count(*)::int,
    coalesce(jsonb_agg(jsonb_build_object('membresia_id', m.id, 'clienta', c.nombre, 'paquete', pq.nombre)) filter (where m.id is not null), '[]'::jsonb)
  from public.membresias m join public.clientes c on c.id = m.cliente_id join public.paquetes pq on pq.id = m.paquete_id
  where m.tenant_id = p_tenant_id and m.pagada = true and m.precio_final is null and m.origen <> 'cortesia';

  return query
  select 'Inventario en negativo', 'alta', count(*)::int,
    coalesce(jsonb_agg(jsonb_build_object('producto', p.nombre, 'variante', v.nombre, 'stock', v.stock)) filter (where v.id is not null), '[]'::jsonb)
  from public.producto_variantes v join public.productos p on p.id = v.producto_id
  where v.tenant_id = p_tenant_id and v.stock < 0;

  return query
  select 'Número de referencia de transferencia repetido entre paquetes', 'media', count(*)::int,
    coalesce(jsonb_agg(jsonb_build_object('referencia', t.referencia_pago, 'veces', t.n)) filter (where t.referencia_pago is not null), '[]'::jsonb)
  from (select referencia_pago, count(*) n from public.membresias where tenant_id = p_tenant_id and metodo_pago = 'transferencia' and referencia_pago is not null and estado <> 'anulada' group by referencia_pago having count(*) > 1) t;

  return query
  select 'Pago pendiente hace más de 7 días sin resolver', 'baja', count(*)::int,
    coalesce(jsonb_agg(jsonb_build_object('membresia_id', m.id, 'clienta', c.nombre, 'desde', m.created_at::date)) filter (where m.id is not null), '[]'::jsonb)
  from public.membresias m join public.clientes c on c.id = m.cliente_id
  where m.tenant_id = p_tenant_id and m.pagada = false and m.estado in ('activa', 'pendiente_pago') and m.created_at < now() - interval '7 days';

  return query
  select 'Misma clienta con dos reservas confirmadas en el mismo horario y fecha', 'alta', count(*)::int,
    coalesce(jsonb_agg(jsonb_build_object('clienta', c.nombre, 'fecha', x.fecha, 'horario_id', x.horario_id)) filter (where x.horario_id is not null), '[]'::jsonb)
  from (select cliente_id, horario_id, fecha from public.reservas where tenant_id = p_tenant_id and estado = 'confirmada' group by cliente_id, horario_id, fecha having count(*) > 1) x
  join public.clientes c on c.id = x.cliente_id;
end;
$$;
revoke all on function public.chequeo_salud__interno(uuid) from public;

create or replace function public.chequeo_salud(p_tenant_id uuid)
returns table(chequeo text, severidad text, cantidad integer, detalle jsonb)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.staff_puede_en_sede(p_tenant_id, null, array['duena','gerente_general','admin_sede']) then
    raise exception 'No autorizado';
  end if;
  return query select * from public.chequeo_salud__interno(p_tenant_id);
end;
$$;
revoke all on function public.chequeo_salud(uuid) from public;
grant execute on function public.chequeo_salud(uuid) to authenticated;

-- Event trigger de plataforma (no por tenant): auto-habilita RLS en cualquier tabla nueva del esquema
-- public — la misma red de seguridad que Forma ya tenía, y que habría evitado tener que redescubrir
-- el hallazgo del Hito B (grants de anon por defecto) por las malas.
create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql security definer
set search_path to 'pg_catalog'
as $$
declare
  cmd record;
begin
  for cmd in
    select * from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO') and object_type in ('table','partitioned table')
  loop
    if cmd.schema_name is not null and cmd.schema_name = 'public' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception when others then
        raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    end if;
  end loop;
end;
$$;
create event trigger reserveos_rls_auto_enable on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function public.rls_auto_enable();
