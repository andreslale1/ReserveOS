do $$
declare t uuid; du uuid; cu uuid; prod uuid; v uuid; n int; n2 int; mc int;
begin
  select te.id, cl.user_id into t, cu from clientes cl join tenants te on te.id=cl.tenant_id where te.slug='demo' and cl.user_id is not null limit 1;
  select user_id into du from tenant_memberships where tenant_id=t and role='duena';
  perform set_config('request.jwt.claim.sub', du::text, true); perform set_config('request.jwt.claims', json_build_object('sub',du,'role','authenticated')::text, true);
  prod := public.producto_guardar(null, t, 'ZZ Visible', 'x', 30, 'prueba', null, true);
  select id into v from producto_variantes where producto_id=prod; perform public.inventario_ajustar(v, 4, 'entrada', 'Prueba');
  perform set_config('request.jwt.claim.sub', cu::text, true); perform set_config('request.jwt.claims', json_build_object('sub',cu,'role','authenticated')::text, true);
  select count(*) into n from public.catalogo_productos(t) where nombre='ZZ Visible';
  select case when 'tienda_inventario' = any(public.mis_modulos(t)) then 1 else 0 end into mc;
  raise exception 'RESULTADO: la clienta ve el producto=% filas | módulo tienda en mis_modulos=%', n, mc;
end $$;
