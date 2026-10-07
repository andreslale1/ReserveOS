do $$
declare t uuid; du uuid; cu uuid; cid uuid; seg uuid; pl uuid; r1 json; r2 json; log text := ''; tomados int; est text; v_int int; prox timestamptz; h uuid; s uuid; n int; mid uuid; e text;
begin
  select te.id, cl.user_id, cl.id into t, cu, cid from clientes cl join tenants te on te.id=cl.tenant_id where te.slug='demo' and cl.user_id is not null limit 1;
  select user_id into du from tenant_memberships where tenant_id=t and role='duena';
  update clientes set email='cliente.prueba@example.com', telefono='55512345' where id=cid;
  perform set_config('request.jwt.claim.sub', du::text, true); perform set_config('request.jwt.claims', json_build_object('sub',du,'role','authenticated')::text, true);
  seg := public.segmento_guardar(t, 'Todas las clientas', 'todas', 30);
  select id into pl from plantillas_mensaje where tenant_id=t and clave='te_extrañamos' and canal='email';
  r1 := public.campana_enviar(t, 'Prueba sin consentimiento', seg, pl, null);
  log := log || format('[sin consentimiento: encolados=%s omitidos=%s] ', r1->>'encolados', r1->>'omitidos_sin_consentimiento');
  -- la clienta da su consentimiento
  perform set_config('request.jwt.claim.sub', cu::text, true); perform set_config('request.jwt.claims', json_build_object('sub',cu,'role','authenticated')::text, true);
  perform public.guardar_mis_preferencias(t, true, true, true);
  perform set_config('request.jwt.claim.sub', du::text, true); perform set_config('request.jwt.claims', json_build_object('sub',du,'role','authenticated')::text, true);
  r2 := public.campana_enviar(t, 'Prueba con consentimiento', seg, pl, null);
  log := log || format('[con consentimiento: encolados=%s] ', r2->>'encolados');
  select count(*) into n from cola_mensajes where campana_id = (r2->>'campana_id')::uuid and destino='cliente.prueba@example.com' and cuerpo like 'Hola %' and cuerpo not like '%{{%';
  log := log || format('[mensaje personalizado ok=%s] ', n);
  -- el proveedor toma, falla, y se reintenta con espera
  select count(*) into tomados from public.cola_tomar(200);
  select id into mid from cola_mensajes where campana_id = (r2->>'campana_id')::uuid limit 1;
  perform public.cola_resultado(mid, false, 'timeout');
  select c.estado, c.intentos, c.proximo_intento into est, v_int, prox from cola_mensajes c where c.id = mid;
  log := log || format('[tras fallo: estado=%s intentos=%s reintento en ~%s min] ', est, v_int, round(extract(epoch from (prox - now()))/60));
  -- reserva => aviso automático, una sola vez
  select id, sede_id into h, s from horarios where tenant_id=t and activo and fecha_especifica is null limit 1;
  perform set_config('request.jwt.claim.sub', du::text, true);
  insert into reservas(tenant_id,sede_id,horario_id,cliente_id,fecha,estado,tipo) values (t,s,h,cid,current_date+30,'confirmada','prueba') returning id into mid;
  select count(*) into n from cola_mensajes where clave_unica like 'res-ok:'||mid||'%';
  update reservas set estado='cancelada' where id=mid;
  select count(*) into tomados from cola_mensajes where clave_unica like 'res-cancel:'||mid||'%';
  log := log || format('[reserva -> %s aviso(s) de confirmación, %s de cancelación] ', n, tomados);
  -- tope de campañas
  begin perform public.campana_enviar(t,'c3',seg,pl,null); perform public.campana_enviar(t,'c4',seg,pl,null); e:='NO limitó'; exception when others then e:=left(sqlerrm,50); end;
  log := log || format('[tope: %s] ', e);
  raise exception 'RESULTADO: % | cron=%', log, (select count(*) from cron.job where jobname='encolar_recordatorios');
end $$;
