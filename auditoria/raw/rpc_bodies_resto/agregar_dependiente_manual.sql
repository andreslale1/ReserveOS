CREATE OR REPLACE FUNCTION public.agregar_dependiente_manual(p_tutor_id uuid, p_nombre text, p_fecha_nacimiento date DEFAULT NULL::date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tutor_telefono text;
  v_nuevo_id uuid;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol in ('duena', 'empleada')) then
    raise exception 'No autorizado';
  end if;

  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'Ingresa el nombre';
  end if;

  select clientes.telefono into v_tutor_telefono from clientes where clientes.id = p_tutor_id and clientes.tutor_id is null;
  if v_tutor_telefono is null then
    raise exception 'Clienta no encontrada';
  end if;

  insert into clientes (nombre, telefono, tutor_id, es_menor, fecha_nacimiento)
    values (trim(p_nombre), v_tutor_telefono, p_tutor_id, true, p_fecha_nacimiento)
    returning clientes.id into v_nuevo_id;

  update clientes set es_cuenta_familiar = true where clientes.id = p_tutor_id;

  return json_build_object('ok', true, 'id', v_nuevo_id);
end;
$function$
