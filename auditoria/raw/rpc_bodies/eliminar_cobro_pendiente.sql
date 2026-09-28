CREATE OR REPLACE FUNCTION public.eliminar_cobro_pendiente(p_membresia_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    raise exception 'Solo la dueña puede eliminar un cobro pendiente';
  end if;

  delete from membresias where id = p_membresia_id and pagada = false;

  return json_build_object('ok', true);
end;
$function$
