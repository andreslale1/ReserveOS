-- Reserva asistida (recepción / administración) en clases por carril, y cupo por fecha en la reserva del personal.
create or replace function public._parchear_funcion(p_nombre text, p_ancla text, p_nuevo text, p_marca text, p_esperadas integer default 1)
returns void language plpgsql as $$
declare v_oid oid; v_def text; v_n integer;
begin
  select p.oid into v_oid from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = p_nombre;
  if v_oid is null then raise exception 'Se detiene: no existe la función %', p_nombre; end if;
  v_def := pg_get_functiondef(v_oid);
  if position(p_marca in v_def) > 0 then return; end if;
  v_n := (length(v_def) - length(replace(v_def, p_ancla, ''))) / greatest(length(p_ancla), 1);
  if v_n <> p_esperadas then raise exception 'Se detiene: en % se esperaban % coincidencias y hay % (el texto cambió)', p_nombre, p_esperadas, v_n; end if;
  execute replace(v_def, p_ancla, p_nuevo);
end $$;

-- Una clase por carril no se agrega sin carril (solo admin_agendar_clase_carril lo permite) y el cupo es el de la fecha.
select public._parchear_funcion('admin_agregar_reserva',
  'if v_tenant_id is null then raise exception ''Horario no válido''; end if;',
  E'if v_tenant_id is null then raise exception ''Horario no válido''; end if;\n  v_cupo := coalesce((select cupo_maximo from public.horario_cupo_fecha where horario_id = p_horario_id and fecha = p_fecha), v_cupo);\n  if exists (select 1 from public.horarios hm where hm.id = p_horario_id and hm.modo_reserva = ''carril'') and coalesce(current_setting(''reserveos.carril'', true), '''') <> ''on'' then\n    raise exception ''Esta clase se reserva eligiendo un carril.'';\n  end if;',
  'Esta clase se reserva eligiendo un carril');

drop function public._parchear_funcion(text, text, text, text, integer);

create or replace function public.admin_agendar_clase_carril(p_cliente_id uuid, p_horario_id uuid, p_fecha date, p_recurso_id uuid)
returns json language plpgsql security definer set search_path to 'public' as $$
declare v_h record; v_r record; v_res json; v_reserva_id uuid;
begin
  select tenant_id, sede_id, modo_reserva into v_h from public.horarios where id = p_horario_id;
  if v_h is null then raise exception 'Clase no encontrada'; end if;
  if v_h.modo_reserva <> 'carril' then raise exception 'Esta clase no se reserva por carril.'; end if;
  select tenant_id, sede_id, activo, nombre into v_r from public.recursos where id = p_recurso_id;
  if v_r is null or not v_r.activo or v_r.tenant_id <> v_h.tenant_id or v_r.sede_id <> v_h.sede_id then raise exception 'Ese carril no es válido para esta clase.'; end if;
  perform set_config('reserveos.carril', 'on', true);
  begin
    v_res := public.admin_agregar_reserva(p_cliente_id, p_horario_id, p_fecha, 'regular');   -- valida permisos, derecho y cupo
    v_reserva_id := (v_res->>'reserva_id')::uuid;
    update public.reservas set recurso_id = p_recurso_id where id = v_reserva_id;
  exception when unique_violation then
    perform set_config('reserveos.carril', '', true);
    raise exception 'Ese carril ya fue reservado por otra persona. Elige otro.';
  end;
  perform set_config('reserveos.carril', '', true);
  return json_build_object('ok', true, 'reserva_id', v_reserva_id, 'carril', v_r.nombre);
end $$;
revoke all on function public.admin_agendar_clase_carril(uuid, uuid, date, uuid) from public, anon;
grant execute on function public.admin_agendar_clase_carril(uuid, uuid, date, uuid) to authenticated;
