CREATE OR REPLACE FUNCTION public.mi_lista_espera()
 RETURNS TABLE(id uuid, fecha date, hora_inicio time without time zone, nombre_clase text, cliente_id uuid, cliente_nombre text, es_propia boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_propio_id uuid;
begin
  select clientes.id into v_propio_id from clientes where user_id = auth.uid();
  if v_propio_id is null then
    return;
  end if;

  return query
  select le.id, le.fecha, h.hora_inicio, h.nombre_clase, c.id, c.nombre, (c.id = v_propio_id)
  from lista_espera le
  join horarios h on h.id = le.horario_id
  join clientes c on c.id = le.cliente_id
  where c.id = v_propio_id or c.tutor_id = v_propio_id
  order by le.fecha, h.hora_inicio;
end;
$function$
