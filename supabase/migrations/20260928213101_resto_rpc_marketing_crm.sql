-- Módulo resto — KPIs de marketing/CRM y listas de clientas para seguimiento. Todas tenant-scoped,
-- rol dueña/gerente_general salvo donde se indica.

create or replace function public.kpi_adquisicion(p_tenant_id uuid, p_meses integer default 3)
returns table(canal text, gasto_total numeric, clientas_nuevas bigint, cac numeric, ltv_promedio numeric, ltv_cac_ratio numeric)
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_desde date := date_trunc('month', public.hoy_en_sede(null))::date - ((p_meses - 1) * interval '1 month');
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then return; end if;
  return query
  with gasto as (select g.canal, sum(g.monto) as gasto_total from public.gasto_marketing g where g.tenant_id = p_tenant_id and g.mes >= v_desde group by g.canal),
  nuevas as (select c.como_se_entero as canal, count(*) as clientas_nuevas from public.clientes c
    where c.tenant_id = p_tenant_id and c.como_se_entero is not null and c.created_at >= v_desde group by c.como_se_entero),
  ltv as (
    select c.como_se_entero as canal, avg(pagos.monto) as ltv_promedio
    from public.clientes c join (
      select m.cliente_id, sum(coalesce(m.precio_final, p.precio, 0)) as monto from public.membresias m join public.paquetes p on p.id = m.paquete_id
      where m.tenant_id = p_tenant_id and m.pagada = true group by m.cliente_id
    ) pagos on pagos.cliente_id = c.id
    where c.tenant_id = p_tenant_id and c.como_se_entero is not null group by c.como_se_entero
  )
  select coalesce(g.canal, n.canal, l.canal), coalesce(g.gasto_total, 0), coalesce(n.clientas_nuevas, 0),
    case when coalesce(n.clientas_nuevas, 0) > 0 then round(coalesce(g.gasto_total, 0) / n.clientas_nuevas, 2) else null end,
    round(coalesce(l.ltv_promedio, 0), 2),
    case when coalesce(n.clientas_nuevas, 0) > 0 and coalesce(g.gasto_total, 0) > 0
      then round(coalesce(l.ltv_promedio, 0) / (coalesce(g.gasto_total, 0) / n.clientas_nuevas), 2) else null end
  from gasto g full outer join nuevas n on n.canal = g.canal full outer join ltv l on l.canal = coalesce(g.canal, n.canal)
  order by 1;
end;
$$;
revoke all on function public.kpi_adquisicion(uuid, integer) from public;
grant execute on function public.kpi_adquisicion(uuid, integer) to authenticated;

create or replace function public.kpi_cancelaciones_prueba__interno(p_tenant_id uuid, p_dias integer default 30)
returns json
language sql stable security definer
set search_path to 'public'
as $$
  with universo as (select id, cliente_id from public.reservas where tenant_id = p_tenant_id and tipo = 'prueba' and fecha >= public.hoy_en_sede(null) - p_dias),
  canceladas as (select r.id, r.cliente_id from public.reservas r where r.tenant_id = p_tenant_id and r.tipo = 'prueba' and r.estado = 'cancelada' and r.fecha >= public.hoy_en_sede(null) - p_dias),
  reagendadas as (select c.id from canceladas c where exists (select 1 from public.reservas r2 where r2.cliente_id = c.cliente_id and r2.estado = 'confirmada'))
  select json_build_object(
    'total_pruebas', (select count(*) from universo), 'total_canceladas', (select count(*) from canceladas),
    'pct_cancelacion', case when (select count(*) from universo) > 0 then round(100.0 * (select count(*) from canceladas) / (select count(*) from universo), 1) else 0 end,
    'total_reagendadas', (select count(*) from reagendadas),
    'pct_reagendo', case when (select count(*) from canceladas) > 0 then round(100.0 * (select count(*) from reagendadas) / (select count(*) from canceladas), 1) else 0 end
  );
$$;
revoke all on function public.kpi_cancelaciones_prueba__interno(uuid, integer) from public;

create or replace function public.kpi_cancelaciones_prueba(p_tenant_id uuid, p_dias integer default 30)
returns json
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then raise exception 'No autorizado'; end if;
  return public.kpi_cancelaciones_prueba__interno(p_tenant_id, p_dias);
end;
$$;
revoke all on function public.kpi_cancelaciones_prueba(uuid, integer) from public;
grant execute on function public.kpi_cancelaciones_prueba(uuid, integer) to authenticated;

create or replace function public.kpi_clases_alta_ocupacion(p_tenant_id uuid, p_semanas integer default 8)
returns table(semana date, clases_totales bigint, clases_alta_ocupacion bigint, pct_alta_ocupacion numeric)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then return; end if;
  return query
  with sesiones as (
    select r.horario_id, r.fecha, date_trunc('week', r.fecha)::date as sem, count(*) as reservas, h.cupo_maximo
    from public.reservas r join public.horarios h on h.id = r.horario_id
    where r.tenant_id = p_tenant_id and r.estado = 'confirmada' and r.fecha < public.hoy_en_sede(r.sede_id)
      and r.fecha >= public.hoy_en_sede(null) - (p_semanas * 7) and h.categoria = 'regular'
    group by r.horario_id, r.fecha, h.cupo_maximo
  )
  select sem, count(*), count(*) filter (where cupo_maximo > 0 and reservas::numeric / cupo_maximo > 0.7),
    round(100.0 * count(*) filter (where cupo_maximo > 0 and reservas::numeric / cupo_maximo > 0.7) / count(*), 1)
  from sesiones group by sem order by sem;
end;
$$;
revoke all on function public.kpi_clases_alta_ocupacion(uuid, integer) from public;
grant execute on function public.kpi_clases_alta_ocupacion(uuid, integer) to authenticated;

create or replace function public.kpi_clientas_nuevas_mensual__interno(p_tenant_id uuid, p_meses integer default 12)
returns table(mes date, clientas_real bigint)
language sql stable security definer
set search_path to 'public'
as $$
  select date_trunc('month', c.created_at)::date, count(*) from public.clientes c where c.tenant_id = p_tenant_id
    group by 1 order by 1 desc limit p_meses;
$$;
revoke all on function public.kpi_clientas_nuevas_mensual__interno(uuid, integer) from public;

create or replace function public.kpi_clientas_nuevas_mensual(p_tenant_id uuid, p_meses integer default 12)
returns table(mes date, clientas_real bigint)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then raise exception 'No autorizado'; end if;
  return query select * from public.kpi_clientas_nuevas_mensual__interno(p_tenant_id, p_meses);
end;
$$;
revoke all on function public.kpi_clientas_nuevas_mensual(uuid, integer) from public;
grant execute on function public.kpi_clientas_nuevas_mensual(uuid, integer) to authenticated;

create or replace function public.kpi_detalle_cancelaciones_prueba__interno(p_tenant_id uuid, p_dias integer default 30)
returns table(reserva_id uuid, cliente_id uuid, cliente_nombre text, cliente_telefono text, cliente_email text,
  fecha date, hora_inicio time, reservo_de_nuevo boolean, nueva_fecha date, nueva_hora time)
language sql stable security definer
set search_path to 'public'
as $$
  select r.id, r.cliente_id, c.nombre, c.telefono, c.email, r.fecha, h.hora_inicio, r2n.id is not null, r2n.fecha, h2n.hora_inicio
  from public.reservas r
  join public.clientes c on c.id = r.cliente_id
  join public.horarios h on h.id = r.horario_id
  left join lateral (select r2.* from public.reservas r2 where r2.cliente_id = r.cliente_id and r2.estado = 'confirmada' order by r2.fecha asc, r2.created_at asc limit 1) r2n on true
  left join public.horarios h2n on h2n.id = r2n.horario_id
  where r.tenant_id = p_tenant_id and r.tipo = 'prueba' and r.estado = 'cancelada' and r.fecha >= public.hoy_en_sede(null) - p_dias
  order by r.fecha desc, h.hora_inicio;
$$;
revoke all on function public.kpi_detalle_cancelaciones_prueba__interno(uuid, integer) from public;

create or replace function public.kpi_detalle_cancelaciones_prueba(p_tenant_id uuid, p_dias integer default 30)
returns table(reserva_id uuid, cliente_id uuid, cliente_nombre text, cliente_telefono text, cliente_email text,
  fecha date, hora_inicio time, reservo_de_nuevo boolean, nueva_fecha date, nueva_hora time)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then raise exception 'No autorizado'; end if;
  return query select * from public.kpi_detalle_cancelaciones_prueba__interno(p_tenant_id, p_dias);
end;
$$;
revoke all on function public.kpi_detalle_cancelaciones_prueba(uuid, integer) from public;
grant execute on function public.kpi_detalle_cancelaciones_prueba(uuid, integer) to authenticated;

create or replace function public.kpi_embudo_prueba__interno(p_tenant_id uuid, p_dias integer default 90)
returns json
language sql stable security definer
set search_path to 'public'
as $$
  with pruebas as (
    select distinct cliente_id, min(fecha) as primera_prueba from public.reservas
    where tenant_id = p_tenant_id and tipo = 'prueba' and fecha >= public.hoy_en_sede(null) - p_dias group by cliente_id
  ),
  convertidas as (select p.cliente_id from pruebas p where exists (select 1 from public.membresias m where m.cliente_id = p.cliente_id and m.origen = 'compra'))
  select json_build_object('total_pruebas', (select count(*) from pruebas), 'total_convertidas', (select count(*) from convertidas),
    'pct_conversion', case when (select count(*) from pruebas) > 0 then round(100.0 * (select count(*) from convertidas) / (select count(*) from pruebas), 1) else 0 end);
$$;
revoke all on function public.kpi_embudo_prueba__interno(uuid, integer) from public;

create or replace function public.kpi_embudo_prueba(p_tenant_id uuid, p_dias integer default 90)
returns json
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then raise exception 'No autorizado'; end if;
  return public.kpi_embudo_prueba__interno(p_tenant_id, p_dias);
end;
$$;
revoke all on function public.kpi_embudo_prueba(uuid, integer) from public;
grant execute on function public.kpi_embudo_prueba(uuid, integer) to authenticated;

create or replace function public.kpi_ingreso_bruto_mensual__interno(p_tenant_id uuid, p_meses integer default 12)
returns table(mes date, ingreso_real numeric)
language sql stable security definer
set search_path to 'public'
as $$
  with membresias_mes as (
    select date_trunc('month', m.confirmado_at)::date as mes, coalesce(m.precio_final, pq.precio, 0) as monto
    from public.membresias m join public.paquetes pq on pq.id = m.paquete_id
    where m.tenant_id = p_tenant_id and m.estado = 'activa' and m.pagada = true and m.confirmado_at is not null
  ),
  privatizaciones_mes as (
    select date_trunc('month', confirmado_at)::date as mes, precio as monto from public.horario_fechas_privadas_personas
    where tenant_id = p_tenant_id and pagada = true and confirmado_at is not null
  ),
  pedidos_mes as (
    select date_trunc('month', pagado_at)::date as mes, total as monto from public.pedidos
    where tenant_id = p_tenant_id and estado in ('pagado', 'entregado') and pagado_at is not null
  ),
  cobros_personalizados_mes as (
    select date_trunc('month', confirmado_at)::date as mes, monto from public.cobros_personalizados
    where tenant_id = p_tenant_id and confirmado_at is not null
  ),
  todo as (select * from membresias_mes union all select * from privatizaciones_mes union all select * from pedidos_mes union all select * from cobros_personalizados_mes)
  select t.mes, sum(t.monto) from todo t group by t.mes order by t.mes desc limit p_meses;
$$;
revoke all on function public.kpi_ingreso_bruto_mensual__interno(uuid, integer) from public;

create or replace function public.kpi_ingreso_bruto_mensual(p_tenant_id uuid, p_meses integer default 12)
returns table(mes date, ingreso_real numeric)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then raise exception 'No autorizado'; end if;
  return query select * from public.kpi_ingreso_bruto_mensual__interno(p_tenant_id, p_meses);
end;
$$;
revoke all on function public.kpi_ingreso_bruto_mensual(uuid, integer) from public;
grant execute on function public.kpi_ingreso_bruto_mensual(uuid, integer) to authenticated;

create or replace function public.kpi_prelanzamiento(p_tenant_id uuid, p_fecha_apertura date)
returns json
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_cupos_vendidos int; v_pruebas_pasadas int; v_pruebas_asistidas int;
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then return null; end if;
  select count(*) into v_cupos_vendidos from public.reservas
    where tenant_id = p_tenant_id and estado = 'confirmada' and fecha >= p_fecha_apertura and fecha < p_fecha_apertura + 7;
  select count(*), count(*) filter (where asistio is true) into v_pruebas_pasadas, v_pruebas_asistidas
    from public.reservas where tenant_id = p_tenant_id and tipo = 'prueba' and estado = 'confirmada' and fecha < public.hoy_en_sede(null);
  return json_build_object('cupos_vendidos', v_cupos_vendidos, 'pruebas_pasadas', v_pruebas_pasadas,
    'tasa_show_up_pct', case when v_pruebas_pasadas > 0 then round(100.0 * v_pruebas_asistidas / v_pruebas_pasadas, 1) else null end);
end;
$$;
revoke all on function public.kpi_prelanzamiento(uuid, date) from public;
grant execute on function public.kpi_prelanzamiento(uuid, date) to authenticated;

create or replace function public.kpi_ranking_instructoras(p_tenant_id uuid)
returns table(instructor_membership_id uuid, nombre text, total_clases bigint, ocupacion_promedio numeric, pct_asistencia numeric)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then return; end if;
  return query
  with sesiones as (
    select h.instructor_membership_id, r.fecha, r.horario_id, count(*) filter (where r.estado = 'confirmada')::numeric as reservas, h.cupo_maximo,
      count(*) filter (where r.estado = 'confirmada' and r.fecha < public.hoy_en_sede(r.sede_id)) as pasadas,
      count(*) filter (where r.estado = 'confirmada' and r.fecha < public.hoy_en_sede(r.sede_id) and r.asistio is true) as asistidas
    from public.horarios h join public.reservas r on r.horario_id = h.id
    where h.tenant_id = p_tenant_id and h.instructor_membership_id is not null
    group by h.instructor_membership_id, r.fecha, r.horario_id, h.cupo_maximo
  )
  select tm.id, tm.nombre, count(distinct (s.fecha, s.horario_id)), round(avg(s.reservas / s.cupo_maximo * 100), 1),
    case when sum(s.pasadas) = 0 then null else round(100.0 * sum(s.asistidas) / sum(s.pasadas), 1) end
  from public.tenant_memberships tm join sesiones s on s.instructor_membership_id = tm.id
  where tm.tenant_id = p_tenant_id and tm.role = 'instructora'
  group by tm.id, tm.nombre order by 4 desc nulls last;
end;
$$;
revoke all on function public.kpi_ranking_instructoras(uuid) from public;
grant execute on function public.kpi_ranking_instructoras(uuid) to authenticated;

create or replace function public.kpi_resumen_clientas(p_tenant_id uuid)
returns json
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_total int; v_recurrentes int; v_referidas int; v_antiguedad_prom numeric;
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then return null; end if;
  select count(*) into v_total from public.clientes where tenant_id = p_tenant_id and user_id is not null;
  select count(*) into v_recurrentes from (select cliente_id from public.membresias where tenant_id = p_tenant_id group by cliente_id having count(*) >= 2) x;
  select count(*) into v_referidas from public.clientes where tenant_id = p_tenant_id and user_id is not null and referido_por is not null;
  select avg(extract(epoch from (now() - created_at)) / 86400.0) into v_antiguedad_prom from public.clientes where tenant_id = p_tenant_id and user_id is not null;
  return json_build_object('total', v_total, 'recurrentes', v_recurrentes, 'nuevas', v_total - v_recurrentes,
    'tasa_referidos_pct', case when v_total > 0 then round(100.0 * v_referidas / v_total, 1) else null end,
    'antiguedad_promedio_dias', round(coalesce(v_antiguedad_prom, 0)));
end;
$$;
revoke all on function public.kpi_resumen_clientas(uuid) from public;
grant execute on function public.kpi_resumen_clientas(uuid) to authenticated;

create or replace function public.clientas_sin_clase_para_contactar(p_tenant_id uuid)
returns table(cliente_id uuid, nombre text, telefono text, email text, motivo text, ultima_clase_intentada date)
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_hoy date := public.hoy_en_sede(null);
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then return; end if;
  return query
  with trial_fallidas as (
    select distinct on (r.cliente_id) r.cliente_id,
      case when r.estado = 'cancelada' then 'Canceló su prueba y no reagendó' else 'No asistió a su prueba y no reagendó' end as motivo, r.fecha
    from public.reservas r
    where r.tenant_id = p_tenant_id and r.tipo = 'prueba'
      and (r.estado = 'cancelada' or (r.estado = 'confirmada' and r.fecha < v_hoy and coalesce(r.asistio, false) = false))
      and not exists (select 1 from public.reservas r2 where r2.cliente_id = r.cliente_id and r2.estado = 'confirmada' and r2.id <> r.id)
    order by r.cliente_id, r.fecha desc
  ),
  nunca_asistieron as (
    select c.id as cliente_id, 'Nunca ha tomado ninguna clase'::text as motivo, null::date as fecha
    from public.clientes c
    where c.tenant_id = p_tenant_id
      and not exists (select 1 from public.reservas r where r.cliente_id = c.id and r.asistio = true)
      and not exists (select 1 from public.reservas r where r.cliente_id = c.id and r.estado = 'confirmada' and r.fecha >= v_hoy)
      and not exists (select 1 from trial_fallidas tf where tf.cliente_id = c.id)
  )
  select c.id, c.nombre, c.telefono, c.email, u.motivo, u.fecha
  from (select * from trial_fallidas union all select * from nunca_asistieron) u
  join public.clientes c on c.id = u.cliente_id
  order by c.nombre;
end;
$$;
revoke all on function public.clientas_sin_clase_para_contactar(uuid) from public;
grant execute on function public.clientas_sin_clase_para_contactar(uuid) to authenticated;

create or replace function public.kpi_seguimiento_prueba(p_tenant_id uuid)
returns json
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_hoy date := public.hoy_en_sede(null); v_no_asistio int; v_cancelada int; v_reagendaron int; v_sin_clase int;
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then return null; end if;
  select count(*) into v_no_asistio from public.reservas r where r.tenant_id = p_tenant_id and r.tipo = 'prueba' and r.estado = 'confirmada' and r.fecha < v_hoy and coalesce(r.asistio, false) = false;
  select count(*) into v_cancelada from public.reservas r where r.tenant_id = p_tenant_id and r.tipo = 'prueba' and r.estado = 'cancelada';
  select count(*) into v_reagendaron from public.reservas r where r.tenant_id = p_tenant_id and r.tipo = 'prueba'
    and (r.estado = 'cancelada' or (r.estado = 'confirmada' and r.fecha < v_hoy and coalesce(r.asistio, false) = false))
    and exists (select 1 from public.reservas r2 where r2.cliente_id = r.cliente_id and r2.estado = 'confirmada' and r2.id <> r.id);
  select count(*) into v_sin_clase from public.clientas_sin_clase_para_contactar(p_tenant_id);
  return json_build_object('total_no_asistio', v_no_asistio, 'total_cancelada', v_cancelada, 'total_reagendaron', v_reagendaron, 'total_sin_clase', v_sin_clase);
end;
$$;
revoke all on function public.kpi_seguimiento_prueba(uuid) from public;
grant execute on function public.kpi_seguimiento_prueba(uuid) to authenticated;

create or replace function public.kpi_retencion(p_tenant_id uuid)
returns json
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_hoy date := public.hoy_en_sede(null); v_vencidas_ventana int; v_no_renovaron int; v_en_riesgo int; v_recurrentes int; v_total int;
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then return null; end if;
  select count(*) into v_vencidas_ventana from public.membresias m where m.tenant_id = p_tenant_id and m.estado in ('activa','vencida') and m.fecha_vencimiento between v_hoy - 60 and v_hoy - 30;
  select count(*) into v_no_renovaron from public.membresias m where m.tenant_id = p_tenant_id and m.estado in ('activa','vencida') and m.fecha_vencimiento between v_hoy - 60 and v_hoy - 30
    and not exists (select 1 from public.membresias m2 where m2.cliente_id = m.cliente_id and m2.created_at::date > m.fecha_vencimiento);
  select count(distinct m.cliente_id) into v_en_riesgo from public.membresias m
    where m.tenant_id = p_tenant_id and m.estado = 'activa' and m.fecha_vencimiento >= v_hoy
      and not exists (select 1 from public.reservas r where r.cliente_id = m.cliente_id and r.estado = 'confirmada' and r.fecha between v_hoy - 14 and v_hoy + 7);
  select count(*) into v_total from public.clientes where tenant_id = p_tenant_id and user_id is not null;
  select count(*) into v_recurrentes from (select cliente_id from public.membresias where tenant_id = p_tenant_id group by cliente_id having count(*) >= 2) x;
  return json_build_object('churn_pct', case when v_vencidas_ventana > 0 then round(100.0 * v_no_renovaron / v_vencidas_ventana, 1) else null end,
    'membresias_evaluadas', v_vencidas_ventana, 'en_riesgo', v_en_riesgo,
    'retencion_acumulada_pct', case when v_total > 0 then round(100.0 * v_recurrentes / v_total, 1) else null end);
end;
$$;
revoke all on function public.kpi_retencion(uuid) from public;
grant execute on function public.kpi_retencion(uuid) to authenticated;

create or replace function public.kpi_tendencia__interno(p_tenant_id uuid, p_granularidad text default 'semana')
returns table(periodo date, total_reservas bigint)
language sql stable security definer
set search_path to 'public'
as $$
  select date_trunc(case p_granularidad when 'dia' then 'day' when 'mes' then 'month' else 'week' end, created_at)::date, count(*)
  from public.reservas
  where tenant_id = p_tenant_id and estado = 'confirmada'
    and created_at >= now() - (case p_granularidad when 'dia' then interval '30 days' when 'mes' then interval '12 months' else interval '8 weeks' end)
  group by 1 order by 1;
$$;
revoke all on function public.kpi_tendencia__interno(uuid, text) from public;

create or replace function public.kpi_tendencia(p_tenant_id uuid, p_granularidad text default 'semana')
returns table(periodo date, total_reservas bigint)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then raise exception 'No autorizado'; end if;
  return query select * from public.kpi_tendencia__interno(p_tenant_id, p_granularidad);
end;
$$;
revoke all on function public.kpi_tendencia(uuid, text) from public;
grant execute on function public.kpi_tendencia(uuid, text) to authenticated;

create or replace function public.actividad_reciente_staff(p_tenant_id uuid, p_dias integer default 30)
returns table(id uuid, actor_nombre text, tabla text, operacion text, registro_id text, detalle jsonb, created_at timestamptz)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then return; end if;
  return query
  select l.id, l.actor_nombre, l.tabla, l.operacion, l.registro_id, l.detalle, l.created_at
  from public.admin_acciones_log l where l.tenant_id = p_tenant_id and l.created_at >= now() - (p_dias || ' days')::interval
  order by l.created_at desc limit 500;
end;
$$;
revoke all on function public.actividad_reciente_staff(uuid, integer) from public;
grant execute on function public.actividad_reciente_staff(uuid, integer) to authenticated;

create or replace function public.clientas_consentimiento_pendiente(p_tenant_id uuid)
returns table(id uuid, nombre text, email text, telefono text, created_at timestamptz)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then return; end if;
  return query select c.id, c.nombre, c.email, c.telefono, c.created_at from public.clientes c
    where c.tenant_id = p_tenant_id and c.user_id is not null and c.consentimiento_completado_at is null order by c.created_at desc;
end;
$$;
revoke all on function public.clientas_consentimiento_pendiente(uuid) from public;
grant execute on function public.clientas_consentimiento_pendiente(uuid) to authenticated;

-- Sin chequeo de rol a propósito (igual que Forma): la ejecuta el backend/cron con service_role para
-- disparar el recordatorio, no un usuario navegando el panel.
create or replace function public.clientas_para_recordatorio_password(p_tenant_id uuid, p_horas integer default 24)
returns table(id uuid, nombre text, email text, telefono text, created_at timestamptz)
language sql stable security definer
set search_path to 'public'
as $$
  select c.id, c.nombre, c.email, c.telefono, c.created_at
  from public.clientes c join auth.users u on u.id = c.user_id
  where c.tenant_id = p_tenant_id and c.user_id is not null
    and (u.encrypted_password is null or u.encrypted_password = '')
    and not exists (select 1 from auth.identities i where i.user_id = c.user_id and i.provider <> 'email')
    and c.recordatorio_password_enviado_at is null and c.created_at <= now() - (p_horas || ' hours')::interval
  order by c.created_at desc;
$$;
revoke all on function public.clientas_para_recordatorio_password(uuid, integer) from public;
grant execute on function public.clientas_para_recordatorio_password(uuid, integer) to service_role;

create or replace function public.clientas_prueba_seguimiento(p_tenant_id uuid)
returns table(reserva_id uuid, cliente_id uuid, cliente_nombre text, cliente_telefono text, cliente_email text,
  resultado text, fecha date, hora_inicio time, reservo_de_nuevo boolean, nueva_fecha date, nueva_hora time)
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_hoy date := public.hoy_en_sede(null);
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then return; end if;
  return query
  select r.id, r.cliente_id, c.nombre, c.telefono, c.email,
    case when r.estado = 'cancelada' then 'Canceló' else 'No asistió' end, r.fecha, h.hora_inicio,
    r2n.id is not null, r2n.fecha, h2n.hora_inicio
  from public.reservas r
  join public.clientes c on c.id = r.cliente_id
  join public.horarios h on h.id = r.horario_id
  left join lateral (select r2.* from public.reservas r2 where r2.cliente_id = r.cliente_id and r2.estado = 'confirmada' and r2.id <> r.id order by r2.fecha asc, r2.created_at asc limit 1) r2n on true
  left join public.horarios h2n on h2n.id = r2n.horario_id
  where r.tenant_id = p_tenant_id and r.tipo = 'prueba'
    and (r.estado = 'cancelada' or (r.estado = 'confirmada' and r.fecha < v_hoy and coalesce(r.asistio, false) = false))
  order by r.fecha desc, h.hora_inicio;
end;
$$;
revoke all on function public.clientas_prueba_seguimiento(uuid) from public;
grant execute on function public.clientas_prueba_seguimiento(uuid) to authenticated;

create or replace function public.clientas_riesgo_fuga(p_tenant_id uuid, p_dias integer default 14)
returns table(cliente_id uuid, nombre text, email text, telefono text, ultima_clase date, dias_sin_reservar integer, tiene_membresia_activa boolean)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then return; end if;
  return query
  with ultima as (
    select r.cliente_id, max(r.fecha) as ultima_clase from public.reservas r
    where r.tenant_id = p_tenant_id and r.estado = 'confirmada' and r.tipo = 'regular' and r.fecha < public.hoy_en_sede(r.sede_id)
    group by r.cliente_id
  )
  select c.id, c.nombre, c.email, c.telefono, u.ultima_clase, (public.hoy_en_sede(null) - u.ultima_clase)::int,
    exists (select 1 from public.membresias m where m.cliente_id = c.id and m.estado = 'activa' and m.congelada_desde is null
      and m.fecha_vencimiento >= public.hoy_en_sede(null) and (m.clases_totales is null or m.clases_usadas < m.clases_totales))
  from ultima u join public.clientes c on c.id = u.cliente_id
  where u.ultima_clase < public.hoy_en_sede(null) - p_dias
    and not exists (select 1 from public.reservas r2 where r2.cliente_id = c.id and r2.estado = 'confirmada' and r2.fecha >= public.hoy_en_sede(null))
  order by u.ultima_clase asc;
end;
$$;
revoke all on function public.clientas_riesgo_fuga(uuid, integer) from public;
grant execute on function public.clientas_riesgo_fuga(uuid, integer) to authenticated;

create or replace function public.clientas_sin_password(p_tenant_id uuid)
returns table(id uuid, nombre text, email text, telefono text, created_at timestamptz)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then return; end if;
  return query
  select c.id, c.nombre, c.email, c.telefono, c.created_at
  from public.clientes c join auth.users u on u.id = c.user_id
  where c.tenant_id = p_tenant_id and c.user_id is not null
    and (u.encrypted_password is null or u.encrypted_password = '')
    and not exists (select 1 from auth.identities i where i.user_id = c.user_id and i.provider <> 'email')
  order by c.created_at desc;
end;
$$;
revoke all on function public.clientas_sin_password(uuid) from public;
grant execute on function public.clientas_sin_password(uuid) to authenticated;

create or replace function public.clientas_vencidas_sin_renovar(p_tenant_id uuid)
returns table(cliente_id uuid, nombre text, telefono text, email text, paquete_nombre text, fecha_vencimiento date, dias_vencida integer)
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_hoy date := public.hoy_en_sede(null);
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then return; end if;
  return query
  with ultima as (
    select distinct on (m.cliente_id) m.cliente_id, m.fecha_vencimiento, p.nombre as paquete_nombre
    from public.membresias m join public.paquetes p on p.id = m.paquete_id
    where m.tenant_id = p_tenant_id and m.pagada = true and m.estado in ('activa', 'vencida') and m.fecha_vencimiento is not null
    order by m.cliente_id, m.fecha_vencimiento desc
  )
  select c.id, c.nombre, c.telefono, c.email, u.paquete_nombre, u.fecha_vencimiento, (v_hoy - u.fecha_vencimiento)::int
  from ultima u join public.clientes c on c.id = u.cliente_id where u.fecha_vencimiento < v_hoy order by u.fecha_vencimiento asc;
end;
$$;
revoke all on function public.clientas_vencidas_sin_renovar(uuid) from public;
grant execute on function public.clientas_vencidas_sin_renovar(uuid) to authenticated;

create or replace function public.cuentas_sin_actividad(p_tenant_id uuid)
returns table(id uuid, nombre text, email text, telefono text, created_at timestamptz)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then return; end if;
  return query
  select c.id, c.nombre, c.email, c.telefono, c.created_at from public.clientes c
  where c.tenant_id = p_tenant_id and c.user_id is not null
    and not exists (select 1 from public.reservas r where r.cliente_id = c.id) and not exists (select 1 from public.membresias m where m.cliente_id = c.id)
  order by c.created_at desc;
end;
$$;
revoke all on function public.cuentas_sin_actividad(uuid) from public;
grant execute on function public.cuentas_sin_actividad(uuid) to authenticated;

create or replace function public.ranking_clientas_valor(p_tenant_id uuid, p_limite integer default 50)
returns table(cliente_id uuid, nombre text, telefono text, email text, total_gastado numeric, primera_compra date, ultima_compra date, transacciones integer)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then return; end if;
  return query
  with membresias_cli as (
    select m.cliente_id, coalesce(m.precio_final, pq.precio, 0) as monto, m.confirmado_at::date as fecha
    from public.membresias m join public.paquetes pq on pq.id = m.paquete_id
    where m.tenant_id = p_tenant_id and m.estado in ('activa', 'vencida') and m.pagada = true and m.confirmado_at is not null
  ),
  privadas_cli as (select cliente_id, precio as monto, confirmado_at::date as fecha from public.horario_fechas_privadas_personas where tenant_id = p_tenant_id and pagada = true and confirmado_at is not null),
  pedidos_cli as (select cliente_id, total as monto, pagado_at::date as fecha from public.pedidos where tenant_id = p_tenant_id and estado in ('pagado', 'entregado') and pagado_at is not null and cliente_id is not null),
  todo as (select * from membresias_cli union all select * from privadas_cli union all select * from pedidos_cli)
  select c.id, c.nombre, c.telefono, c.email, sum(t.monto), min(t.fecha), max(t.fecha), count(*)::int
  from todo t join public.clientes c on c.id = t.cliente_id
  group by c.id, c.nombre, c.telefono, c.email order by sum(t.monto) desc limit p_limite;
end;
$$;
revoke all on function public.ranking_clientas_valor(uuid, integer) from public;
grant execute on function public.ranking_clientas_valor(uuid, integer) to authenticated;
