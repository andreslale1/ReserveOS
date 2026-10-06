do $$
declare t uuid; du uuid; prod uuid; var uuid; e1 text; mv text; n int;
begin
  select id into t from tenants where slug='demo';
  select user_id into du from tenant_memberships where tenant_id=t and role='duena';
  perform set_config('request.jwt.claim.sub', du::text, true); perform set_config('request.jwt.claims', json_build_object('sub',du,'role','authenticated')::text, true);
  prod := public.producto_guardar(null, t, 'ZZ Camiseta', 'prueba', 120, 'ropa', null, true);
  select id into var from producto_variantes where producto_id=prod limit 1;
  perform public.inventario_ajustar(var, 5, 'entrada', 'Compra a proveedor');
  begin perform public.inventario_ajustar(var, -9, 'salida', 'Se dañaron'); e1:='NO bloqueó stock negativo'; exception when others then e1:=sqlerrm; end;
  begin perform public.inventario_ajustar(var, -1, 'salida', 'x'); e1:=e1||' | motivo corto: NO bloqueó'; exception when others then e1:=e1||' | motivo corto: '||left(sqlerrm,30); end;
  perform public.inventario_ajustar(var, -2, 'salida', 'Regalo a instructora');
  select string_agg(tipo||' '||delta||' (saldo '||saldo||', '||coalesce(motivo,'-')||')', ' ; ' order by created_at) into mv from movimientos_inventario where variante_id=var;
  raise exception 'RESULTADO: negativo -> % | movimientos: %', e1, mv;
end $$;
