CREATE OR REPLACE FUNCTION public._validar_codigo_descuento(p_codigo text, p_paquete_id uuid, OUT v_descuento_pct integer, OUT v_codigo_id uuid)
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

  if exists (select 1 from codigos_descuento_paquetes where codigo_id = v_codigo.id)
     and not exists (select 1 from codigos_descuento_paquetes where codigo_id = v_codigo.id and paquete_id = p_paquete_id) then
    raise exception 'Este código no aplica para el paquete seleccionado';
  end if;

  v_descuento_pct := v_codigo.descuento_pct;
  v_codigo_id := v_codigo.id;
end;
$function$
