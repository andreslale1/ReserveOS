CREATE OR REPLACE FUNCTION public.necesita_password_por_email(p_email text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from clientes c
    join auth.users u on u.id = c.user_id
    where lower(c.email) = lower(trim(p_email))
      and (u.encrypted_password is null or u.encrypted_password = '')
      and not exists (select 1 from auth.identities i where i.user_id = c.user_id and i.provider <> 'email')
  );
$function$
