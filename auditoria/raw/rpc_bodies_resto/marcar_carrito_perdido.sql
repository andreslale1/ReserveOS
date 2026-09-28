CREATE OR REPLACE FUNCTION public.marcar_carrito_perdido(p_carrito_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    raise exception 'Solo la dueña puede hacer esto';
  end if;
  update carritos set estado = 'abandonado', actualizado_at = now() where id = p_carrito_id and estado = 'activo';
  return json_build_object('ok', true);
end;
$function$
