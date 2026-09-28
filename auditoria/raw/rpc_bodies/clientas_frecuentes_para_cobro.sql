CREATE OR REPLACE FUNCTION public.clientas_frecuentes_para_cobro(p_limite integer DEFAULT 8)
 RETURNS TABLE(id uuid, nombre text, telefono text, email text, nombre_tutor text, veces integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return;
  end if;

  return query
  select c.id, c.nombre, c.telefono, c.email, t.nombre as nombre_tutor, count(m.id)::int as veces
  from membresias m
  join clientes c on c.id = m.cliente_id
  left join clientes t on t.id = c.tutor_id
  where m.pagada = true
  group by c.id, c.nombre, c.telefono, c.email, t.nombre
  order by count(m.id) desc, c.nombre asc
  limit p_limite;
end;
$function$
