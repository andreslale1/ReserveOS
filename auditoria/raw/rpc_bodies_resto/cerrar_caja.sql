CREATE OR REPLACE FUNCTION public.cerrar_caja(p_fecha date, p_efectivo_contado numeric, p_tarjeta_contado numeric, p_transferencia_contado numeric, p_notas text DEFAULT NULL::text)
 RETURNS cierre_caja
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_efectivo numeric := 0;
  v_tarjeta numeric := 0;
  v_transferencia numeric := 0;
  v_row public.cierre_caja;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    raise exception 'Solo la dueña puede cerrar caja';
  end if;

  select coalesce(sum(monto), 0) into v_efectivo from caja_esperado_del_dia(p_fecha) where metodo_pago = 'efectivo';
  select coalesce(sum(monto), 0) into v_tarjeta from caja_esperado_del_dia(p_fecha) where metodo_pago = 'tarjeta_estudio';
  select coalesce(sum(monto), 0) into v_transferencia from caja_esperado_del_dia(p_fecha) where metodo_pago = 'transferencia';

  insert into cierre_caja (fecha, efectivo_sistema, efectivo_contado, tarjeta_sistema, tarjeta_contado, transferencia_sistema, transferencia_contado, notas, cerrado_por, cerrado_at)
  values (p_fecha, v_efectivo, p_efectivo_contado, v_tarjeta, p_tarjeta_contado, v_transferencia, p_transferencia_contado, p_notas, auth.uid(), now())
  on conflict (fecha) do update set
    efectivo_sistema = excluded.efectivo_sistema,
    efectivo_contado = excluded.efectivo_contado,
    tarjeta_sistema = excluded.tarjeta_sistema,
    tarjeta_contado = excluded.tarjeta_contado,
    transferencia_sistema = excluded.transferencia_sistema,
    transferencia_contado = excluded.transferencia_contado,
    notas = excluded.notas,
    cerrado_por = excluded.cerrado_por,
    cerrado_at = now()
  returning * into v_row;

  return v_row;
end;
$function$
