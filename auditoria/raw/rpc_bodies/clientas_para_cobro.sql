CREATE OR REPLACE FUNCTION public.clientas_para_cobro()
 RETURNS TABLE(id uuid, nombre text, telefono text, email text, nombre_tutor text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return;
  end if;

  -- Incluye dependientes (igual que "Clientes") — un paquete se puede
  -- asignar directo a un familiar, no solo a la cuenta principal.
  return query
  select c.id, c.nombre, c.telefono, c.email, t.nombre as nombre_tutor
  from clientes c
  left join clientes t on t.id = c.tutor_id
  order by c.nombre asc;
end;
$function$
