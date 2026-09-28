CREATE OR REPLACE FUNCTION public.transferir_membresia(p_membresia_id uuid, p_cliente_destino_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_membresia record;
  v_raiz_origen uuid;
  v_raiz_destino uuid;
begin
  if not exists (select 1 from perfiles where id = auth.uid() and rol = 'duena') then
    raise exception 'Solo la dueña puede transferir un paquete';
  end if;

  select id, cliente_id, estado into v_membresia from membresias where id = p_membresia_id;
  if v_membresia is null then
    raise exception 'Paquete no encontrado';
  end if;
  if v_membresia.estado <> 'activa' then
    raise exception 'Solo se pueden transferir paquetes activos';
  end if;
  if v_membresia.cliente_id = p_cliente_destino_id then
    raise exception 'Ese paquete ya es de esa persona';
  end if;

  if not exists (select 1 from clientes where id = p_cliente_destino_id) then
    raise exception 'Persona destino no encontrada';
  end if;

  select coalesce(tutor_id, id) into v_raiz_origen from clientes where id = v_membresia.cliente_id;
  select coalesce(tutor_id, id) into v_raiz_destino from clientes where id = p_cliente_destino_id;
  if v_raiz_origen is distinct from v_raiz_destino then
    raise exception 'Solo puedes transferir paquetes entre miembros de la misma familia';
  end if;

  update membresias set
    transferida_de_id = v_membresia.cliente_id,
    transferida_at = now(),
    transferida_por = auth.uid(),
    cliente_id = p_cliente_destino_id
  where id = p_membresia_id;

  return json_build_object('ok', true);
end;
$function$
