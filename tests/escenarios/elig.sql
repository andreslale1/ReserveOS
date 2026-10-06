do $$
declare t uuid; u uuid; c uuid; s1 uuid; s2 uuid; h1 uuid; h2 uuid; paq uuid; m uuid; f date; r1 json; r2 json; r3 json; r4 json; r5 json; ctx int; oid2 uuid;
begin
  select te.id, cl.user_id, cl.id into t, u, c from clientes cl join tenants te on te.id=cl.tenant_id where te.slug='demo' and cl.user_id is not null limit 1;
  select id into s1 from sedes where tenant_id=t limit 1;
  insert into sedes(tenant_id,name) values (t,'ZZ Sede B') returning id into s2;
  f := current_date + ((3 - extract(dow from current_date)::int + 7) % 7) + 14;
  insert into horarios(tenant_id,sede_id,dia_semana,hora_inicio,hora_fin,nombre_clase,cupo_maximo) values (t,s1,3,'10:00','11:00','ZZ A',1) returning id into h1;
  insert into horarios(tenant_id,sede_id,dia_semana,hora_inicio,hora_fin,nombre_clase,cupo_maximo) values (t,s2,3,'12:00','13:00','ZZ B',5) returning id into h2;
  perform set_config('request.jwt.claim.sub', u::text, true); perform set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true);
  delete from membresias where cliente_id = c and false;
  -- caso 1: sin paquete (desactivo temporalmente las membresías activas de la clienta dentro de la transacción)
  update membresias set estado='vencida' where cliente_id=c and estado='activa';
  r1 := public.elegibilidad_clase(h1, f);
  -- caso 2: paquete solo sede 1, clase en sede 2
  insert into paquetes(tenant_id,nombre,precio,num_clases,vigencia_dias,cobertura) values (t,'ZZ Solo sede 1',100,2,60,'sedes') returning id into paq;
  insert into membresias(tenant_id,cliente_id,paquete_id,sede_venta_id,cobertura_tipo,estado,clases_totales,clases_usadas,fecha_inicio,fecha_vencimiento,pagada)
    values (t,c,paq,s1,'sedes','activa',2,0,current_date,current_date+60,true) returning id into m;
  insert into membresia_sedes(membresia_id,sede_id) values (m,s1);
  r2 := public.elegibilidad_clase(h2, f);
  -- caso 3: sí cubre → ok
  r3 := public.elegibilidad_clase(h1, f);
  -- caso 4: sin créditos
  update membresias set clases_usadas=2 where id=m;
  r4 := public.elegibilidad_clase(h1, f);
  -- caso 5: clase llena (otra persona ocupa el único lugar)
  update membresias set clases_usadas=0 where id=m;
  insert into clientes(tenant_id,nombre,telefono) values (t,'ZZ otra','55590001') returning id into oid2;
  insert into reservas(tenant_id,sede_id,horario_id,cliente_id,fecha,estado,tipo) values (t,s1,h1,oid2,f,'confirmada','prueba');
  r5 := public.elegibilidad_clase(h1, f);
  select count(*) into ctx from public.mis_contextos();
  raise exception 'RESULTADO: [1] % | [2] % | [3] % | [4] % | [5] % | contextos=%', r1->>'codigo', r2->>'codigo'||' ("'||left(r2->>'motivo',70)||'")', r3->>'codigo', r4->>'codigo', r5->>'codigo'||' espera='||coalesce(r5->>'puede_espera','?'), ctx;
end $$;
