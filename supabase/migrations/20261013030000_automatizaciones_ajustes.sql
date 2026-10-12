-- Ajuste: el aviso a clientas inactivas usa su propia plantilla de servicio (la «te_extrañamos» existente es de marketing) y respeta marketing_ok.
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='_asegurar_plantilla_auto';
  d := replace(d, E'  ''te_extrañamos'', jsonb_build_array(''Te extrañamos'', ''Hola {{nombre}}, hace tiempo que no te vemos en {{estudio}}. ¡Reserva tu próxima clase!''),',
                  E'  ''inactiva_aviso'', jsonb_build_array(''Te extrañamos'', ''Hola {{nombre}}, hace tiempo que no te vemos en {{estudio}} y aún tienes clases disponibles en tu paquete. ¡Reserva tu próxima clase!''),');
  if d not like '%inactiva_aviso%' then raise exception 'no se pudo parchear _asegurar_plantilla_auto'; end if;
  execute d;

  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='auto_clientas_inactivas';
  d := replace(d, E'''te_extrañamos'', ''{}''::jsonb', E'''inactiva_aviso'', ''{}''::jsonb');
  d := replace(d, E'       and exists (select 1 from public.reservas h where h.cliente_id = c.id and h.asistio is true)',
                  E'       and not exists (select 1 from public.comunicacion_preferencias cp where cp.cliente_id = c.id and not cp.marketing_ok)\n       and exists (select 1 from public.reservas h where h.cliente_id = c.id and h.asistio is true)');
  if d not like '%inactiva_aviso%' or d not like '%marketing_ok%' then raise exception 'no se pudo parchear auto_clientas_inactivas'; end if;
  execute d;
end $$;
revoke all on function public.auto_clientas_inactivas(timestamptz, uuid, boolean), public._asegurar_plantilla_auto(uuid, text) from public, anon, authenticated;
