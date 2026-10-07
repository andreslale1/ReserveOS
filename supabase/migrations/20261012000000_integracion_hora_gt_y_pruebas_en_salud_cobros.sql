-- Integración de la auditoría owner: Dirección/Resumen con día de Guatemala, y Salud/Cobros sin estudios demo o internos.
do $$
declare f text; d text;
begin
  foreach f in array array['plataforma_resumen','plataforma_direccion'] loop
    select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname=f;
    d := regexp_replace(d, '\mcurrent_date\M', 'public.hoy_gt()', 'g');
    execute d;
  end loop;

  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='plataforma_estudios_cobro';
  d := replace(d, 'left join public.plataforma_suscripciones s on s.tenant_id = t.id', 'left join public.plataforma_suscripciones s on s.tenant_id = t.id where t.tipo = ''cliente''');
  if d not like '%t.tipo = ''cliente''%' then raise exception 'no se pudo parchear plataforma_estudios_cobro'; end if;
  execute d;

  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='plataforma_salud';
  d := replace(d, 'from public.tenants t) q) m) e', 'from public.tenants t where t.tipo = ''cliente'') q) m) e');
  if d not like '%t.tipo = ''cliente''%' then raise exception 'no se pudo parchear plataforma_salud'; end if;
  execute d;
end $$;
