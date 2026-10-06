do $$
declare t uuid; slug text; cu uuid; cid uuid; du uuid; paq uuid; secret text; tx1 uuid; tx2 uuid; j json; body text; firma text; log text := ''; m1 uuid; n1 int; n2 int; est text; rid uuid; res json; ts bigint;
begin
  select te.id, te.slug, cl.user_id, cl.id into t, slug, cu, cid from clientes cl join tenants te on te.id=cl.tenant_id where te.slug='demo' and cl.user_id is not null limit 1;
  select user_id into du from tenant_memberships where tenant_id=t and role='duena';
  select id into paq from paquetes where tenant_id=t and activo and precio>0 limit 1;
  ts := extract(epoch from now())::bigint;
  perform set_config('request.jwt.claim.sub', du::text, true); perform set_config('request.jwt.claims', json_build_object('sub',du,'role','authenticated')::text, true);
  secret := public.generar_secreto_webhook(t, 'miproveedor');
  perform set_config('request.jwt.claim.sub', cu::text, true); perform set_config('request.jwt.claims', json_build_object('sub',cu,'role','authenticated')::text, true);
  j := public.iniciar_transaccion_pasarela(t, paq, null, 'miproveedor'); tx1 := (j->>'transaccion_id')::uuid;
  j := public.iniciar_transaccion_pasarela(t, paq, null, 'miproveedor'); tx2 := (j->>'transaccion_id')::uuid;
  select count(*) into n1 from membresias where cliente_id = cid;
  -- 1) firma falsa
  body := json_build_object('event_id','e1','type','payment.succeeded','reference',tx1::text,'amount',(select monto from pago_transacciones where id=tx1),'ts',ts)::text;
  set local role anon;
  begin perform public.pago_webhook(slug,'miproveedor','firmafalsa',body); log:=log||'[firma falsa: NO bloqueó] '; exception when others then log:=log||'[firma falsa -> '||sqlerrm||'] '; end;
  -- 2) evento correcto
  reset role;
  firma := encode(extensions.hmac(body, secret, 'sha256'),'hex');
  set local role anon; res := public.pago_webhook(slug,'miproveedor',firma,body); reset role;
  log := log||'[pago: '||(res->>'resultado')||'] ';
  select count(*) into n2 from membresias where cliente_id = cid;
  log := log||'[membresías +'||(n2-n1)||'] ';
  -- 3) mismo evento otra vez
  set local role anon; res := public.pago_webhook(slug,'miproveedor',firma,body); reset role;
  log := log||'[repetido: duplicado='||coalesce(res->>'duplicado','no')||'] ';
  select count(*) into n2 from membresias where cliente_id = cid; log := log||'[membresías +'||(n2-n1)||' tras repetir] ';
  -- 4) monto distinto
  body := json_build_object('event_id','e2','type','payment.succeeded','reference',tx2::text,'amount',1,'ts',ts)::text;
  reset role; firma := encode(extensions.hmac(body, secret, 'sha256'),'hex');
  set local role anon; res := public.pago_webhook(slug,'miproveedor',firma,body); reset role;
  select estado into est from pago_transacciones where id=tx2; log := log||'[monto distinto: '||(res->>'resultado')||', tx='||est||'] ';
  -- 5) evento viejo (replay)
  body := json_build_object('event_id','e3','type','payment.failed','reference',tx2::text,'ts',ts-3600)::text;
  firma := encode(extensions.hmac(body, secret, 'sha256'),'hex');
  set local role anon;
  begin perform public.pago_webhook(slug,'miproveedor',firma,body); log:=log||'[replay: NO bloqueó] '; exception when others then log:=log||'[replay -> '||left(sqlerrm,40)||'] '; end; reset role;
  -- 6) reembolso: clienta solicita, dueña aprueba, proveedor confirma devolución
  select membresia_id into m1 from pago_transacciones where id=tx1;
  perform set_config('request.jwt.claim.sub', cu::text, true); perform set_config('request.jwt.claims', json_build_object('sub',cu,'role','authenticated')::text, true);
  rid := public.reembolso_solicitar(m1, (select monto from pago_transacciones where id=tx1), 'No pude asistir');
  begin perform public.reembolso_solicitar(m1, 10, 'otra vez'); log:=log||'[2º reembolso: NO bloqueó] '; exception when others then log:=log||'[2º reembolso -> '||left(sqlerrm,38)||'] '; end;
  begin perform public.reembolso_resolver(rid, true, null); log:=log||'[clienta aprobando su reembolso: NO bloqueó] '; exception when others then log:=log||'[clienta aprueba -> '||left(sqlerrm,25)||'] '; end;
  perform set_config('request.jwt.claim.sub', du::text, true); perform set_config('request.jwt.claims', json_build_object('sub',du,'role','authenticated')::text, true);
  perform public.reembolso_resolver(rid, true, 'ok');
  select estado into est from membresias where id=m1; log := log||'[aprobado: membresía '||est||'] ';
  body := json_build_object('event_id','e4','type','refund.succeeded','reference',tx1::text,'ts',ts)::text;
  reset role; firma := encode(extensions.hmac(body, secret, 'sha256'),'hex');
  set local role anon; perform public.pago_webhook(slug,'miproveedor',firma,body); reset role;
  select estado into est from reembolsos where id=rid; log := log||'[proveedor confirmó: reembolso '||est||'] ';
  raise exception 'RESULTADO: %', log;
end $$;
