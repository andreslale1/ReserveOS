CREATE OR REPLACE FUNCTION public.completar_consentimiento(p_contacto_emergencia text, p_cuidados_especiales text, p_objetivos text[], p_objetivo_otro text, p_experiencia_pilates text, p_consiente_responsabilidad boolean, p_consiente_cancelacion boolean, p_autoriza_imagen boolean, p_firma_nombre text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cliente_id uuid;
begin
  select id into v_cliente_id from clientes where user_id = auth.uid();
  if v_cliente_id is null then
    raise exception 'Primero completa tu registro';
  end if;

  if not p_consiente_responsabilidad or not p_consiente_cancelacion then
    raise exception 'Debes aceptar la exención de responsabilidad y la política de cancelación';
  end if;

  if coalesce(trim(p_firma_nombre), '') = '' then
    raise exception 'Escribe tu nombre completo como firma';
  end if;

  update clientes set
    contacto_emergencia = nullif(trim(p_contacto_emergencia), ''),
    cuidados_especiales = nullif(trim(p_cuidados_especiales), ''),
    objetivos = p_objetivos,
    objetivo_otro = nullif(trim(p_objetivo_otro), ''),
    experiencia_pilates = p_experiencia_pilates,
    consiente_responsabilidad = p_consiente_responsabilidad,
    consiente_cancelacion = p_consiente_cancelacion,
    autoriza_imagen = p_autoriza_imagen,
    consentimiento_firma_nombre = trim(p_firma_nombre),
    consentimiento_completado_at = now()
  where id = v_cliente_id;

  return json_build_object('ok', true);
end;
$function$
