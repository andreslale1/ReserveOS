CREATE OR REPLACE FUNCTION public.codigo_descuento_por_canal()
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cliente_id uuid;
  v_canal text;
  v_codigo text;
begin
  select id, como_se_entero into v_cliente_id, v_canal from clientes where user_id = auth.uid();
  if v_canal is null then
    return null;
  end if;

  select codigo into v_codigo from codigos_descuento cd
    where cd.auto_aplicar_canal = v_canal and cd.activo = true
      and (cd.vigente_hasta is null or cd.vigente_hasta >= ((now() - interval '6 hours')::date))
      and (cd.usos_maximos is null or cd.usos_actuales < cd.usos_maximos)
      and not exists (select 1 from membresias m where m.cliente_id = v_cliente_id and m.codigo_descuento_id = cd.id)
    order by cd.created_at desc
    limit 1;

  return v_codigo;
end;
$function$
