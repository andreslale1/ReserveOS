CREATE OR REPLACE FUNCTION public._precio_con_descuento(p_paquete_id uuid, p_precio_catalogo numeric, p_codigo_id uuid, p_descuento_pct integer)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  v_override numeric;
begin
  if p_codigo_id is not null then
    select precio_override into v_override
      from codigos_descuento_paquetes
      where codigo_id = p_codigo_id and paquete_id = p_paquete_id;
    if v_override is not null then
      return v_override;
    end if;
  end if;

  return ceil(p_precio_catalogo * (1 - p_descuento_pct / 100.0));
end;
$function$
