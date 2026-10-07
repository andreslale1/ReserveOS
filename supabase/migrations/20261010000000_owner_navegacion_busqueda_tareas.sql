-- Apoyo de la consola de owner: búsqueda global, cola "requiere mi acción" con comparativa del mes anterior,
-- y tareas con prioridad, responsable elegible y posponer. Fechas del día en hora de Guatemala.

alter table public.plataforma_tareas add column if not exists prioridad text not null default 'normal';
do $$ begin
  alter table public.plataforma_tareas add constraint plataforma_tareas_prioridad_chk check (prioridad in ('baja','normal','alta'));
exception when duplicate_object then null; end $$;

drop function if exists public.tarea_guardar(uuid, uuid, uuid, text, date);
create or replace function public.tarea_guardar(p_id uuid, p_lead_id uuid, p_tenant_id uuid, p_titulo text, p_vence date,
  p_prioridad text default 'normal', p_responsable_id uuid default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; v_resp uuid; v_nombre text;
begin
  if not public._plat_ok(array['ventas','finanzas','soporte']) then raise exception 'No autorizado'; end if;
  if p_titulo is null or length(trim(p_titulo)) = 0 then raise exception 'Escribe la tarea'; end if;
  if coalesce(p_prioridad,'normal') not in ('baja','normal','alta') then raise exception 'Prioridad no válida'; end if;
  v_resp := coalesce(p_responsable_id, auth.uid());
  select nombre into v_nombre from public.plataforma_staff where user_id = v_resp;
  if v_nombre is null then raise exception 'El responsable debe ser del equipo de ReserveOS'; end if;
  if p_id is null then
    insert into public.plataforma_tareas (lead_id, tenant_id, titulo, vence, prioridad, responsable_id, responsable_nombre)
      values (p_lead_id, p_tenant_id, trim(p_titulo), p_vence, coalesce(p_prioridad,'normal'), v_resp, v_nombre) returning id into v_id;
  else
    update public.plataforma_tareas set titulo = trim(p_titulo), vence = p_vence, prioridad = coalesce(p_prioridad,'normal'),
      responsable_id = v_resp, responsable_nombre = v_nombre,
      lead_id = coalesce(p_lead_id, lead_id), tenant_id = coalesce(p_tenant_id, tenant_id)
      where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;
revoke all on function public.tarea_guardar(uuid, uuid, uuid, text, date, text, uuid) from public;
grant execute on function public.tarea_guardar(uuid, uuid, uuid, text, date, text, uuid) to authenticated;

drop function if exists public.tareas_listar();
create or replace function public.tareas_listar()
returns table(id uuid, titulo text, vence date, estado text, responsable text, lead_id uuid, empresa text, tenant_id uuid, estudio text, prioridad text, responsable_id uuid)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['ventas','finanzas','soporte']) then raise exception 'No autorizado'; end if;
  return query select t.id, t.titulo, t.vence, t.estado, t.responsable_nombre, t.lead_id, l.nombre, t.tenant_id, te.name, t.prioridad, t.responsable_id
    from public.plataforma_tareas t
    left join public.plataforma_leads l on l.id = t.lead_id
    left join public.tenants te on te.id = t.tenant_id
    order by (t.estado = 'hecha'), t.vence nulls last, t.created_at;
end $$;
revoke all on function public.tareas_listar() from public;
grant execute on function public.tareas_listar() to authenticated;

create or replace function public.tarea_posponer(p_id uuid, p_dias integer)
returns void language plpgsql security definer set search_path to 'public' as $$
declare hoy date := (now() at time zone 'America/Guatemala')::date;
begin
  if not public._plat_ok(array['ventas','finanzas','soporte']) then raise exception 'No autorizado'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 90 then raise exception 'Elige entre 1 y 90 días'; end if;
  update public.plataforma_tareas set vence = greatest(coalesce(vence, hoy), hoy) + p_dias where id = p_id and estado = 'pendiente';
  if not found then raise exception 'La tarea no existe o ya está hecha'; end if;
end $$;
revoke all on function public.tarea_posponer(uuid, integer) from public;
grant execute on function public.tarea_posponer(uuid, integer) to authenticated;

create or replace function public.tareas_responsables()
returns table(user_id uuid, nombre text) language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['ventas','finanzas','soporte']) then raise exception 'No autorizado'; end if;
  return query select s.user_id, s.nombre from public.plataforma_staff s order by s.nombre;
end $$;
revoke all on function public.tareas_responsables() from public;
grant execute on function public.tareas_responsables() to authenticated;

-- Búsqueda global: cada tipo solo se devuelve a los roles que pueden abrirlo.
create or replace function public.owner_buscar(p_q text)
returns table(tipo text, id uuid, titulo text, detalle text, href text)
language plpgsql stable security definer set search_path to 'public' as $$
declare v_rol text; q text := '%' || replace(replace(trim(coalesce(p_q,'')), '%', ''), '_', '') || '%';
begin
  select rol into v_rol from public.plataforma_staff where user_id = auth.uid();
  if v_rol is null then raise exception 'No autorizado'; end if;
  if length(trim(coalesce(p_q,''))) < 2 then return; end if;
  if v_rol in ('operador','soporte','implementacion','ingenieria') then
    return query select 'Estudio'::text, t.id, t.name, coalesce(t.slug,'') || ' · ' || coalesce(t.status::text,''), '/owner/' || t.id::text
      from public.tenants t where t.name ilike q or t.slug ilike q order by t.name limit 6;
    return query select 'Ticket'::text, k.id, k.asunto, k.estado || ' · ' || k.prioridad, '/owner/soporte/' || k.id::text
      from public.plataforma_tickets k where k.asunto ilike q order by k.created_at desc limit 6;
  end if;
  if v_rol in ('operador','ventas') then
    return query select 'Oportunidad'::text, l.id, l.nombre, l.etapa || coalesce(' · ' || l.email, ''), '/owner/pipeline/' || l.id::text
      from public.plataforma_leads l where l.nombre ilike q or l.email ilike q or l.contacto ilike q order by l.updated_at desc limit 6;
  end if;
end $$;
revoke all on function public.owner_buscar(text) from public;
grant execute on function public.owner_buscar(text) to authenticated;

-- Dirección: cola de acciones con responsable y vencimiento + mes actual vs anterior (mes calendario en hora de Guatemala).
create or replace function public.owner_direccion_extra()
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare hoy date := (now() at time zone 'America/Guatemala')::date;
  m0 date := date_trunc('month', (now() at time zone 'America/Guatemala'))::date;
  m1 date := (date_trunc('month', (now() at time zone 'America/Guatemala')) - interval '1 month')::date;
  v json;
begin
  if not public._plat_ok(array['ventas','finanzas','soporte']) then raise exception 'No autorizado'; end if;
  select json_build_object(
    'hoy', hoy,
    'acciones', coalesce((select json_agg(a order by a.orden, a.vence nulls last) from (
        select 1 orden, 'Propuesta sin seguimiento' tipo, l.nombre titulo, 'Sin actividad desde ' || to_char(l.updated_at at time zone 'America/Guatemala', 'DD/MM/YYYY') detalle,
               '/owner/pipeline/' || l.id::text href, (l.updated_at at time zone 'America/Guatemala')::date + 7 vence, coalesce(s.nombre, 'Sin responsable') responsable
          from public.plataforma_leads l left join public.plataforma_staff s on s.user_id = l.responsable_id
         where l.etapa not in ('ganado','perdido') and l.updated_at < now() - interval '7 days'
           and exists (select 1 from public.plataforma_propuestas p where p.lead_id = l.id and p.estado in ('enviada','negociando'))
        union all
        select 2, 'Activación detenida', p.nombre,
               (select count(*) from jsonb_array_elements(p.etapas) e where (e->>'obligatoria')::boolean and not (e->>'hecha')::boolean)::text || ' etapas obligatorias pendientes tras ' || (hoy - (p.created_at at time zone 'America/Guatemala')::date)::text || ' días',
               '/owner/activaciones', (p.created_at at time zone 'America/Guatemala')::date + 14, 'Implementación'
          from public.plataforma_proyectos p
         where p.estado = 'en_curso' and p.created_at < now() - interval '14 days'
           and exists (select 1 from jsonb_array_elements(p.etapas) e where (e->>'obligatoria')::boolean and not (e->>'hecha')::boolean)
        union all
        select 3, 'Cobro vencido', te.name, 'Q' || (c.monto - c.descuento - c.monto_pagado)::text || ' · período ' || coalesce(c.periodo::text, ''),
               '/owner/cobros', c.fecha_vencimiento, 'Finanzas'
          from public.plataforma_cobros c join public.tenants te on te.id = c.tenant_id
         where c.estado in ('pendiente','parcial') and c.fecha_vencimiento < hoy
        union all
        select 4, 'Incidente ' || i.severidad, i.titulo, i.estado || ' desde ' || to_char(i.started_at at time zone 'America/Guatemala', 'DD/MM/YYYY'),
               '/owner/soporte', (i.started_at at time zone 'America/Guatemala')::date, 'Soporte'
          from public.plataforma_incidentes i where i.estado <> 'resuelto' and i.severidad in ('critico','mayor')
        union all
        select 4, 'Ticket con SLA vencido', k.asunto, k.prioridad || ' · ' || k.estado, '/owner/soporte/' || k.id::text,
               (k.sla_vence at time zone 'America/Guatemala')::date, coalesce(k.asignado_a, 'Sin asignar')
          from public.plataforma_tickets k where k.estado in ('abierto','en_curso') and k.sla_vence < now()
        union all
        select 5, 'Dominio sin verificar', d.domain, 'Solicitado el ' || to_char(d.solicitado_at at time zone 'America/Guatemala', 'DD/MM/YYYY'),
               '/owner/dominios', (d.solicitado_at at time zone 'America/Guatemala')::date + 3, 'Soporte'
          from public.tenant_domains d where not d.verified and d.solicitado_at < now() - interval '3 days'
      ) a limit 30), '[]'::json),
    'comparativa', json_build_object(
      'oportunidades_nuevas', json_build_array(
        (select count(*) from public.plataforma_leads where (created_at at time zone 'America/Guatemala')::date >= m0),
        (select count(*) from public.plataforma_leads where (created_at at time zone 'America/Guatemala')::date >= m1 and (created_at at time zone 'America/Guatemala')::date < m0)),
      'ganadas', json_build_array(
        (select count(*) from public.plataforma_leads where etapa = 'ganado' and (updated_at at time zone 'America/Guatemala')::date >= m0),
        (select count(*) from public.plataforma_leads where etapa = 'ganado' and (updated_at at time zone 'America/Guatemala')::date >= m1 and (updated_at at time zone 'America/Guatemala')::date < m0)),
      'cobrado', json_build_array(
        coalesce((select sum(monto_pagado) from public.plataforma_cobros where fecha_pago >= m0), 0),
        coalesce((select sum(monto_pagado) from public.plataforma_cobros where fecha_pago >= m1 and fecha_pago < m0), 0)),
      'tickets_nuevos', json_build_array(
        (select count(*) from public.plataforma_tickets where (created_at at time zone 'America/Guatemala')::date >= m0),
        (select count(*) from public.plataforma_tickets where (created_at at time zone 'America/Guatemala')::date >= m1 and (created_at at time zone 'America/Guatemala')::date < m0))
    )
  ) into v;
  return v;
end $$;
revoke all on function public.owner_direccion_extra() from public;
grant execute on function public.owner_direccion_extra() to authenticated;
