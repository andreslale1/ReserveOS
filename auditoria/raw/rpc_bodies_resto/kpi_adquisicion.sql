CREATE OR REPLACE FUNCTION public.kpi_adquisicion(p_meses integer DEFAULT 3)
 RETURNS TABLE(canal text, gasto_total numeric, clientas_nuevas bigint, cac numeric, ltv_promedio numeric, ltv_cac_ratio numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_desde date := date_trunc('month', ((now() - interval '6 hours')::date))::date - ((p_meses - 1) * interval '1 month');
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return;
  end if;

  return query
  with gasto as (
    select g.canal, sum(g.monto) as gasto_total
    from gasto_marketing g
    where g.mes >= v_desde
    group by g.canal
  ),
  nuevas as (
    select c.como_se_entero as canal, count(*) as clientas_nuevas
    from clientes c
    where c.como_se_entero is not null and c.created_at >= v_desde
    group by c.como_se_entero
  ),
  ltv as (
    select c.como_se_entero as canal, avg(pagos.monto) as ltv_promedio
    from clientes c
    join (
      select m.cliente_id, sum(coalesce(m.precio_final, p.precio, 0)) as monto
      from membresias m
      join paquetes p on p.id = m.paquete_id
      where m.pagada = true
      group by m.cliente_id
    ) pagos on pagos.cliente_id = c.id
    where c.como_se_entero is not null
    group by c.como_se_entero
  )
  select
    coalesce(g.canal, n.canal, l.canal) as canal,
    coalesce(g.gasto_total, 0) as gasto_total,
    coalesce(n.clientas_nuevas, 0) as clientas_nuevas,
    case when coalesce(n.clientas_nuevas, 0) > 0 then round(coalesce(g.gasto_total, 0) / n.clientas_nuevas, 2) else null end as cac,
    round(coalesce(l.ltv_promedio, 0), 2) as ltv_promedio,
    case
      when coalesce(n.clientas_nuevas, 0) > 0 and coalesce(g.gasto_total, 0) > 0
        then round(coalesce(l.ltv_promedio, 0) / (coalesce(g.gasto_total, 0) / n.clientas_nuevas), 2)
      else null
    end as ltv_cac_ratio
  from gasto g
  full outer join nuevas n on n.canal = g.canal
  full outer join ltv l on l.canal = coalesce(g.canal, n.canal)
  order by canal;
end;
$function$
