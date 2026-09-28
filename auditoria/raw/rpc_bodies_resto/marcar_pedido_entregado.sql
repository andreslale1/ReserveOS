CREATE OR REPLACE FUNCTION public.marcar_pedido_entregado(p_pedido_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    raise exception 'Solo la dueña puede marcar un pedido como entregado';
  end if;

  update pedidos set estado = 'entregado', entregado_at = now(), entregado_por = auth.uid()
    where id = p_pedido_id and estado = 'pagado';

  return json_build_object('ok', true);
end;
$function$
