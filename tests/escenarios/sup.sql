do $$
declare v_op uuid; v_du uuid; v_t uuid; v_tk uuid; v_det json; v_n int; v_err text; v_s json; v_d json; v_vis int; v_sla timestamptz; v_aud int;
begin
  select user_id into v_op from public.plataforma_staff where rol='operador' limit 1;
  select tm.user_id, tm.tenant_id into v_du, v_t from public.tenant_memberships tm join public.tenants te on te.id=tm.tenant_id where te.slug='ficticio-a' and tm.role='duena' limit 1;
  if v_du is null then raise exception 'SIN dueña en ficticio-a'; end if;
  -- dueña abre ticket urgente
  perform set_config('request.jwt.claim.sub', v_du::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_du,'role','authenticated')::text, true);
  v_tk := public.ticket_crear(v_t,'No carga la reserva de las 6am','Falla al reservar','urgente','Sede 1','v1');
  select sla_vence into v_sla from public.plataforma_tickets where id=v_tk;
  -- equipo responde: una pública y una interna
  perform set_config('request.jwt.claim.sub', v_op::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_op,'role','authenticated')::text, true);
  perform public.ticket_responder(v_tk,'Estamos revisando',false);
  perform public.ticket_responder(v_tk,'NOTA INTERNA: culpa del cache',true);
  begin perform public.ticket_actualizar(v_tk,'resuelto','urgente','Ing','');
  exception when others then v_err := sqlerrm; end;
  perform public.ticket_actualizar(v_tk,'resuelto','urgente','Ing','Cache desactualizado');
  select count(*) into v_n from public.tickets_listar(false) where id = v_tk;
  v_s := public.plataforma_salud(); v_d := public.plataforma_direccion();
  select count(*) into v_aud from public.plataforma_auditoria_listar(50);
  -- la dueña solo ve lo no interno
  perform set_config('request.jwt.claim.sub', v_du::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_du,'role','authenticated')::text, true);
  v_det := public.mi_ticket_detalle(v_tk);
  select json_array_length(v_det->'mensajes') into v_vis;
  raise exception 'RESULTADO: SLA urgente=% horas | resolver sin causa: % | listado equipo=% | mensajes visibles a la dueña=% (esperado 2: su texto + respuesta pública) | salud estudios=% cron=% | direccion tickets_abiertos=% | auditoría filas=%',
    round(extract(epoch from (v_sla - now()))/3600), left(v_err,60), v_n, v_vis, json_array_length(v_s->'estudios'), json_array_length(v_s->'cron'), v_d->>'tickets_abiertos', v_aud;
end $$;
