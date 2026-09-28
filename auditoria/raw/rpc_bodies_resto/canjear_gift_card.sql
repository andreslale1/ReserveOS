CREATE OR REPLACE FUNCTION public.canjear_gift_card(p_codigo text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cliente_id uuid;
  v_gift record;
  v_paquete record;
  v_membresia_id uuid;
begin
  select id into v_cliente_id from clientes where user_id = auth.uid();
  if v_cliente_id is null then
    raise exception 'Primero completa tu registro';
  end if;

  select * into v_gift from gift_cards where codigo = upper(trim(p_codigo)) and estado = 'activa';
  if v_gift is null then
    raise exception 'Código no válido o ya canjeado';
  end if;

  select num_clases, vigencia_dias into v_paquete from paquetes where id = v_gift.paquete_id;

  insert into membresias (cliente_id, paquete_id, clases_totales, clases_usadas, fecha_inicio, fecha_vencimiento, estado, metodo_pago, pagada, origen)
    values (v_cliente_id, v_gift.paquete_id, v_paquete.num_clases, 0, ((now() - interval '6 hours')::date), ((now() - interval '6 hours')::date) + v_paquete.vigencia_dias, 'activa', 'transferencia', true, 'gift_card')
    returning id into v_membresia_id;

  update gift_cards set estado = 'canjeada', canjeada_por = v_cliente_id, canjeada_at = now() where id = v_gift.id;

  return json_build_object('ok', true, 'membresia_id', v_membresia_id);
end;
$function$
