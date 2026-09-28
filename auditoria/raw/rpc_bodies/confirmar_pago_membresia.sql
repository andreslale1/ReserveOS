CREATE OR REPLACE FUNCTION public.confirmar_pago_membresia(p_membresia_id uuid, p_descuento_pct numeric DEFAULT NULL::numeric)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_es_staff boolean;
  v_paquete record;
  v_membresia record;
  v_precio_final numeric;
  v_descuento numeric;
begin
  select exists(select 1 from perfiles where id = auth.uid() and rol in ('duena', 'empleada')) into v_es_staff;
  if not v_es_staff then
    raise exception 'No autorizado';
  end if;

  select m.cliente_id, m.paquete_id, m.descuento_pct into v_membresia
    from membresias m where m.id = p_membresia_id;

  if v_membresia is null then
    raise exception 'Membresía no encontrada';
  end if;

  select p.num_clases, p.vigencia_dias, p.precio into v_paquete
    from paquetes p where p.id = v_membresia.paquete_id;

  v_descuento := coalesce(p_descuento_pct, v_membresia.descuento_pct, 0);
  v_precio_final := round(v_paquete.precio * (1 - v_descuento / 100.0), 2);

  update membresias set
    estado = 'activa',
    clases_totales = v_paquete.num_clases,
    fecha_inicio = ((now() - interval '6 hours')::date),
    fecha_vencimiento = ((now() - interval '6 hours')::date) + v_paquete.vigencia_dias,
    confirmado_at = now(),
    confirmado_por = auth.uid(),
    descuento_pct = v_descuento,
    precio_final = v_precio_final,
    pagada = true
  where id = p_membresia_id;

  perform otorgar_bono_referido_si_corresponde(v_membresia.cliente_id, v_membresia.paquete_id);

  return json_build_object('ok', true, 'precio_final', v_precio_final);
end;
$function$
