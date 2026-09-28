CREATE OR REPLACE FUNCTION public.agregar_dependiente(p_nombre text, p_fecha_nacimiento date DEFAULT NULL::date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tutor_id uuid;
  v_tutor_telefono text;
  v_nuevo_id uuid;
begin
  select clientes.id, clientes.telefono into v_tutor_id, v_tutor_telefono from clientes where user_id = auth.uid();
  if v_tutor_id is null then
    raise exception 'Completa tu perfil antes de agregar un familiar';
  end if;

  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'Ingresa el nombre';
  end if;

  insert into clientes (nombre, telefono, tutor_id, es_menor, fecha_nacimiento)
    values (trim(p_nombre), v_tutor_telefono, v_tutor_id, true, p_fecha_nacimiento)
    returning clientes.id into v_nuevo_id;

  update clientes set es_cuenta_familiar = true where clientes.id = v_tutor_id;

  return json_build_object('ok', true, 'id', v_nuevo_id);
end;
$function$
