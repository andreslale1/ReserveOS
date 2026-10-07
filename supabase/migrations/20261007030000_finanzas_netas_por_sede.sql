-- Finanzas: ingresos NETOS por sede.
-- Antes el total se calculaba con la fecha de CREACIÓN de las membresías. Ahora:
--   + cobros efectivamente confirmados en el período (paquetes pagados, tienda, cobros personalizados, gift cards)
--   − devoluciones del período: compras anuladas o reembolsadas, restadas cuando ocurren (no reescriben el pasado)
-- Cada monto se atribuye a la sede donde se cobró y se verifica que la suma de las sedes cuadre con el consolidado calculado por separado.

drop policy if exists gastos_select on public.gastos;
create policy gastos_select on public.gastos for select using (tenant_id in (select public.current_tenant_ids()) and (
  public._es_finanzas(tenant_id) or (public._es_rol_sede(tenant_id) and sede_id = any(public._mis_sedes(tenant_id)))));

create or replace function public.finanzas_atribucion(p_tenant_id uuid, p_desde date, p_hasta date)
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare v_ve_todo boolean; v_filas json; v_bruto numeric; v_dev numeric; v_sin_sede numeric; v_suma numeric;
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','contadora','admin_sede','gerente_regional','recepcion']) then raise exception 'No autorizado'; end if;
  v_ve_todo := public._es_finanzas(p_tenant_id);

  -- Consolidado independiente (no usa la lista de sedes): bruto, devoluciones y lo que no tiene sede.
  with cobros as (
    select m.sede_venta_id as sede_id, coalesce(m.precio_final, 0) as monto from public.membresias m
      where m.tenant_id = p_tenant_id and m.pagada and m.confirmado_at::date between p_desde and p_hasta
    union all select p.sede_entrega_id, p.total from public.pedidos p
      where p.tenant_id = p_tenant_id and p.estado in ('pagado','entregado') and p.pagado_at::date between p_desde and p_hasta
    union all select c.sede_id, c.monto from public.cobros_personalizados c
      where c.tenant_id = p_tenant_id and c.confirmado_at::date between p_desde and p_hasta)
  select coalesce(sum(monto), 0), coalesce(sum(monto) filter (where sede_id is null), 0) into v_bruto, v_sin_sede from cobros;
  select coalesce(sum(coalesce((select r.monto from public.reembolsos r where r.membresia_id = m.id and r.estado in ('aprobado','devuelto') limit 1), m.precio_final, 0)), 0) into v_dev
    from public.membresias m where m.tenant_id = p_tenant_id and m.pagada and m.estado = 'anulada' and m.anulada_at::date between p_desde and p_hasta;

  select coalesce(json_agg(x order by x.neto desc), '[]'::json), coalesce(sum(x.neto), 0) into v_filas, v_suma from (
    select s.id as sede_id, s.name as sede,
      paq.v as paquetes, tie.v as tienda, otr.v as otros, dev.v as devoluciones,
      paq.v + tie.v + otr.v as bruto, paq.v + tie.v + otr.v - dev.v as neto,
      (select count(*) from public.reservas r where r.tenant_id = p_tenant_id and r.sede_id = s.id and r.estado = 'confirmada' and r.fecha between p_desde and p_hasta and r.asistio is true) as clases_asistidas,
      (select count(*) from public.reservas r where r.tenant_id = p_tenant_id and r.sede_id = s.id and r.estado = 'confirmada' and r.fecha between p_desde and p_hasta) as clases_reservadas
    from public.sedes s
    cross join lateral (select coalesce(sum(m.precio_final), 0) v from public.membresias m where m.tenant_id = p_tenant_id and m.sede_venta_id = s.id and m.pagada and m.confirmado_at::date between p_desde and p_hasta) paq
    cross join lateral (select coalesce(sum(p.total), 0) v from public.pedidos p where p.tenant_id = p_tenant_id and p.sede_entrega_id = s.id and p.estado in ('pagado','entregado') and p.pagado_at::date between p_desde and p_hasta) tie
    cross join lateral (select coalesce(sum(c.monto), 0) v from public.cobros_personalizados c where c.tenant_id = p_tenant_id and c.sede_id = s.id and c.confirmado_at::date between p_desde and p_hasta) otr
    cross join lateral (select coalesce(sum(coalesce((select r.monto from public.reembolsos r where r.membresia_id = m.id and r.estado in ('aprobado','devuelto') limit 1), m.precio_final, 0)), 0) v
        from public.membresias m where m.tenant_id = p_tenant_id and m.sede_venta_id = s.id and m.pagada and m.estado = 'anulada' and m.anulada_at::date between p_desde and p_hasta) dev
    where s.tenant_id = p_tenant_id and s.id = any(public._mis_sedes(p_tenant_id))
  ) x;

  return json_build_object(
    'sedes', v_filas,
    'bruto', case when v_ve_todo then v_bruto else null end,
    'devoluciones', case when v_ve_todo then v_dev else null end,
    'consolidado', case when v_ve_todo then v_bruto - v_dev else null end,        -- neto del estudio
    'suma_de_sedes', case when v_ve_todo then v_suma else null end,
    'sin_sede', case when v_ve_todo then v_sin_sede else null end,
    'cuadra', case when v_ve_todo then (abs((v_bruto - v_dev) - v_suma - v_sin_sede) < 0.01) else null end);
end $$;
