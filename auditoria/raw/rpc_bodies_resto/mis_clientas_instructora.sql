CREATE OR REPLACE FUNCTION public.mis_clientas_instructora()
 RETURNS TABLE(id uuid, nombre text, cuidados_especiales text, total_clases bigint, asistidas bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'instructora') then
    return;
  end if;

  return query
  select
    c.id,
    c.nombre,
    c.cuidados_especiales,
    count(*) filter (where r.fecha < ((now() - interval '6 hours')::date)) as total_clases,
    count(*) filter (where r.fecha < ((now() - interval '6 hours')::date) and r.estado = 'confirmada') as asistidas
  from reservas r
  join horarios h on h.id = r.horario_id
  join clientes c on c.id = r.cliente_id
  where h.instructor_id = auth.uid()
  group by c.id, c.nombre, c.cuidados_especiales
  order by c.nombre;
end;
$function$
