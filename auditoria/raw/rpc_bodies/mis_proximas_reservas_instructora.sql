CREATE OR REPLACE FUNCTION public.mis_proximas_reservas_instructora()
 RETURNS TABLE(id uuid, fecha date, horario_id uuid, cliente_nombre text, cuidados_especiales text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'instructora') then
    return;
  end if;

  return query
  select r.id, r.fecha, r.horario_id, c.nombre, c.cuidados_especiales
  from reservas r
  join horarios h on h.id = r.horario_id
  join clientes c on c.id = r.cliente_id
  where h.instructor_id = auth.uid()
    and r.estado = 'confirmada'
    and r.fecha >= ((now() - interval '6 hours')::date)
  order by r.fecha asc;
end;
$function$
