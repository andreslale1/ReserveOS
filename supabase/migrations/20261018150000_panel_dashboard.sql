-- Datos para las gráficas del Resumen del panel (solo agregados: no devuelve nombres de clientas).
create or replace function public.panel_dashboard(p_tenant_id uuid, p_dias integer default 30, p_sede_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_roles text[] := array['duena','gerente_general','gerente_regional','admin_sede','contadora'];
  v_fin boolean := public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','gerente_regional','contadora','admin_sede']);
  v_hoy date := public.hoy_gt();
  v_dias integer := least(greatest(coalesce(p_dias, 30), 7), 120);
  v_desde date; v_prev_desde date;
  v_sedes uuid[];
  v_out jsonb;
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, v_roles) then raise exception 'No autorizado'; end if;
  v_desde := v_hoy - (v_dias - 1);
  v_prev_desde := v_desde - v_dias;
  select array_agg(s.id) into v_sedes from public.sedes s
   where s.tenant_id = p_tenant_id and (p_sede_id is null or s.id = p_sede_id)
     and public.staff_puede_en_sede(p_tenant_id, s.id, v_roles);
  if v_sedes is null then v_sedes := '{}'; end if;

  with r as (
    select x.fecha, x.estado, x.asistio, x.recurso_id, x.horario_id from public.reservas x
     where x.tenant_id = p_tenant_id and x.sede_id = any(v_sedes) and x.fecha between v_prev_desde and v_hoy),
  actual as (select * from r where fecha >= v_desde),
  previo as (select * from r where fecha < v_desde)
  select jsonb_build_object(
    'dias', v_dias, 'desde', v_desde, 'hasta', v_hoy,
    'finanzas', v_fin,
    'totales', jsonb_build_object(
      'reservas', (select count(*) from actual where estado = 'confirmada'),
      'reservas_prev', (select count(*) from previo where estado = 'confirmada'),
      'canceladas', (select count(*) from actual where estado = 'cancelada'),
      'asistidas', (select count(*) from actual where asistio is true),
      'con_asistencia_marcada', (select count(*) from actual where estado = 'confirmada' and fecha < v_hoy and asistio is not null),
      'nuevos', (select count(*) from public.clientes c where c.tenant_id = p_tenant_id and (c.created_at at time zone 'America/Guatemala')::date >= v_desde),
      'nuevos_prev', (select count(*) from public.clientes c where c.tenant_id = p_tenant_id and (c.created_at at time zone 'America/Guatemala')::date between v_prev_desde and v_desde - 1)
    ),
    'por_dia', (select coalesce(jsonb_agg(jsonb_build_object('fecha', g.d,
        'reservas', (select count(*) from actual a where a.fecha = g.d and a.estado = 'confirmada'),
        'canceladas', (select count(*) from actual a where a.fecha = g.d and a.estado = 'cancelada')) order by g.d), '[]'::jsonb)
      from (select x::date d from generate_series(v_desde, v_hoy, interval '1 day') x) g),
    'calor', (select coalesce(jsonb_agg(jsonb_build_object('dow', q.dow, 'hora', q.hora, 'n', q.n)), '[]'::jsonb)
      from (select extract(dow from a.fecha)::int dow, extract(hour from h.hora_inicio)::int hora, count(*) n
              from actual a join public.horarios h on h.id = a.horario_id where a.estado = 'confirmada' group by 1, 2) q),
    'clases', (select coalesce(jsonb_agg(w order by (w->>'pct')::numeric desc), '[]'::jsonb) from (
        select jsonb_build_object('nombre', h.nombre_clase, 'dia', h.dia_semana, 'hora', to_char(h.hora_inicio, 'HH24:MI'),
                 'reservas', count(a.*), 'lugares', h.cupo_maximo * greatest(
                    (select count(*) from (select x::date d from generate_series(v_desde, v_hoy, interval '1 day') x) g where extract(dow from g.d)::int = h.dia_semana), 1),
                 'pct', round(100.0 * count(a.*) / nullif(h.cupo_maximo * greatest(
                    (select count(*) from (select x::date d from generate_series(v_desde, v_hoy, interval '1 day') x) g where extract(dow from g.d)::int = h.dia_semana), 1), 0))) w
          from public.horarios h left join actual a on a.horario_id = h.id and a.estado = 'confirmada'
         where h.tenant_id = p_tenant_id and h.sede_id = any(v_sedes) and h.activo and h.fecha_especifica is null
         group by h.id order by count(a.*) desc limit 8) t),
    'carriles', (select coalesce(jsonb_agg(jsonb_build_object('nombre', z.nombre, 'n', z.n) order by z.orden), '[]'::jsonb)
      from (select rc.nombre, rc.orden, count(a.*) n from public.recursos rc left join actual a on a.recurso_id = rc.id and a.estado = 'confirmada'
             where rc.tenant_id = p_tenant_id and rc.sede_id = any(v_sedes) and rc.activo group by rc.id, rc.nombre, rc.orden) z),
    'semanas', (select coalesce(jsonb_agg(jsonb_build_object('desde', s.d,
        'ingreso', case when v_fin then coalesce((public._ingreso_confirmado(p_tenant_id, s.d, least(s.d + 6, v_hoy), v_sedes)->>'neto')::numeric, 0) else null end,
        'nuevos', (select count(*) from public.clientes c where c.tenant_id = p_tenant_id and (c.created_at at time zone 'America/Guatemala')::date between s.d and least(s.d + 6, v_hoy))) order by s.d), '[]'::jsonb)
      from (select x::date d from generate_series(v_desde, v_hoy, interval '7 days') x) s)
  ) into v_out;
  return v_out;
end $$;
revoke all on function public.panel_dashboard(uuid, integer, uuid) from public, anon;
grant execute on function public.panel_dashboard(uuid, integer, uuid) to authenticated;
