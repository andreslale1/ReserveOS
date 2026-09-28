CREATE OR REPLACE FUNCTION public.kpi_reservas_lealtad()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_clientes_unicos int;
  v_total_reservas int;
  v_clientes_repiten int;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return null;
  end if;

  select count(distinct cliente_id), count(*)
    into v_clientes_unicos, v_total_reservas
    from reservas where estado = 'confirmada';

  select count(*) into v_clientes_repiten
    from (
      select cliente_id from reservas where estado = 'confirmada'
      group by cliente_id having count(*) >= 2
    ) t;

  return json_build_object(
    'clientes_unicos', v_clientes_unicos,
    'total_reservas', v_total_reservas,
    'reservas_por_cliente', case when v_clientes_unicos > 0 then round(v_total_reservas::numeric / v_clientes_unicos, 2) else null end,
    'clientes_repiten', v_clientes_repiten,
    'pct_rebooking', case when v_clientes_unicos > 0 then round(100.0 * v_clientes_repiten / v_clientes_unicos, 1) else null end
  );
end;
$function$
