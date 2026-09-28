CREATE OR REPLACE FUNCTION public.confirmar_pedido_efectivo(p_pedido_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    raise exception 'Solo la dueña puede confirmar un cobro';
  end if;
  return _procesar_pedido_pagado(p_pedido_id);
end;
$function$
