CREATE OR REPLACE FUNCTION public.admin_cancelar_reserva(p_reserva_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_reserva record;
begin
  if not exists (select 1 from perfiles where id = auth.uid() and rol = 'duena') then
    raise exception 'Solo la dueña puede cancelar reservas desde aquí';
  end if;

  select * into v_reserva from reservas where id = p_reserva_id and estado = 'confirmada';
  if v_reserva is null then
    raise exception 'Reserva no encontrada';
  end if;

  update reservas set estado = 'cancelada' where id = p_reserva_id;

  if v_reserva.tipo = 'regular' then
    perform devolver_clase_a_membresia(v_reserva.cliente_id);
  end if;

  return json_build_object('ok', true);
end;
$function$
