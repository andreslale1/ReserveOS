CREATE OR REPLACE FUNCTION public.reservas_liberadas_no_confirmar(p_dias integer DEFAULT 30)
 RETURNS TABLE(reserva_id uuid, nombre text, telefono text, email text, nombre_clase text, fecha date, hora_inicio time without time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol in ('duena', 'empleada')) then
    return;
  end if;

  return query
  select r.id, c.nombre, c.telefono, c.email, h.nombre_clase, r.fecha, h.hora_inicio
  from reservas r
  join clientes c on c.id = r.cliente_id
  join horarios h on h.id = r.horario_id
  where r.liberada_por_no_confirmar = true
    and r.fecha >= ((now() - interval '6 hours')::date) - p_dias
  order by r.fecha desc, h.hora_inicio desc;
end;
$function$
