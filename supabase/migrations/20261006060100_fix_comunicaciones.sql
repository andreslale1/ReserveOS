-- Correcciones: tipo de la fila de clienta en campana_enviar y aislamiento de fallos en los avisos de reserva.
create or replace function public.campana_enviar(p_tenant_id uuid, p_nombre text, p_segmento_id uuid, p_plantilla_id uuid, p_programada timestamptz)
returns json language plpgsql security definer set search_path to 'public' as $$
declare v_seg record; v_pl record; v_estudio text; v_c public.clientes; v_id uuid; v_enc int := 0; v_sin_cons int := 0; v_sin_dest int := 0; v_dest text; v_pref record;
begin
  perform public._exigir_accion(p_tenant_id, null::uuid, 'P42');
  perform public._exigir_modulo(p_tenant_id, 'campanas_marketing');
  select * into v_seg from public.segmentos where id = p_segmento_id and tenant_id = p_tenant_id;
  select * into v_pl from public.plantillas_mensaje where id = p_plantilla_id and tenant_id = p_tenant_id and activa;
  if v_seg is null or v_pl is null then raise exception 'Segmento o plantilla no válidos'; end if;
  if v_pl.tipo <> 'marketing' then raise exception 'Las plantillas transaccionales se envían solas; elige una de marketing'; end if;
  if p_nombre is null or length(trim(p_nombre)) < 2 then raise exception 'Ponle un nombre a la campaña'; end if;
  if (select count(*) from public.campanas_estudio where tenant_id = p_tenant_id and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'Máximo 3 campañas cada 24 horas, para no saturar a tus clientas.';
  end if;
  select name into v_estudio from public.tenants where id = p_tenant_id;
  insert into public.campanas_estudio (tenant_id, nombre, segmento_id, plantilla_id, programada_para) values (p_tenant_id, trim(p_nombre), p_segmento_id, p_plantilla_id, p_programada) returning id into v_id;
  for v_c in select c.* from public.clientes c join public._segmento_clientes(p_tenant_id, v_seg.criterio) s on s.id = c.id loop
    exit when v_enc >= 2000;
    select * into v_pref from public.comunicacion_preferencias where cliente_id = v_c.id;
    if v_pref is null or not v_pref.marketing_ok or (v_pl.canal = 'email' and not v_pref.email_ok) or (v_pl.canal = 'whatsapp' and not v_pref.whatsapp_ok) then v_sin_cons := v_sin_cons + 1; continue; end if;
    v_dest := case v_pl.canal when 'email' then nullif(trim(coalesce(v_c.email,'')),'') else nullif(trim(coalesce(v_c.telefono,'')),'') end;
    if v_dest is null then v_sin_dest := v_sin_dest + 1; continue; end if;
    insert into public.cola_mensajes (tenant_id, campana_id, cliente_id, canal, destino, asunto, cuerpo, tipo, proximo_intento, clave_unica)
      values (p_tenant_id, v_id, v_c.id, v_pl.canal, v_dest, public._render_mensaje(v_pl.asunto, v_c, v_estudio), public._render_mensaje(v_pl.cuerpo, v_c, v_estudio), 'marketing', coalesce(p_programada, now()), 'camp:' || v_id || ':' || v_c.id)
      on conflict do nothing;
    v_enc := v_enc + 1;
  end loop;
  update public.campanas_estudio set encolados = v_enc, omitidos_consentimiento = v_sin_cons, omitidos_sin_destino = v_sin_dest where id = v_id;
  return json_build_object('ok', true, 'campana_id', v_id, 'encolados', v_enc, 'omitidos_sin_consentimiento', v_sin_cons, 'omitidos_sin_destino', v_sin_dest);
end $$;
revoke all on function public.campana_enviar(uuid, text, uuid, uuid, timestamptz) from public;
grant execute on function public.campana_enviar(uuid, text, uuid, uuid, timestamptz) to authenticated;

create or replace function public._tg_reserva_mensajes()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare h record; v_sede text;
begin
  if new.tipo = 'privada' then return new; end if;
  select h2.nombre_clase, h2.hora_inicio into h from public.horarios h2 where h2.id = new.horario_id;
  select name into v_sede from public.sedes where id = new.sede_id;
  if tg_op = 'INSERT' and new.estado = 'confirmada' then
    perform public._encolar_transaccional(new.tenant_id, new.cliente_id, 'reserva_confirmada',
      jsonb_build_object('clase', h.nombre_clase, 'fecha', to_char(new.fecha, 'DD/MM'), 'hora', to_char(h.hora_inicio, 'HH24:MI'), 'sede', v_sede), 'res-ok:' || new.id);
  elsif tg_op = 'UPDATE' and old.estado = 'confirmada' and new.estado = 'cancelada' then
    perform public._encolar_transaccional(new.tenant_id, new.cliente_id, 'reserva_cancelada',
      jsonb_build_object('clase', h.nombre_clase, 'fecha', to_char(new.fecha, 'DD/MM'), 'hora', to_char(h.hora_inicio, 'HH24:MI'), 'sede', v_sede), 'res-cancel:' || new.id);
  end if;
  return new;
exception when others then
  return new;   -- un aviso que falla jamás debe impedir una reserva
end $$;
