do $$
declare t uuid; cu uuid; cid uuid; du uuid; sede uuid; prod uuid; var uuid; paq uuid; pedido uuid; tx uuid; res json; log text := ''; j json; gc text;
begin
  select te.id, cl.user_id, cl.id into t, cu, cid from clientes cl join tenants te on te.id=cl.tenant_id where te.slug='demo' and cl.user_id is not null limit 1;
  select user_id into du from tenant_memberships where tenant_id=t and role='duena';
  select id into sede from sedes where tenant_id=t limit 1;
  select id into paq from paquetes where tenant_id=t and activo limit 1;
  insert into productos(tenant_id,nombre,precio) values (t,'ZZ Producto',50) returning id into prod;
  insert into producto_variantes(tenant_id,producto_id,nombre,stock) values (t,prod,'Unica',10) returning id into var;
  -- clienta arma carrito
  perform set_config('request.jwt.claim.sub', cu::text, true); perform set_config('request.jwt.claims', json_build_object('sub',cu,'role','authenticated')::text, true);
  begin perform public.agregar_a_carrito(t,'producto',prod,var,null,2); log:=log||'[carrito OK] '; exception when others then log:=log||'[carrito ERR: '||left(sqlerrm,80)||'] '; end;
  begin j := public.iniciar_checkout_carrito(t,'efectivo',null); pedido := (j->>'pedido_id')::uuid; log:=log||'[checkout efectivo OK total='||(j->>'total')||'] '; exception when others then log:=log||'[checkout efectivo ERR: '||left(sqlerrm,90)||'] '; end;
  -- personal confirma efectivo
  perform set_config('request.jwt.claim.sub', du::text, true); perform set_config('request.jwt.claims', json_build_object('sub',du,'role','authenticated')::text, true);
  begin perform public.confirmar_pedido_efectivo(pedido); log:=log||'[confirmar efectivo OK] '; exception when others then log:=log||'[confirmar efectivo ERR: '||left(sqlerrm,90)||'] '; end;
  begin perform public.marcar_pedido_entregado(pedido); log:=log||'[entregar OK] '; exception when others then log:=log||'[entregar ERR: '||left(sqlerrm,90)||'] '; end;
  begin j := public.registrar_venta_presencial(t,var,1,'efectivo',null); log:=log||'[venta presencial OK] '; exception when others then log:=log||'[venta presencial ERR: '||left(sqlerrm,90)||'] '; end;
  -- checkout con pasarela (clienta)
  perform set_config('request.jwt.claim.sub', cu::text, true); perform set_config('request.jwt.claims', json_build_object('sub',cu,'role','authenticated')::text, true);
  begin perform public.agregar_a_carrito(t,'producto',prod,var,null,1); j := public.iniciar_checkout_carrito(t,'pasarela',null); tx := (j->>'transaccion_id')::uuid; log:=log||'[checkout pasarela OK] '; exception when others then log:=log||'[checkout pasarela ERR: '||left(sqlerrm,100)||'] '; end;
  begin j := public.iniciar_transaccion_pasarela(t,paq,null,'recurrente'); log:=log||'[paquete pasarela OK] '; exception when others then log:=log||'[paquete pasarela ERR: '||left(sqlerrm,100)||'] '; end;
  -- gift card
  perform set_config('request.jwt.claim.sub', du::text, true); perform set_config('request.jwt.claims', json_build_object('sub',du,'role','authenticated')::text, true);
  begin j := public.crear_gift_card(t,paq,'Comprador','Destino','d@x.test','efectivo'); gc := j->>'codigo'; log:=log||'[crear gift OK] '; exception when others then log:=log||'[crear gift ERR: '||left(sqlerrm,90)||'] '; end;
  raise exception 'RESULTADO: %', log;
end $$;
