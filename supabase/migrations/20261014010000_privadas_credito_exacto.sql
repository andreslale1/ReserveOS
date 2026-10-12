-- Clases privadas 1 a 1: el crédito se devuelve igual que en una clase normal (antes nunca se devolvía) y cada reserva queda ligada a su paquete.
do $$
declare d text; f text;
begin
  -- 1) agendar_clase_privada marcaba el crédito como «ya devuelto» desde el momento de reservar: así jamás se podía devolver.
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='agendar_clase_privada';
  d := replace(d, 'credito_devuelto_at = case when null::int is null and v_membresia_id is not null then now() else null end', 'credito_devuelto_at = null');
  if d like '%null::int is null%' then raise exception 'no se pudo parchear agendar_clase_privada'; end if;
  execute d;

  -- 2) la asignación manual no ligaba la reserva a la membresía que creaba
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='asignar_clase_privada_manual';
  d := regexp_replace(d, 'returning id into v_reserva_id;\s*return json_build_object\(''ok'', true, ''membresia_id''', E'returning id into v_reserva_id;\n  update public.reservas set membresia_id = v_membresia_id where id = v_reserva_id;\n  return json_build_object(''ok'', true, ''membresia_id''');
  if d not like '%set membresia_id = v_membresia_id%' then raise exception 'no se pudo parchear asignar_clase_privada_manual'; end if;
  execute d;

  -- 3) cancelar una privada devuelve el crédito (mismas reglas de cancelación tardía que una clase normal)
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='cancelar_mi_reserva';
  d := replace(d, E'v_reserva.tipo = ''regular'' and (not v_es_tardia or v_devuelve)', E'v_reserva.tipo in (''regular'',''privado'') and (not v_es_tardia or v_devuelve)');
  if d not like '%(''regular'',''privado'')%' then raise exception 'no se pudo parchear cancelar_mi_reserva'; end if;
  execute d;
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='admin_cancelar_reserva';
  d := replace(d, E'v_reserva.tipo = ''regular''', E'v_reserva.tipo in (''regular'',''privado'')');
  if d not like '%(''regular'',''privado'')%' then raise exception 'no se pudo parchear admin_cancelar_reserva'; end if;
  execute d;
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='cancelar_clase_fecha';
  d := replace(d, E'v_r.tipo = ''regular''', E'v_r.tipo in (''regular'',''privado'')');
  execute d;
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='corregir_asistencia';
  d := replace(d, E'v_r.tipo = ''regular''', E'v_r.tipo in (''regular'',''privado'')');
  execute d;

  foreach f in array array['_tg_reserva_mensajes()','_tg_horario_instructora_historial()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- Reservas privadas vigentes que el error dejó marcadas como «crédito ya devuelto»: se corrigen para que su crédito sí pueda devolverse.
update public.reservas set credito_devuelto_at = null
  where tipo = 'privado' and estado = 'confirmada' and membresia_id is not null and credito_devuelto_at is not null;
