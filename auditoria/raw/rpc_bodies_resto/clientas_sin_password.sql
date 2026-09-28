CREATE OR REPLACE FUNCTION public.clientas_sin_password()
 RETURNS TABLE(id uuid, nombre text, email text, telefono text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return;
  end if;

  return query
  select c.id, c.nombre, c.email, c.telefono, c.created_at
  from clientes c
  join auth.users u on u.id = c.user_id
  where c.user_id is not null
    and (u.encrypted_password is null or u.encrypted_password = '')
    and not exists (select 1 from auth.identities i where i.user_id = c.user_id and i.provider <> 'email')
  order by c.created_at desc;
end;
$function$
