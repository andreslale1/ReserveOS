CREATE OR REPLACE FUNCTION public.total_cobrado_hoy()
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_total numeric := 0;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return 0;
  end if;

  select coalesce(sum(monto), 0) into v_total
  from caja_esperado_del_dia((now() - interval '6 hours')::date);

  return v_total;
end;
$function$
