-- Serie mensual con la regla única de ingreso confirmado (bruto, devoluciones, neto, gastos operativos), con el alcance de quien llama.
create or replace function public.finanzas_serie_confirmada(p_tenant_id uuid, p_meses integer default 6, p_sede_id uuid default null)
returns table(mes date, bruto numeric, devoluciones numeric, neto numeric, gastos numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_rol text := public._mi_rol(p_tenant_id); v_perm uuid[]; v_sedes uuid[]; v_todas boolean; v_ini date; i int; v_d date; v_h date; v_ic jsonb;
begin
  if v_rol is null or v_rol not in ('duena','gerente_general','contadora','admin_sede','gerente_regional') then raise exception 'No autorizado'; end if;
  v_perm := case when public._es_g(p_tenant_id) or v_rol = 'contadora' then (select array_agg(id) from public.sedes where tenant_id = p_tenant_id) else public._mis_sedes(p_tenant_id) end;
  if p_sede_id is not null and not (p_sede_id = any(coalesce(v_perm,'{}'))) then raise exception 'No autorizado para esa sede'; end if;
  v_sedes := case when p_sede_id is not null then array[p_sede_id] else v_perm end;
  v_todas := p_sede_id is null and (public._es_g(p_tenant_id) or v_rol = 'contadora');
  p_meses := least(greatest(coalesce(p_meses,6),1),36);
  v_ini := (date_trunc('month', public.hoy_en_sede(null)) - make_interval(months => p_meses - 1))::date;
  for i in 0..p_meses-1 loop
    v_d := (v_ini + make_interval(months => i))::date; v_h := (v_d + interval '1 month - 1 day')::date;
    v_ic := public._ingreso_confirmado(p_tenant_id, v_d, v_h, case when v_todas then null else v_sedes end);
    mes := v_d; bruto := (v_ic->>'bruto')::numeric; devoluciones := (v_ic->>'devoluciones')::numeric; neto := (v_ic->>'neto')::numeric;
    select coalesce(sum(g.monto),0) into gastos from public.gastos g where g.etapa = 'operativo' and g.tenant_id = p_tenant_id and g.fecha between v_d and v_h and (v_todas or g.sede_id = any(v_sedes));
    return next;
  end loop;
end $$;
revoke all on function public.finanzas_serie_confirmada(uuid,integer,uuid) from public, anon;
grant execute on function public.finanzas_serie_confirmada(uuid,integer,uuid) to authenticated;
