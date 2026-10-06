-- Check-in por QR: cada clienta tiene un código personal (que se puede renovar) y el personal lo escanea o lo escribe.
-- Marca la asistencia de su clase de ahora, sin volver a consumir crédito, y nunca marca dos veces.

alter table public.clientes add column if not exists codigo_checkin text;
update public.clientes set codigo_checkin = upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10)) where codigo_checkin is null;
create unique index if not exists clientes_codigo_checkin_idx on public.clientes (tenant_id, codigo_checkin);
create or replace function public._tg_codigo_checkin()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.codigo_checkin is null then new.codigo_checkin := upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10)); end if;
  return new;
end $$;
drop trigger if exists clientes_codigo_checkin on public.clientes;
create trigger clientes_codigo_checkin before insert on public.clientes for each row execute function public._tg_codigo_checkin();

create or replace function public.mi_codigo_checkin(p_tenant_id uuid, p_renovar boolean default false)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_c uuid := public.mi_cliente_id(p_tenant_id); v_codigo text;
begin
  if v_c is null then raise exception 'No autorizado'; end if;
  if p_renovar then update public.clientes set codigo_checkin = upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10)) where id = v_c; end if;
  select codigo_checkin into v_codigo from public.clientes where id = v_c;
  return v_codigo;
end $$;
revoke all on function public.mi_codigo_checkin(uuid, boolean) from public;
grant execute on function public.mi_codigo_checkin(uuid, boolean) to authenticated;

create or replace function public.checkin_por_codigo(p_tenant_id uuid, p_codigo text)
returns json language plpgsql security definer set search_path to 'public' as $$
declare v_c record; v_r record; v_codigo text := upper(trim(regexp_replace(coalesce(p_codigo,''), '^RSCK:', '')));
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','admin_sede','recepcion','instructora']) then raise exception 'No autorizado'; end if;
  if v_codigo = '' then raise exception 'Escribe o escanea el código'; end if;
  select id, nombre into v_c from public.clientes where tenant_id = p_tenant_id and codigo_checkin = v_codigo;
  if v_c is null then raise exception 'Código no reconocido. Pídele que lo renueve en su perfil.'; end if;
  -- Su clase de ahora (o la de sus dependientes): confirmada, hoy, en una sede donde este personal trabaja, y dentro de la ventana de la clase.
  select r.id, r.asistio, h.nombre_clase, h.hora_inicio, c2.nombre as para into v_r
    from public.reservas r join public.horarios h on h.id = r.horario_id join public.clientes c2 on c2.id = r.cliente_id
    where r.tenant_id = p_tenant_id and (r.cliente_id = v_c.id or c2.tutor_id = v_c.id) and r.estado = 'confirmada'
      and r.fecha = public.hoy_en_sede(r.sede_id)
      and public.ahora_en_sede(r.sede_id) between (r.fecha + h.hora_inicio - interval '60 minutes') and (r.fecha + h.hora_fin + interval '30 minutes')
      and public.staff_puede_en_sede(p_tenant_id, r.sede_id, array['duena','gerente_general','admin_sede','recepcion','instructora'])
    order by abs(extract(epoch from ((r.fecha + h.hora_inicio) - public.ahora_en_sede(r.sede_id)))) limit 1;
  if v_r is null then raise exception '% no tiene una clase reservada en este momento en tus sedes.', v_c.nombre; end if;
  if v_r.asistio is true then return json_build_object('ok', true, 'ya_registrada', true, 'cliente', v_r.para, 'clase', v_r.nombre_clase, 'hora', v_r.hora_inicio); end if;
  perform public.registrar_asistencia(v_r.id, true);
  return json_build_object('ok', true, 'ya_registrada', false, 'cliente', v_r.para, 'clase', v_r.nombre_clase, 'hora', v_r.hora_inicio);
end $$;
revoke all on function public.checkin_por_codigo(uuid, text) from public;
grant execute on function public.checkin_por_codigo(uuid, text) to authenticated;
