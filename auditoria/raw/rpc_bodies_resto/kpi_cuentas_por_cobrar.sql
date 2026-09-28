CREATE OR REPLACE FUNCTION public.kpi_cuentas_por_cobrar()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_resultado json;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol in ('duena', 'contadora')) then
    return null;
  end if;

  with pendientes as (
    select c.nombre, coalesce(m.precio_final, pq.precio, 0) as monto, m.created_at, ((now() - interval '6 hours')::date) - m.created_at::date as dias
    from membresias m
    join clientes c on c.id = m.cliente_id
    left join paquetes pq on pq.id = m.paquete_id
    where m.pagada = false
    union all
    select c.nombre, pd.total as monto, pd.created_at, ((now() - interval '6 hours')::date) - pd.created_at::date as dias
    from pedidos pd
    join clientes c on c.id = pd.cliente_id
    where pd.estado = 'pendiente_pago' and pd.metodo_pago = 'efectivo'
  )
  select json_build_object(
    'total', round(coalesce(sum(monto), 0), 2),
    'bucket_0_30', round(coalesce(sum(monto) filter (where dias <= 30), 0), 2),
    'bucket_31_60', round(coalesce(sum(monto) filter (where dias between 31 and 60), 0), 2),
    'bucket_61_90', round(coalesce(sum(monto) filter (where dias between 61 and 90), 0), 2),
    'bucket_90_mas', round(coalesce(sum(monto) filter (where dias > 90), 0), 2),
    'detalle', coalesce(json_agg(json_build_object('nombre', nombre, 'monto', monto, 'dias', dias) order by dias desc), '[]'::json)
  ) into v_resultado
  from pendientes;

  return v_resultado;
end;
$function$
