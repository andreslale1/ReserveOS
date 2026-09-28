CREATE OR REPLACE FUNCTION public.editar_dependiente(p_id uuid, p_nombre text, p_fecha_nacimiento date DEFAULT NULL::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tutor_id uuid;
begin
  select clientes.id into v_tutor_id from clientes where user_id = auth.uid();

  update clientes set nombre = trim(p_nombre), fecha_nacimiento = p_fecha_nacimiento
    where clientes.id = p_id and tutor_id = v_tutor_id;
end;
$function$
