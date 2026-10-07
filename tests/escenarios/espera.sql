do $$
declare t uuid; s1 uuid; h uuid; u1 uuid; u2 uuid; c1 uuid; c2 uuid; m1 uuid; m2 uuid; f date; r1 json; res uuid; log text := ''; usadas2_antes int; usadas2_desp int; rid2 uuid; mem_prom uuid; u2_final int; u1_a int; u1_d int; e text;
begin
  select id into t from tenants where slug='vim-prueba';
  select id into s1 from sedes where tenant_id=t and name='Centro';
  select user_id, id into u1, c1 from clientes where tenant_id=t and nombre='FX Clienta Centro';
  select user_id, id into u2, c2 from clientes where tenant_id=t and nombre='FX Clienta Norte';
  select id into m1 from membresias where cliente_id=c1 and estado='activa' limit 1;
  select id into m2 from membresias where cliente_id=c2 and estado='activa' limit 1;
  f := current_date + ((3 - extract(dow from current_date)::int + 7) % 7) + 7;
  insert into horarios(tenant_id,sede_id,dia_semana,hora_inicio,hora_fin,nombre_clase,cupo_maximo) values (t,s1,3,'15:00','16:00','ZZ Espera',1) returning id into h;
  -- clienta 1 reserva por sí misma (consume SU paquete)
  perform set_config('request.jwt.claim.sub', u1::text, true); perform set_config('request.jwt.claims', json_build_object('sub',u1,'role','authenticated')::text, true);
  select clases_usadas into u1_a from membresias where id=m1;
  r1 := public.agendar_clase(h, f); res := (r1->>'reserva_id')::uuid;
  select clases_usadas into u1_d from membresias where id=m1;
  log := log || format('[reserva propia: vínculo ok=%s, créditos %s->%s] ', (select membresia_id = m1 from reservas where id=res), u1_a, u1_d);
  -- clienta 2 entra a la lista de espera
  perform set_config('request.jwt.claim.sub', u2::text, true); perform set_config('request.jwt.claims', json_build_object('sub',u2,'role','authenticated')::text, true);
  perform public.unirse_lista_espera(h, f);
  select clases_usadas into usadas2_antes from membresias where id=m2;
  -- clienta 1 cancela con tiempo -> se le devuelve el crédito a SU membresía y se promueve a la clienta 2
  perform set_config('request.jwt.claim.sub', u1::text, true); perform set_config('request.jwt.claims', json_build_object('sub',u1,'role','authenticated')::text, true);
  perform public.cancelar_mi_reserva(res);
  select clases_usadas into u1_d from membresias where id=m1;
  select id, membresia_id into rid2, mem_prom from reservas where horario_id=h and fecha=f and cliente_id=c2 and estado='confirmada';
  select clases_usadas into usadas2_desp from membresias where id=m2;
  log := log || format('[cancela: crédito de la clienta 1 de vuelta=%s] [promovida: reserva=%s vínculo ok=%s, créditos %s->%s] ', (u1_d = u1_a), (rid2 is not null), (mem_prom = m2), usadas2_antes, usadas2_desp);
  -- la promovida cancela -> su crédito vuelve a SU membresía
  perform set_config('request.jwt.claim.sub', u2::text, true); perform set_config('request.jwt.claims', json_build_object('sub',u2,'role','authenticated')::text, true);
  perform public.cancelar_mi_reserva(rid2);
  select clases_usadas into usadas2_desp from membresias where id=m2;
  log := log || format('[la promovida cancela: créditos de vuelta=%s] ', (usadas2_desp = usadas2_antes));
  -- cobertura: clienta 1 (paquete solo Centro) no puede reservar en Norte
  begin perform public.agendar_clase((select id from horarios where tenant_id=t and nombre_clase='FX Clase Norte'), f + 0); e := 'sin error'; exception when others then e := left(sqlerrm, 45); end;
  perform set_config('request.jwt.claim.sub', u1::text, true); perform set_config('request.jwt.claims', json_build_object('sub',u1,'role','authenticated')::text, true);
  begin perform public.agendar_clase((select id from horarios where tenant_id=t and nombre_clase='FX Clase Norte'), (current_date + ((2 - extract(dow from current_date)::int + 7) % 7) + 7)); e := 'NO bloqueó'; exception when others then e := left(sqlerrm, 60); end;
  log := log || format('[clienta de Centro reservando en Norte: %s]', e);
  raise exception 'RESULTADO: %', log;
end $$;
