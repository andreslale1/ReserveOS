CREATE OR REPLACE FUNCTION public.usuario_tiene_password(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from auth.users u
    where u.id = p_user_id and u.encrypted_password is not null and u.encrypted_password <> ''
  );
$function$
