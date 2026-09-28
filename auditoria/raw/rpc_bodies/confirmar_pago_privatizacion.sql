CREATE OR REPLACE FUNCTION public.confirmar_pago_privatizacion(p_horario_id uuid, p_fecha date, p_cliente_id uuid)
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
    raise exception 'No se encontró esa privatización.';
  end if;

  update horario_fechas_privadas_personas
    set pagada = true, confirmado_at = now(), confirmado_por = auth.uid()
    where privatizacion_id = v_privatizacion_id and cliente_id = p_cliente_id;

  if not found then
    raise exception 'Esa clienta no está agregada a esta fecha privatizada.';
  end if;

  return json_build_object('ok', true);
end;
$function$
