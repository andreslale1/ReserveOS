CREATE OR REPLACE FUNCTION public.devolver_clase_a_membresia(p_cliente_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_membresia_id uuid;
  v_tutor_familia_id uuid;
begin
  select id into v_membresia_id from membresias
    where cliente_id = p_cliente_id and estado = 'activa' and clases_usadas > 0
    order by fecha_vencimiento asc limit 1;

  if v_membresia_id is null then
    select coalesce(tutor_id, id) into v_tutor_familia_id from clientes where id = p_cliente_id;
    select m.id into v_membresia_id
      from membresias m
      join paquetes pq on pq.id = m.paquete_id
      where m.cliente_id = v_tutor_familia_id and pq.compartido_familiar = true
        and m.estado = 'activa' and m.clases_usadas > 0
      order by m.fecha_vencimiento asc limit 1;
  end if;

  if v_membresia_id is not null then
    update membresias set clases_usadas = greatest(clases_usadas - 1, 0) where id = v_membresia_id;
  end if;
end;
$function$
