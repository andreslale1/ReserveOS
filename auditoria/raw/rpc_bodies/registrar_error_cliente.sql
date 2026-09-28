CREATE OR REPLACE FUNCTION public.registrar_error_cliente(p_mensaje text, p_stack text DEFAULT NULL::text, p_url text DEFAULT NULL::text, p_contexto jsonb DEFAULT NULL::jsonb, p_nivel text DEFAULT 'error'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_firma text;
  v_existente_id uuid;
  v_estaba_resuelto boolean;
begin
  if coalesce(trim(p_mensaje), '') = '' then
    return json_build_object('ok', true, 'nuevo', false);
  end if;
  v_firma := md5(left(coalesce(p_mensaje, ''), 500) || '|' || left(coalesce(p_stack, ''), 300));

  select id, resuelto into v_existente_id, v_estaba_resuelto from error_logs
    where firma = v_firma and ultima_vez > now() - interval '7 days'
    order by ultima_vez desc limit 1;

  if v_existente_id is not null and not v_estaba_resuelto then
    update error_logs set veces = veces + 1, ultima_vez = now(), url = coalesce(p_url, url)
      where id = v_existente_id;
    return json_build_object('ok', true, 'nuevo', false);
  end if;

  if v_existente_id is not null and v_estaba_resuelto then
    update error_logs set veces = veces + 1, ultima_vez = now(), url = coalesce(p_url, url),
      resuelto = false, resuelto_por = null, resuelto_at = null
      where id = v_existente_id;
    return json_build_object('ok', true, 'nuevo', true);
  end if;

  insert into error_logs (firma, mensaje, stack, url, contexto, nivel)
    values (v_firma, left(p_mensaje, 2000), left(p_stack, 4000), left(p_url, 500), p_contexto, coalesce(p_nivel, 'error'));

  return json_build_object('ok', true, 'nuevo', true);
end;
$function$
