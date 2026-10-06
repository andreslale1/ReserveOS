do $$
declare v_uid uuid; v_e uuid; v_o uuid; v_n int; v_err text; v_dup text;
begin
  select user_id into v_uid from public.plataforma_staff where rol='operador' limit 1;
  if v_uid is null then raise exception 'SIN OPERADOR registrado en plataforma_staff'; end if;
  perform set_config('request.jwt.claim.sub', v_uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role','authenticated')::text, true);
  v_e := public.empresa_guardar(null,'ZZ Gimnasio Prueba','gimnasio','Guatemala',null,2,'web',null);
  begin perform public.empresa_guardar(null,'zz gimnasio prueba','gimnasio',null,null,null,null,null); v_dup:='NO bloqueo duplicado';
  exception when others then v_dup:='bloqueó duplicado OK'; end;
  v_o := public.oportunidad_guardar(null, v_e, 1500,'prospecto','profesional',2,40,'Llamar',null,'web',null,null);
  perform public.lead_cambiar_etapa(v_o,'ganado');
  select count(*) into v_n from public.plataforma_proyectos where lead_id=v_o;
  begin perform public.proyecto_publicar((select id from public.plataforma_proyectos where lead_id=v_o)); v_err:='NO bloqueó salida en vivo';
  exception when others then v_err := sqlerrm; end;
  begin perform public.lead_cambiar_etapa(v_o,'perdido'); exception when others then v_err := v_err || ' || perdido sin motivo: ' || sqlerrm; end;
  raise exception 'RESULTADO: % | proyectos creados=% | publicar: %', v_dup, v_n, left(v_err, 400);
end $$;
