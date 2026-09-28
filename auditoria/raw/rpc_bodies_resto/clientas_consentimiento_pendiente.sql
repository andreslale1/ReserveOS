CREATE OR REPLACE FUNCTION public.clientas_consentimiento_pendiente()
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
  where c.user_id is not null
    and c.consentimiento_completado_at is null
  order by c.created_at desc;
end;
$function$
