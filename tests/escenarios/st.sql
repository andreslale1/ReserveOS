do $$
declare v_du uuid; v_t uuid; v_s uuid; v_m uuid; h1 uuid; h2 uuid; sala uuid; c1 uuid; e1 text; e2 text; e3 text; r json; imp json; v_est text; v_cred int; v_h3 uuid; mem uuid;
begin
  select tm.user_id, tm.tenant_id, tm.id into v_du, v_t, v_m from public.tenant_memberships tm join public.tenants te on te.id=tm.tenant_id where te.slug='ficticio-a' and tm.role='duena' limit 1;
  select id into v_s from public.sedes where tenant_id=v_t limit 1;
  perform set_config('request.jwt.claim.sub', v_du::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_du,'role','authenticated')::text, true);
  -- choque de instructora
  insert into public.horarios(tenant_id,sede_id,dia_semana,hora_inicio,hora_fin,nombre_clase,instructor_membership_id,cupo_maximo) values (v_t,v_s,2,'06:00','07:00','T1',v_m,5) returning id into h1;
  begin insert into public.horarios(tenant_id,sede_id,dia_semana,hora_inicio,hora_fin,nombre_clase,instructor_membership_id,cupo_maximo) values (v_t,v_s,2,'06:30','07:30','T2',v_m,5); e1:='NO detectó choque'; exception when others then e1:=sqlerrm; end;
  -- sala
  sala := public.sala_guardar(null, v_s, 'Sala Test', 6, 'reformers', true);
  perform public.asignar_sala_horario(h1, sala);
  insert into public.horarios(tenant_id,sede_id,dia_semana,hora_inicio,hora_fin,nombre_clase,cupo_maximo) values (v_t,v_s,2,'06:30','07:30','T3',5) returning id into h2;
  begin perform public.asignar_sala_horario(h2, sala); e2:='ok sin choque aún'; exception when others then e2:=sqlerrm; end;
  -- pruebo choque de sala via update directo
  begin update public.horarios set sala_id = sala where id = h2; e2:='NO detectó choque de sala'; exception when others then e2:=sqlerrm; end;
  -- feriado: reserva futura y cierre
  insert into public.clientes(tenant_id,nombre,telefono) values (v_t,'ZZ Cliente Test','55500099') returning id into c1;
  insert into public.reservas(tenant_id,sede_id,horario_id,cliente_id,fecha,estado,tipo) values (v_t,v_s,h1,c1,(current_date + ((2 - extract(dow from current_date)::int + 7) % 7) + 7),'confirmada','prueba');
  r := public.cerrar_fechas(v_t, v_s, current_date + 1, current_date + 14, 'Feriado de prueba');
  select estado into v_est from public.reservas where cliente_id=c1;
  begin insert into public.reservas(tenant_id,sede_id,horario_id,cliente_id,fecha,estado,tipo) values (v_t,v_s,h1,c1,(current_date + ((2 - extract(dow from current_date)::int + 7) % 7) + 7),'confirmada','prueba'); e3:='NO bloqueó reserva en cierre'; exception when others then e3:=sqlerrm; end;
  -- importación
  imp := public.importar_clientes(v_t, '[{"nombre":"Ana Test","telefono":"+502 5555-1111","email":"ana@t.test"},{"nombre":"Ana Repetida","telefono":"5555 1111"},{"nombre":"","telefono":"55551112"},{"nombre":"Luis","telefono":"12"},{"nombre":"ZZ Cliente Test","telefono":"502-55500099"}]'::jsonb, true);
  raise exception 'RESULTADO: choque instructora: % | choque sala: % | feriado canceló % reservas, estado=% | reserva en cierre: % | importar: %', left(e1,50), left(e2,45), r->>'reservas_canceladas', v_est, left(e3,60), imp::text;
end $$;
