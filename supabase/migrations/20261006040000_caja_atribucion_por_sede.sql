-- ST-06: caja y finanzas por sede.
-- Regla de atribución (documentada y única): un ingreso se atribuye a la SEDE DONDE SE COBRA (sede de venta del paquete,
-- sede de entrega del pedido, sede del cobro personalizado). Se cuenta una sola vez; que la clienta use sus clases en otra
-- sede no mueve el ingreso. El consolidado es la suma de las sedes y se verifica contra un total calculado por separado.

-- Corrección: las clases privadas se sumaban a TODAS las sedes del estudio. Ahora solo a la sede de la clase.
-- Además se permite cerrar la caja de días pasados (antes solo "hoy").
create or replace function public.caja_esperado_del_dia__interno(p_tenant_id uuid, p_sede_id uuid, p_fecha date)
returns table(metodo_pago text, monto numeric)
language sql stable security definer set search_path to 'public' as $$
  with membresias_dia as (
    select m.metodo_pago, coalesce(m.precio_final, pq.precio, 0) as monto
    from public.membresias m join public.paquetes pq on pq.id = m.paquete_id
    where m.tenant_id = p_tenant_id and m.sede_venta_id = p_sede_id and m.estado = 'activa' and m.pagada = true
      and m.confirmado_at is not null and m.metodo_pago <> 'pasarela'
      and p_fecha <= public.hoy_en_sede(p_sede_id) and (m.confirmado_at at time zone (select timezone from public.sedes where id = p_sede_id))::date = p_fecha
  ),
  privatizaciones_dia as (
    select pp.metodo_pago, pp.precio as monto
    from public.horario_fechas_privadas_personas pp
    join public.horario_fechas_privadas fp on fp.id = pp.privatizacion_id
    join public.horarios h on h.id = fp.horario_id
    where pp.tenant_id = p_tenant_id and h.sede_id = p_sede_id and pp.pagada = true and pp.confirmado_at is not null and pp.metodo_pago <> 'pasarela'
      and (pp.confirmado_at at time zone (select timezone from public.sedes where id = p_sede_id))::date = p_fecha
  ),
  pedidos_dia as (
    select metodo_pago, total as monto from public.pedidos
    where tenant_id = p_tenant_id and sede_entrega_id = p_sede_id and estado in ('pagado', 'entregado') and pagado_at is not null
      and metodo_pago <> 'pasarela' and (pagado_at at time zone (select timezone from public.sedes where id = p_sede_id))::date = p_fecha
  ),
  cobros_personalizados_dia as (
    select metodo_pago, monto from public.cobros_personalizados
    where tenant_id = p_tenant_id and sede_id = p_sede_id and confirmado_at is not null and metodo_pago <> 'pasarela'
      and (confirmado_at at time zone (select timezone from public.sedes where id = p_sede_id))::date = p_fecha
  ),
  todo as (
    select * from membresias_dia union all select * from privatizaciones_dia
    union all select * from pedidos_dia union all select * from cobros_personalizados_dia
  )
  select metodo_pago, sum(monto) as monto from todo group by metodo_pago;
$$;

-- Ingresos y clases por sede en un período. Quien ve solo sus sedes (admin, recepción) no recibe el consolidado.
create or replace function public.finanzas_atribucion(p_tenant_id uuid, p_desde date, p_hasta date)
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_ve_todo boolean; v_filas json; v_total numeric; v_suma numeric; v_sin_sede numeric;
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','contadora','admin_sede','recepcion']) then raise exception 'No autorizado'; end if;
  v_ve_todo := public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','contadora']);

  with ventas as (   -- cada fila es un cobro confirmado, ya atribuido a una sede
    select m.sede_venta_id as sede_id, coalesce(m.precio_final, 0) as monto, 'paquete' as tipo
      from public.membresias m where m.tenant_id = p_tenant_id and m.pagada and m.estado <> 'anulada' and m.confirmado_at::date between p_desde and p_hasta
    union all
    select p.sede_entrega_id, p.total, 'tienda' from public.pedidos p
      where p.tenant_id = p_tenant_id and p.estado in ('pagado','entregado') and p.pagado_at::date between p_desde and p_hasta
    union all
    select c.sede_id, c.monto, 'otros' from public.cobros_personalizados c
      where c.tenant_id = p_tenant_id and c.confirmado_at is not null and c.confirmado_at::date between p_desde and p_hasta
  )
  select coalesce(sum(monto), 0), coalesce(sum(monto) filter (where sede_id is null), 0) into v_total, v_sin_sede from ventas;

  select coalesce(json_agg(x order by x.total desc), '[]'::json), coalesce(sum(x.total), 0) into v_filas, v_suma from (
    select s.id as sede_id, s.name as sede,
      coalesce((select sum(m.precio_final) from public.membresias m where m.tenant_id = p_tenant_id and m.sede_venta_id = s.id and m.pagada and m.estado <> 'anulada' and m.confirmado_at::date between p_desde and p_hasta), 0) as paquetes,
      coalesce((select sum(p.total) from public.pedidos p where p.tenant_id = p_tenant_id and p.sede_entrega_id = s.id and p.estado in ('pagado','entregado') and p.pagado_at::date between p_desde and p_hasta), 0) as tienda,
      coalesce((select sum(c.monto) from public.cobros_personalizados c where c.tenant_id = p_tenant_id and c.sede_id = s.id and c.confirmado_at is not null and c.confirmado_at::date between p_desde and p_hasta), 0) as otros,
      coalesce((select sum(m.precio_final) from public.membresias m where m.tenant_id = p_tenant_id and m.sede_venta_id = s.id and m.pagada and m.estado <> 'anulada' and m.confirmado_at::date between p_desde and p_hasta), 0)
      + coalesce((select sum(p.total) from public.pedidos p where p.tenant_id = p_tenant_id and p.sede_entrega_id = s.id and p.estado in ('pagado','entregado') and p.pagado_at::date between p_desde and p_hasta), 0)
      + coalesce((select sum(c.monto) from public.cobros_personalizados c where c.tenant_id = p_tenant_id and c.sede_id = s.id and c.confirmado_at is not null and c.confirmado_at::date between p_desde and p_hasta), 0) as total,
      (select count(*) from public.reservas r where r.tenant_id = p_tenant_id and r.sede_id = s.id and r.estado = 'confirmada' and r.fecha between p_desde and p_hasta and r.asistio is true) as clases_asistidas,
      (select count(*) from public.reservas r where r.tenant_id = p_tenant_id and r.sede_id = s.id and r.estado = 'confirmada' and r.fecha between p_desde and p_hasta) as clases_reservadas
    from public.sedes s
    where s.tenant_id = p_tenant_id and public.staff_puede_en_sede(p_tenant_id, s.id, array['duena','gerente_general','contadora','admin_sede','recepcion'])
  ) x;

  return json_build_object(
    'sedes', v_filas,
    'consolidado', case when v_ve_todo then v_total else null end,
    'suma_de_sedes', case when v_ve_todo then v_suma else null end,
    'sin_sede', case when v_ve_todo then v_sin_sede else null end,
    'cuadra', case when v_ve_todo then (abs(v_total - v_suma - v_sin_sede) < 0.01) else null end
  );
end $$;
revoke all on function public.finanzas_atribucion(uuid, date, date) from public;
grant execute on function public.finanzas_atribucion(uuid, date, date) to authenticated;
