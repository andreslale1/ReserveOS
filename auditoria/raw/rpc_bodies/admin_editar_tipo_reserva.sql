CREATE OR REPLACE FUNCTION public.admin_editar_tipo_reserva(p_reserva_id uuid, p_tipo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles where id = auth.uid() and rol = 'duena') then
    raise exception 'Solo la dueña puede editar el tipo de una reserva';
  end if;

  if p_tipo not in ('regular', 'prueba') then
    raise exception 'Tipo de reserva inválido';
  end if;

  update reservas set tipo = p_tipo where id = p_reserva_id;
end;
$function$
