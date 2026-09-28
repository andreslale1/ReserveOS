CREATE OR REPLACE FUNCTION public.mis_dependientes()
 RETURNS TABLE(id uuid, nombre text, fecha_nacimiento date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tutor_id uuid;
begin
  select clientes.id into v_tutor_id from clientes where user_id = auth.uid();
  if v_tutor_id is null then
    return;
  end if;

  return query
  select c.id, c.nombre, c.fecha_nacimiento
  from clientes c
  where c.tutor_id = v_tutor_id
  order by c.created_at;
end;
$function$
