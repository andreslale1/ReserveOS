CREATE OR REPLACE FUNCTION public._codigo_valido_generico(p_codigo text, OUT v_descuento_pct integer, OUT v_codigo_id uuid, OUT v_aplica_a text)
 RETURNS record
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_codigo record;
begin
  v_descuento_pct := 0;
  v_codigo_id := null;
  v_aplica_a := null;

  if p_codigo is null or trim(p_codigo) = '' then
    return;
  end if;

  select * into v_codigo from codigos_descuento
    where codigo = upper(trim(p_codigo)) and activo = true
      and (vigente_hasta is null or vigente_hasta >= ((now() - interval '6 hours')::date))
      and (usos_maximos is null or usos_actuales < usos_maximos);

  if v_codigo is null then
    raise exception 'Código de descuento no válido o vencido';
  end if;

  v_descuento_pct := v_codigo.descuento_pct;
  v_codigo_id := v_codigo.id;
  v_aplica_a := v_codigo.aplica_a;
end;
$function$
