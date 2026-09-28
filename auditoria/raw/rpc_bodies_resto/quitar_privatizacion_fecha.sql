CREATE OR REPLACE FUNCTION public.quitar_privatizacion_fecha(p_horario_id uuid, p_fecha date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_privatizacion_id uuid;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol in ('duena', 'empleada')) then
    raise exception 'No autorizado';
  end if;

  select id into v_privatizacion_id from horario_fechas_privadas
    where horario_id = p_horario_id and fecha = p_fecha;
  if v_privatizacion_id is null then
    raise exception 'Esa fecha no está privatizada.';
  end if;

  update reservas set estado = 'cancelada'
    where id in (select reserva_id from horario_fechas_privadas_personas where privatizacion_id = v_privatizacion_id and reserva_id is not null)
      and estado <> 'cancelada';

  delete from horario_fechas_privadas where id = v_privatizacion_id;

  return json_build_object('ok', true);
end;
$function$
