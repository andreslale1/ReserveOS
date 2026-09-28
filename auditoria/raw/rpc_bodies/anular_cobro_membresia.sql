CREATE OR REPLACE FUNCTION public.anular_cobro_membresia(p_membresia_id uuid, p_motivo text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_membresia record;
  v_destino_id uuid;
  v_destino_totales int;
  v_destino_usadas int;
  v_movidas int := 0;
  v_otro_activo uuid;
  v_reservas_canceladas int := 0;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    raise exception 'Solo la dueña puede anular un cobro';
  end if;

  select * into v_membresia from membresias where id = p_membresia_id;
  if v_membresia is null then
    raise exception 'Cobro no encontrado';
  end if;

  if v_membresia.estado = 'anulada' then
    raise exception 'Este cobro ya estaba anulado';
  end if;

  if not v_membresia.pagada then
    raise exception 'Esto todavía no es un cobro confirmado — usa "Eliminar" en pendientes en vez de anular';
  end if;

  if v_membresia.codigo_descuento_id is not null then
    update codigos_descuento set usos_actuales = greatest(usos_actuales - 1, 0) where id = v_membresia.codigo_descuento_id;
  end if;

  update membresias set
    estado = 'anulada',
    anulada_at = now(),
    anulada_por = auth.uid(),
    anulada_motivo = p_motivo
  where id = p_membresia_id;

  if coalesce(v_membresia.clases_usadas, 0) > 0 then
    select id, clases_totales, clases_usadas into v_destino_id, v_destino_totales, v_destino_usadas from membresias
      where cliente_id = v_membresia.cliente_id and estado = 'activa' and id <> p_membresia_id
      order by created_at desc limit 1;

    if v_destino_id is not null then
      v_movidas := case when v_destino_totales is null then v_membresia.clases_usadas
                        else greatest(least(v_membresia.clases_usadas, v_destino_totales - v_destino_usadas), 0) end;
      update membresias set clases_usadas = clases_usadas + v_movidas where id = v_destino_id;
    end if;
  end if;

  select id into v_otro_activo from membresias
    where cliente_id = v_membresia.cliente_id and estado = 'activa' and id <> p_membresia_id
    limit 1;

  if v_otro_activo is null then
    with canceladas as (
      update reservas set estado = 'cancelada'
      where cliente_id = v_membresia.cliente_id
        and estado = 'confirmada'
        and tipo = 'regular'
        and fecha >= (now() - interval '6 hours')::date
      returning id
    )
    select count(*) into v_reservas_canceladas from canceladas;
  end if;

  return json_build_object(
    'ok', true,
    'clases_usadas', coalesce(v_membresia.clases_usadas, 0),
    'clases_movidas', v_movidas,
    'reservas_canceladas', v_reservas_canceladas
  );
end;
$function$
