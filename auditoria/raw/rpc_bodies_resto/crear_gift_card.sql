CREATE OR REPLACE FUNCTION public.crear_gift_card(p_paquete_id uuid, p_comprador_nombre text, p_destinatario_nombre text, p_destinatario_email text, p_metodo_pago text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_codigo text;
  v_id uuid;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol in ('duena', 'empleada')) then
    raise exception 'No autorizado';
  end if;

  if p_metodo_pago is not null and p_metodo_pago not in ('tarjeta', 'efectivo') then
    raise exception 'Método de pago no válido';
  end if;

  loop
    v_codigo := 'FORMA-' || upper(substr(md5(random()::text), 1, 6));
    exit when not exists (select 1 from gift_cards where codigo = v_codigo);
  end loop;

  insert into gift_cards (codigo, paquete_id, comprador_nombre, destinatario_nombre, destinatario_email, metodo_pago, created_by)
    values (v_codigo, p_paquete_id, p_comprador_nombre, p_destinatario_nombre, p_destinatario_email, p_metodo_pago, auth.uid())
    returning id into v_id;

  return json_build_object('ok', true, 'id', v_id, 'codigo', v_codigo);
end;
$function$
