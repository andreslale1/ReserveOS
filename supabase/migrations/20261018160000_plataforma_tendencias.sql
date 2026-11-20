-- Tendencias de la plataforma para las gráficas de Dirección. Cada rol recibe solo su parte; sin datos personales.
create or replace function public.plataforma_tendencias()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_fin boolean := public._plat_ok(array['finanzas']);
  v_ven boolean := public._plat_ok(array['ventas']);
  v_hoy date := public.hoy_gt();
  v_mes0 date := date_trunc('month', public.hoy_gt())::date;
  v_out jsonb;
begin
  if not public._plat_ok(array['finanzas','ventas','soporte','implementacion','ingenieria','marketing','auditor']) then raise exception 'No autorizado'; end if;
  select jsonb_build_object(
    'finanzas', v_fin, 'ventas', v_ven,
    'mrr', case when v_fin then (select coalesce(sum(precio_mensual), 0) from public.plataforma_suscripciones where estado = 'activa') end,
    'cobros', case when v_fin then (select coalesce(jsonb_agg(jsonb_build_object('mes', m.d,
        'cobrado', (select coalesce(sum(c.monto), 0) from public.plataforma_cobros c where c.estado = 'pagado' and date_trunc('month', c.fecha_pago)::date = m.d),
        'por_cobrar', (select coalesce(sum(c.monto), 0) from public.plataforma_cobros c where c.estado = 'pendiente' and date_trunc('month', c.fecha_vencimiento)::date = m.d)) order by m.d), '[]'::jsonb)
      from (select (v_mes0 - (g || ' month')::interval)::date d from generate_series(0, 5) g) m) end,
    'estudios', (select coalesce(jsonb_agg(jsonb_build_object('mes', m.d,
        'nuevos', (select count(*) from public.tenants t where date_trunc('month', t.created_at at time zone 'America/Guatemala')::date = m.d and t.tipo = 'cliente'),
        'activos', (select count(*) from public.tenants t where t.status = 'activo' and t.tipo = 'cliente' and (t.created_at at time zone 'America/Guatemala')::date < (m.d + interval '1 month')::date)) order by m.d), '[]'::jsonb)
      from (select (v_mes0 - (g || ' month')::interval)::date d from generate_series(0, 5) g) m),
    'pipeline', case when v_ven then (select coalesce(jsonb_agg(jsonb_build_object('etapa', e.etapa, 'n', e.n, 'valor', e.valor)), '[]'::jsonb)
      from (select l.etapa, count(*) n, coalesce(sum(l.valor_mensual), 0) valor from public.plataforma_leads l group by l.etapa) e) end,
    'actividad', (select coalesce(jsonb_agg(jsonb_build_object('desde', s.d,
        'reservas', (select count(*) from public.reservas r join public.tenants t on t.id = r.tenant_id
                      where r.estado = 'confirmada' and t.tipo = 'cliente' and r.fecha between s.d and least(s.d + 6, v_hoy))) order by s.d), '[]'::jsonb)
      from (select (v_hoy - 7 * g - 6)::date d from generate_series(0, 7) g) s)
  ) into v_out;
  return v_out;
end $$;
revoke all on function public.plataforma_tendencias() from public, anon;
grant execute on function public.plataforma_tendencias() to authenticated;
