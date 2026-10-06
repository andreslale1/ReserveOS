do $$
declare t uuid; cu uuid; cid uuid; re uuid; s uuid; h uuid; cod text; r1 json; r2 json; e1 text; e2 text; n int; log text := ''; hora time;
begin
  select te.id, cl.user_id, cl.id into t, cu, cid from clientes cl join tenants te on te.id=cl.tenant_id where te.slug='demo' and cl.user_id is not null limit 1;
  select user_id into re from tenant_memberships where tenant_id=t and role='recepcion';
  select id into s from sedes where tenant_id=t limit 1;
  update membresias set estado='vencida' where cliente_id=cid and estado='activa';
  insert into membresias(tenant_id,cliente_id,paquete_id,sede_venta_id,cobertura_tipo,estado,clases_totales,clases_usadas,fecha_inicio,fecha_vencimiento,pagada,precio_final,confirmado_at)
    select t,cid,(select id from paquetes where tenant_id=t and activo limit 1),s,'todas','activa',5,0,current_date,current_date+30,true,0,now();
  -- una clase que empieza dentro de 20 minutos (hora de la sede)
  hora := (public.ahora_en_sede(s) + interval '20 minutes')::time;
  insert into horarios(tenant_id,sede_id,dia_semana,hora_inicio,hora_fin,nombre_clase,cupo_maximo,fecha_especifica) values (t,s,extract(dow from public.hoy_en_sede(s))::int,hora,(hora + interval '50 minutes')::time,'ZZ Clase Ahora',5,public.hoy_en_sede(s)) returning id into h;
  perform set_config('request.jwt.claim.sub', cu::text, true); perform set_config('request.jwt.claims', json_build_object('sub',cu,'role','authenticated')::text, true);
  perform public.agendar_clase(h, public.hoy_en_sede(s), cid);
  cod := public.mi_codigo_checkin(t);
  perform set_config('request.jwt.claim.sub', re::text, true); perform set_config('request.jwt.claims', json_build_object('sub',re,'role','authenticated')::text, true);
  begin perform public.checkin_por_codigo(t,'XXXXXXXXXX'); e1:='NO rechazó código falso'; exception when others then e1:=left(sqlerrm,40); end;
  r1 := public.checkin_por_codigo(t, 'RSCK:' || cod);
  r2 := public.checkin_por_codigo(t, lower(cod));
  select count(*) into n from reservas where horario_id=h and asistio is true;
  log := format('[código falso: %s] [1er escaneo: ya_registrada=%s clase=%s] [2º escaneo: ya_registrada=%s] [asistencias marcadas=%s] [créditos usados: %s]', e1, r1->>'ya_registrada', r1->>'clase', r2->>'ya_registrada', n, (select clases_usadas from membresias where cliente_id=cid and estado='activa' limit 1));
  raise exception 'RESULTADO: %', log;
end $$;
