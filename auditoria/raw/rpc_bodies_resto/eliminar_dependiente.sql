CREATE OR REPLACE FUNCTION public.eliminar_dependiente(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tutor_id uuid;
begin
  select clientes.id into v_tutor_id from clientes where user_id = auth.uid();

  if exists (select 1 from reservas where cliente_id = p_id) or exists (select 1 from membresias where cliente_id = p_id) then
    raise exception 'Esta persona ya tiene reservas o paquetes registrados — contacta al estudio para eliminarla.';
  end if;

  delete from clientes where clientes.id = p_id and tutor_id = v_tutor_id;
end;
$function$
