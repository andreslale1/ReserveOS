do $$
declare t uuid; du uuid; s1 uuid; paq uuid; cid uuid; j json; mid uuid; did uuid; log text := ''; n int; est text; v_iva numeric; e1 text; e2 text;
begin
  select id into t from tenants where slug='demo';
  select user_id into du from tenant_memberships where tenant_id=t and role='duena';
  select id into s1 from sedes where tenant_id=t limit 1;
  select id into paq from paquetes where tenant_id=t and activo and precio=800 limit 1;
  if paq is null then select id into paq from paquetes where tenant_id=t and activo and precio>0 limit 1; end if;
  insert into clientes(tenant_id,nombre,telefono) values (t,'ZZ Cliente Fiscal','55588001') returning id into cid;
  perform set_config('request.jwt.claim.sub', du::text, true); perform set_config('request.jwt.claims', json_build_object('sub',du,'role','authenticated')::text, true);
  begin perform public.factura_solicitar(t,'membresia',gen_random_uuid(),'CF',null,null); e1:='NO exigió datos fiscales'; exception when others then e1:=left(sqlerrm,45); end;
  perform public.fiscal_guardar_config(t,'1234567-8','Estudio Demo, S.A.','Demo Pilates','Zona 10, Guatemala','general','A');
  j := public.agregar_membresia_manual(cid, paq, s1, 'efectivo', null, null); mid := (j->>'membresia_id')::uuid;
  select count(*) into n from public.ventas_sin_factura(t) where origen_id = mid;
  log := log || format('[venta aparece sin factura=%s] ', n);
  did := public.factura_solicitar(t,'membresia',mid,'','',null);
  select d.iva, d.nit_receptor into v_iva, est from documentos_fiscales d where d.id = did;
  log := log || format('[factura pendiente: NIT=%s IVA=%s sobre Q%s] ', est, v_iva, (j->>'precio_final'));
  begin perform public.factura_solicitar(t,'membresia',mid,'CF',null,null); e2:='NO bloqueó duplicado'; exception when others then e2:=left(sqlerrm,40); end;
  log := log || format('[2ª factura de la misma venta: %s] ', e2);
  perform public.factura_marcar_emitida(did,'A','12345','uuid-abc');
  select estado into est from documentos_fiscales where id = did; log := log || format('[estado=%s] ', est);
  perform public.anular_cobro_membresia(mid, 'Devolución de prueba');
  select estado into est from documentos_fiscales where id = did; log := log || format('[tras devolver la compra: factura %s] ', est);
  perform public.factura_anulada_manual(did, 'Anulada en el certificador');
  select estado into est from documentos_fiscales where id = did; log := log || format('[final=%s] ', est);
  raise exception 'RESULTADO: sin config -> % | %', e1, log;
end $$;
