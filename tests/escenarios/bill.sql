do $$
declare v_uid uuid; v_a uuid; v_b uuid; n1 int; n2 int; v_c uuid; est text; pag numeric; v_over text; v_res json; v_mora numeric;
begin
  select user_id into v_uid from public.plataforma_staff where rol='operador' limit 1;
  perform set_config('request.jwt.claim.sub', v_uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid,'role','authenticated')::text, true);
  select id into v_a from public.tenants where slug='ficticio-a';
  select id into v_b from public.tenants where slug='ficticio-b';
  perform public.suscripcion_guardar(v_a,'profesional',1000,1,'activa');
  perform public.suscripcion_guardar(v_b,'esencial',500,5,'activa');
  n1 := public.generar_cobros_mes('2026-10-15');
  n2 := public.generar_cobros_mes('2026-10-20');
  select id into v_c from public.plataforma_cobros where tenant_id=v_a and periodo='2026-10-01' and concepto='licencia';
  perform public.registrar_pago_cobro(v_c,'transferencia','REF1',null,400);
  select estado, monto_pagado into est, pag from public.plataforma_cobros where id=v_c;
  select sum(monto - descuento - monto_pagado) into v_mora from public.plataforma_cobros where tenant_id=v_a and estado in ('pendiente','parcial') and fecha_vencimiento < current_date;
  begin perform public.registrar_pago_cobro(v_c,'efectivo',null,null,700); v_over:='NO bloqueó sobrepago'; exception when others then v_over:=sqlerrm; end;
  perform public.registrar_pago_cobro(v_c,'efectivo','REF2',null,600);
  select estado into est from public.plataforma_cobros where id=v_c;
  perform public.cobro_crear(v_b,'setup',2000,200,null,'Implementación');
  v_res := public.plataforma_rentabilidad('2026-10-01','2026-12-31');
  raise exception 'RESULTADO: 1a vez creó % cobros, 2a vez %  | tras pago 400: parcial, mora A=% | sobrepago: % | tras 600 más: % | ingresos=%', n1, n2, v_mora, left(v_over,90), est, v_res->>'ingresos';
end $$;
