CREATE OR REPLACE FUNCTION public.necesita_contrasena()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sin_password boolean;
begin
  select
    (u.encrypted_password is null or u.encrypted_password = '')
    and not exists (select 1 from auth.identities i where i.user_id = auth.uid() and i.provider <> 'email')
  into v_sin_password
  from auth.users u
  where u.id = auth.uid();

  return coalesce(v_sin_password, false);
end;
$function$
