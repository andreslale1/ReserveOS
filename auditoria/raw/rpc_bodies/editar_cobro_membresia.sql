CREATE OR REPLACE FUNCTION public.editar_cobro_membresia(p_membresia_id uuid, p_codigo_descuento text DEFAULT NULL::text, p_descuento_pct_manual numeric DEFAULT NULL::numeric)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_membresia record;
  v_paquete record;
  v_descuento_pct numeric;
  v_codigo_id uuid;
  v_precio_final numeric;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    raise exception 'Solo la dueña puede editar un cobro';
  end if;

  select * into v_membresia from membresias where id = p_membresia_id;
  if v_membresia is null then
    raise exception 'Membresía no encontrada';
  end if;

  select * into v_paquete from paquetes where id = v_membresia.paquete_id;
  if v_paquete is null then
    raise exception 'Paquete no encontrado';
  end if;

  if p_codigo_descuento is not null and trim(p_codigo_descuento) <> '' then
    select v.v_descuento_pct, v.v_codigo_id into v_descuento_pct, v_codigo_id
      from _validar_codigo_descuento(p_codigo_descuento, v_membresia.paquete_id) v;
  else
    v_descuento_pct := coalesce(p_descuento_pct_manual, 0);
    v_codigo_id := null;
    if v_descuento_pct < 0 or v_descuento_pct > 100 then
      raise exception 'El descuento debe estar entre 0 y 100%%';
    end if;
  end if;

  -- Solo mueve el contador si el código realmente cambió — evita que
  -- volver a guardar el mismo código infle "usos_actuales".
  if v_codigo_id is distinct from v_membresia.codigo_descuento_id then
    if v_codigo_id is not null then
      update codigos_descuento set usos_actuales = usos_actuales + 1 where id = v_codigo_id;
    end if;
    if v_membresia.codigo_descuento_id is not null then
      update codigos_descuento set usos_actuales = greatest(usos_actuales - 1, 0) where id = v_membresia.codigo_descuento_id;
    end if;
  end if;

  v_precio_final := round(v_paquete.precio * (1 - v_descuento_pct / 100.0), 2);

  update membresias set
    descuento_pct = v_descuento_pct,
    precio_final = v_precio_final,
    codigo_descuento_id = v_codigo_id
  where id = p_membresia_id;

  return json_build_object('ok', true, 'precio_final', v_precio_final, 'descuento_pct', v_descuento_pct);
end;
$function$
