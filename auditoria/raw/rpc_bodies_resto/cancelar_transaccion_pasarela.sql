CREATE OR REPLACE FUNCTION public.cancelar_transaccion_pasarela(p_transaccion_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    raise exception 'Solo la dueña puede cancelar un pago pendiente';
  end if;

  update pago_transacciones set estado = 'cancelado', actualizado_at = now()
  where id = p_transaccion_id and estado = 'iniciado';

  return json_build_object('ok', true);
end;
$function$
