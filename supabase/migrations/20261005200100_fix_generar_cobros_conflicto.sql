-- Corrección: ON CONFLICT con índice parcial no resolvía el objetivo. DO NOTHING sin objetivo
-- respeta el índice único (tenant, periodo) de licencias y mantiene la idempotencia.
create or replace function public.generar_cobros_mes(p_periodo date)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_n integer; v_per date := date_trunc('month', p_periodo)::date;
begin
  if not public._plat_ok(array['finanzas']) then raise exception 'No autorizado'; end if;
  insert into public.plataforma_cobros (tenant_id, periodo, monto, fecha_vencimiento, concepto, plan_snapshot, precio_snapshot)
  select s.tenant_id, v_per, s.precio_mensual, v_per + (s.dia_cobro - 1), 'licencia', s.plan, s.precio_mensual
  from public.plataforma_suscripciones s
  where s.estado = 'activa' and s.precio_mensual > 0 and s.fecha_alta <= (v_per + interval '1 month' - interval '1 day')::date
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
