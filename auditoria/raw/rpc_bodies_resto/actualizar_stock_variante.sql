CREATE OR REPLACE FUNCTION public.actualizar_stock_variante(p_variante_id uuid, p_stock integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    raise exception 'Solo la dueña puede editar el inventario';
  end if;
  if p_stock < 0 then
    raise exception 'El stock no puede ser negativo';
  end if;

  update producto_variantes set stock = p_stock where id = p_variante_id;
  return json_build_object('ok', true);
end;
$function$
