CREATE OR REPLACE FUNCTION public.confirmar_mi_reserva(p_reserva_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_propio_id uuid;
begin
  select id into v_propio_id from clientes where user_id = auth.uid();

  update reservas set confirmada_por_clienta_at = now()
    where id = p_reserva_id
      and (cliente_id = v_propio_id or cliente_id in (select id from clientes where tutor_id = v_propio_id))
      and estado = 'confirmada';

  if not found then
    raise exception 'Reserva no encontrada';
  end if;

  return json_build_object('ok', true);
end;
$function$
