CREATE OR REPLACE FUNCTION public.codigos_activos_por_paquete()
 RETURNS TABLE(id uuid, codigo text, descuento_pct integer, paquete_ids uuid[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return;
  end if;

  return query
  select
    cd.id, cd.codigo, cd.descuento_pct,
    coalesce(array_agg(cdp.paquete_id) filter (where cdp.paquete_id is not null), '{}')
  from codigos_descuento cd
  left join codigos_descuento_paquetes cdp on cdp.codigo_id = cd.id
  where cd.activo = true
    and (cd.vigente_hasta is null or cd.vigente_hasta >= ((now() - interval '6 hours')::date))
    and (cd.usos_maximos is null or cd.usos_actuales < cd.usos_maximos)
  group by cd.id, cd.codigo, cd.descuento_pct
  order by cd.codigo asc;
end;
$function$
