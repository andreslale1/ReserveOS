CREATE OR REPLACE FUNCTION public.codigo_descuento_activo_para_canal(p_canal text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_codigo record;
  v_paquetes text;
begin
  if p_canal is null then
    return null;
  end if;

  select cd.id, cd.codigo, cd.descuento_pct
    into v_codigo
    from codigos_descuento cd
    where cd.auto_aplicar_canal = p_canal and cd.activo = true
      and (cd.vigente_hasta is null or cd.vigente_hasta >= ((now() - interval '6 hours')::date))
      and (cd.usos_maximos is null or cd.usos_actuales < cd.usos_maximos)
    order by cd.created_at desc
    limit 1;

  if v_codigo is null then
    return null;
  end if;

  select string_agg(p.nombre, ', ' order by p.nombre) into v_paquetes
    from codigos_descuento_paquetes cdp
    join paquetes p on p.id = cdp.paquete_id
    where cdp.codigo_id = v_codigo.id;

  return json_build_object('codigo', v_codigo.codigo, 'descuento_pct', v_codigo.descuento_pct, 'paquete_nombre', v_paquetes);
end;
$function$
