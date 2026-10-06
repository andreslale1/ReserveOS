do $$
declare t uuid; du uuid; s1 uuid; paq uuid; j json; a numeric; b numeric; ef numeric; at json; cu uuid; r json; e1 text;
begin
  select id into t from tenants where slug='demo';
  select user_id into du from tenant_memberships where tenant_id=t and role='duena';
  select id into s1 from sedes where tenant_id=t limit 1;
  select id into paq from paquetes where tenant_id=t and activo and precio>0 limit 1;
  select cl.user_id into cu from clientes cl where cl.tenant_id=t and cl.user_id is not null limit 1;
  perform set_config('request.jwt.claim.sub', du::text, true); perform set_config('request.jwt.claims', json_build_object('sub',du,'role','authenticated')::text, true);
  select coalesce(sum(monto),0) into a from public.caja_esperado_del_dia(t, s1, current_date) where metodo_pago='efectivo';
  j := public.gift_card_vender(t, s1, paq, 'Comprador', 'Destinataria', 'd@x.test', 'efectivo');
  select coalesce(sum(monto),0) into b from public.caja_esperado_del_dia(t, s1, current_date) where metodo_pago='efectivo';
  at := public.finanzas_atribucion(t, current_date, current_date);
  -- anular una tarjeta activa y comprobar que no se puede canjear
  perform public.gift_card_anular((j->>'id')::uuid, 'Error de captura');
  perform set_config('request.jwt.claim.sub', cu::text, true); perform set_config('request.jwt.claims', json_build_object('sub',cu,'role','authenticated')::text, true);
  begin perform public.canjear_gift_card(t, j->>'codigo'); e1:='NO bloqueó'; exception when others then e1:=sqlerrm; end;
  raise exception 'RESULTADO: código %, monto %: caja efectivo % -> % (sube %) | atribución cuadra=% | canje de tarjeta anulada: %', j->>'codigo', j->>'monto', a, b, b-a, at->>'cuadra', e1;
end $$;
