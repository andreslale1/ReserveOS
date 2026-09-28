CREATE OR REPLACE FUNCTION public.caja_esperado_del_dia(p_fecha date)
 RETURNS TABLE(metodo_pago text, monto numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles where id = auth.uid()) then
    raise exception 'No autorizado';
  end if;
  return query select * from public.caja_esperado_del_dia__interno(p_fecha);
end;
$function$
