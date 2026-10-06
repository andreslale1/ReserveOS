do $$
declare t uuid; du uuid; ge uuid; ge_m uuid; re uuid; re_m uuid; sede uuid; r1 text; r2 text; r3 text; r4 text; r5 text; r6 text; d1 uuid; d2 uuid; ad uuid;
 procedure_x int;
begin
  select tm.tenant_id into t from tenant_memberships tm join tenants te on te.id=tm.tenant_id where te.slug='demo' limit 1;
  select user_id into du from tenant_memberships where tenant_id=t and role='duena';
  select user_id, id into ge, ge_m from tenant_memberships where tenant_id=t and role='gerente_general';
  select user_id, id into re, re_m from tenant_memberships where tenant_id=t and role='recepcion';
  select user_id into ad from tenant_memberships where tenant_id=t and role='admin_sede';
  select id into sede from sedes where tenant_id=t limit 1;
  -- 1) gerente sin delegación: actualizar_marca (P04 G*) denegado
  perform set_config('request.jwt.claim.sub', ge::text, true); perform set_config('request.jwt.claims', json_build_object('sub',ge,'role','authenticated')::text, true);
  begin perform public.actualizar_marca(t,'Demo X',null); r1:='NO bloqueó'; exception when others then r1:=left(sqlerrm,70); end;
  -- el gerente no puede delegar
  begin perform public.delegacion_crear(t, ge_m, null, 'P04', null, null, 'auto'); r2:='NO bloqueó'; exception when others then r2:=left(sqlerrm,50); end;
  -- 2) dueña delega P04 a la persona (gerente) y sí puede
  perform set_config('request.jwt.claim.sub', du::text, true); perform set_config('request.jwt.claims', json_build_object('sub',du,'role','authenticated')::text, true);
  d1 := public.delegacion_crear(t, ge_m, null, 'P04', null, current_date+7, 'Prueba de delegación');
  perform public.actualizar_marca(t,'Demo (dueña)',null);  -- la dueña nunca necesita delegación
  perform set_config('request.jwt.claim.sub', ge::text, true); perform set_config('request.jwt.claims', json_build_object('sub',ge,'role','authenticated')::text, true);
  begin perform public.actualizar_marca(t,'Demo (gerente)',null); r3:='permitido con delegación'; exception when others then r3:='FALLÓ: '||left(sqlerrm,60); end;
  -- 3) revocar → vuelve a denegarse
  perform set_config('request.jwt.claim.sub', du::text, true); perform set_config('request.jwt.claims', json_build_object('sub',du,'role','authenticated')::text, true);
  perform public.delegacion_revocar(d1);
  perform set_config('request.jwt.claim.sub', ge::text, true); perform set_config('request.jwt.claims', json_build_object('sub',ge,'role','authenticated')::text, true);
  begin perform public.actualizar_marca(t,'Demo (otra vez)',null); r4:='NO bloqueó tras revocar'; exception when others then r4:='bloqueado tras revocar'; end;
  -- 4) recepción: gasto de sede (P35 S*) denegado, luego delegación por ROL limitada a su sede
  perform set_config('request.jwt.claim.sub', re::text, true); perform set_config('request.jwt.claims', json_build_object('sub',re,'role','authenticated')::text, true);
  begin perform public.registrar_gasto(t,sede,current_date,'Insumos','x',50,'variable',null); r5:='NO bloqueó'; exception when others then r5:=left(sqlerrm,45); end;
  perform set_config('request.jwt.claim.sub', du::text, true); perform set_config('request.jwt.claims', json_build_object('sub',du,'role','authenticated')::text, true);
  d2 := public.delegacion_crear(t, null, 'recepcion', 'P35', array[sede], null, 'Recepción registra gastos menores');
  perform set_config('request.jwt.claim.sub', re::text, true); perform set_config('request.jwt.claims', json_build_object('sub',re,'role','authenticated')::text, true);
  begin perform public.registrar_gasto(t,sede,current_date,'Insumos','x',50,'variable',null); r6:='recepción con delegación por rol: OK'; exception when others then r6:='FALLÓ: '||left(sqlerrm,80); end;
  raise exception 'RESULTADO: [1] gerente sin delegar -> % | [2] gerente intenta delegar -> % | [3] %  | [4] % | [5] recepción sin delegar -> % | [6] %', r1, r2, r3, r4, r5, r6;
end $$;
