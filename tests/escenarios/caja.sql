do $$
declare t uuid; du uuid; re uuid; s1 uuid; s2 uuid; paq uuid; cid uuid; j json; a json; b json; log text := ''; ef numeric; e1 text; e2 text; ra json;
begin
  select te.id into t from tenants te where te.slug='demo';
  select user_id into du from tenant_memberships where tenant_id=t and role='duena';
  select user_id into re from tenant_memberships where tenant_id=t and role='recepcion';
  select id into s1 from sedes where tenant_id=t order by created_at limit 1;
  insert into sedes(tenant_id,name) values (t,'ZZ Sede B') returning id into s2;
  select id into paq from paquetes where tenant_id=t and activo and precio>0 limit 1;
  insert into clientes(tenant_id,nombre,telefono) values (t,'ZZ Cliente Caja','55577001') returning id into cid;
  perform set_config('request.jwt.claim.sub', du::text, true); perform set_config('request.jwt.claims', json_build_object('sub',du,'role','authenticated')::text, true);
  a := public.finanzas_atribucion(t, current_date, current_date);
  j := public.agregar_membresia_manual(cid, paq, s1, 'efectivo', null, null);
  b := public.finanzas_atribucion(t, current_date, current_date);
  log := log || format('[consolidado %s -> %s | cuadra=%s] ', a->>'consolidado', b->>'consolidado', b->>'cuadra');
  log := log || format('[sede1: %s | sedeB: %s] ',
     (select (x->>'total') from json_array_elements(b->'sedes') x where x->>'sede_id' = s1::text),
     (select (x->>'total') from json_array_elements(b->'sedes') x where x->>'sede_id' = s2::text));
  select coalesce(sum(monto),0) into ef from public.caja_esperado_del_dia(t, s1, current_date) where metodo_pago='efectivo';
  log := log || format('[caja efectivo esperado sede1=%s] ', ef);
  select coalesce(sum(monto),0) into ef from public.caja_esperado_del_dia(t, s2, current_date) where metodo_pago='efectivo';
  log := log || format('[caja efectivo esperado sedeB=%s] ', ef);
  -- recepción de la sede 1
  perform set_config('request.jwt.claim.sub', re::text, true); perform set_config('request.jwt.claims', json_build_object('sub',re,'role','authenticated')::text, true);
  ra := public.finanzas_atribucion(t, current_date, current_date);
  log := log || format('[recepción ve %s sede(s), consolidado=%s] ', json_array_length(ra->'sedes'), coalesce(ra->>'consolidado','oculto'));
  begin perform * from public.caja_esperado_del_dia(t, s2, current_date); e1:='NO bloqueó'; exception when others then e1:=sqlerrm; end;
  begin perform public.cerrar_caja(t, s2, current_date, 0,0,0,null); e2:='NO bloqueó'; exception when others then e2:=left(sqlerrm,40); end;
  log := log || format('[recepción -> caja sede B: %s | cerrar caja B: %s]', e1, e2);
  raise exception 'RESULTADO: %', log;
end $$;
