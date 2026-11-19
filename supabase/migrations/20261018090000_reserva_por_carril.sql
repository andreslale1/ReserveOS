-- RESERVA POR CARRIL / ESTACIÓN (HYROX, natación, etc.).
-- Una clase puede reservarse por «cupo» (lo de siempre) o por «carril»: cada persona elige un carril numerado y nadie más puede tomarlo.
-- Todo es transaccional: si dos personas piden el mismo carril a la vez, solo una lo obtiene.

create table if not exists public.recursos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sede_id uuid not null references public.sedes(id) on delete cascade,
  nombre text not null,
  tipo text not null default 'carril' check (tipo in ('carril','estacion','lugar')),
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (sede_id, nombre)
);
create index if not exists recursos_sede_idx on public.recursos (sede_id, orden);
alter table public.recursos enable row level security;
drop policy if exists recursos_select on public.recursos;
create policy recursos_select on public.recursos for select to authenticated using (
  tenant_id in (select public.current_tenant_ids()) or tenant_id in (select c.tenant_id from public.clientes c where c.user_id = auth.uid()));
revoke all on public.recursos from anon, authenticated;
grant select on public.recursos to authenticated;

alter table public.horarios add column if not exists modo_reserva text not null default 'cupo';
alter table public.horarios drop constraint if exists horarios_modo_reserva_check;
alter table public.horarios add constraint horarios_modo_reserva_check check (modo_reserva in ('cupo','carril'));
alter table public.reservas add column if not exists recurso_id uuid references public.recursos(id) on delete set null;
create unique index if not exists reservas_recurso_unico on public.reservas (horario_id, fecha, recurso_id) where estado = 'confirmada' and recurso_id is not null;

-- ───────── El estudio crea sus carriles ─────────
create or replace function public.crear_recursos(p_sede_id uuid, p_cantidad integer, p_tipo text default 'carril')
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_t uuid; v_max integer; v_i integer; v_pref text; v_n integer := 0;
begin
  select tenant_id into v_t from public.sedes where id = p_sede_id;
  if v_t is null then raise exception 'Sede no encontrada'; end if;
  if not public.staff_puede_en_sede(v_t, p_sede_id, array['duena','gerente_general','gerente_regional','admin_sede']) then raise exception 'No autorizado'; end if;
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 60 then raise exception 'La cantidad debe estar entre 1 y 60'; end if;
  if p_tipo not in ('carril','estacion','lugar') then raise exception 'Tipo no válido'; end if;
  v_pref := case p_tipo when 'carril' then 'Carril' when 'estacion' then 'Estación' else 'Lugar' end;
  select coalesce(max(orden), 0) into v_max from public.recursos where sede_id = p_sede_id and tipo = p_tipo;
  for v_i in 1..p_cantidad loop
    insert into public.recursos (tenant_id, sede_id, nombre, tipo, orden) values (v_t, p_sede_id, v_pref || ' ' || (v_max + v_i), p_tipo, v_max + v_i) on conflict (sede_id, nombre) do nothing;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke all on function public.crear_recursos(uuid, integer, text) from public, anon;
grant execute on function public.crear_recursos(uuid, integer, text) to authenticated;

-- ───────── Una clase pasa a reservarse por carril (o vuelve a cupo) ─────────
create or replace function public.fijar_modo_reserva(p_horario_id uuid, p_modo text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_h record; v_n integer;
begin
  select tenant_id, sede_id, cupo_maximo into v_h from public.horarios where id = p_horario_id;
  if v_h is null then raise exception 'Clase no encontrada'; end if;
  if not public.staff_puede_en_sede(v_h.tenant_id, v_h.sede_id, array['duena','gerente_general','gerente_regional','admin_sede']) then raise exception 'No autorizado'; end if;
  if p_modo not in ('cupo','carril') then raise exception 'Modo no válido'; end if;
  if p_modo = 'carril' then
    select count(*) into v_n from public.recursos where sede_id = v_h.sede_id and activo;
    if v_n < v_h.cupo_maximo then raise exception 'La clase tiene cupo para % personas pero la sede solo tiene % carriles activos. Crea más carriles o baja el cupo.', v_h.cupo_maximo, v_n; end if;
    if exists (select 1 from public.reservas where horario_id = p_horario_id and estado = 'confirmada' and recurso_id is null and fecha >= public.hoy_gt()) then
      raise exception 'Hay reservas futuras sin carril asignado. Resuélvelas antes de cambiar a reserva por carril.';
    end if;
  end if;
  update public.horarios set modo_reserva = p_modo where id = p_horario_id;
end $$;
revoke all on function public.fijar_modo_reserva(uuid, text) from public, anon;
grant execute on function public.fijar_modo_reserva(uuid, text) to authenticated;

-- ───────── Qué carriles están libres en una fecha ─────────
create or replace function public.carriles_de_clase(p_horario_id uuid, p_fecha date)
returns table(recurso_id uuid, nombre text, orden integer, ocupado boolean, mio boolean)
language plpgsql stable security definer set search_path to 'public' as $$
declare v_h record;
begin
  select tenant_id, sede_id into v_h from public.horarios where id = p_horario_id;
  if v_h is null then return; end if;
  if not (v_h.tenant_id in (select public.current_tenant_ids())
          or exists (select 1 from public.clientes c where c.user_id = auth.uid() and c.tenant_id = v_h.tenant_id)) then
    return;
  end if;
  return query
    select r.id, r.nombre, r.orden,
      exists (select 1 from public.reservas x where x.horario_id = p_horario_id and x.fecha = p_fecha and x.estado = 'confirmada' and x.recurso_id = r.id),
      exists (select 1 from public.reservas x join public.clientes c on c.id = x.cliente_id
               where x.horario_id = p_horario_id and x.fecha = p_fecha and x.estado = 'confirmada' and x.recurso_id = r.id
                 and (c.user_id = auth.uid() or c.tutor_id in (select id from public.clientes where user_id = auth.uid() and tenant_id = v_h.tenant_id)))
    from public.recursos r where r.sede_id = v_h.sede_id and r.activo order by r.orden;
end $$;
revoke all on function public.carriles_de_clase(uuid, date) from public, anon;
grant execute on function public.carriles_de_clase(uuid, date) to authenticated;

-- ───────── Parches a las funciones vivas (misma técnica segura que las tandas anteriores) ─────────
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

-- Una clase por carril NO se reserva sin elegir carril (solo la función agendar_clase_carril lo permite).
select public._parchear_funcion('agendar_clase',
  'if v_tenant_id is null then raise exception ''Horario no válido''; end if;',
  E'if v_tenant_id is null then raise exception ''Horario no válido''; end if;\n  if exists (select 1 from public.horarios hm where hm.id = p_horario_id and hm.modo_reserva = ''carril'') and coalesce(current_setting(''reserveos.carril'', true), '''') <> ''on'' then\n    raise exception ''Esta clase se reserva eligiendo un carril.'';\n  end if;',
  'Esta clase se reserva eligiendo un carril');
-- Al reactivar una reserva cancelada, se libera el carril anterior.
select public._parchear_funcion('agendar_clase', 'membresia_id = null where id = v_reserva_id;', 'membresia_id = null, recurso_id = null where id = v_reserva_id;', 'recurso_id = null where id = v_reserva_id', 2);
-- La lista de espera, al promover en una clase por carril, asigna el primer carril libre.
select public._parchear_funcion('promover_lista_espera', 'membresia_id = null where id = v_reserva_existente;', 'membresia_id = null, recurso_id = null where id = v_reserva_existente;', 'recurso_id = null where id = v_reserva_existente');
select public._parchear_funcion('promover_lista_espera',
  'update public.reservas set membresia_id = v_membresia_id, credito_devuelto_at = null where id = v_nueva_reserva_id;',
  'update public.reservas set membresia_id = v_membresia_id, credito_devuelto_at = null, recurso_id = (select rc.id from public.recursos rc where rc.sede_id = new.sede_id and rc.activo and exists (select 1 from public.horarios hh where hh.id = new.horario_id and hh.modo_reserva = ''carril'') and not exists (select 1 from public.reservas rx where rx.horario_id = new.horario_id and rx.fecha = new.fecha and rx.estado = ''confirmada'' and rx.recurso_id = rc.id) order by rc.orden limit 1) where id = v_nueva_reserva_id;',
  'recurso_id = (select rc.id from public.recursos rc');

drop function public._parchear_funcion(text, text, text, text, integer);

-- ───────── Reservar eligiendo carril (atómico: si el carril se ocupa, no se reserva nada) ─────────
create or replace function public.agendar_clase_carril(p_horario_id uuid, p_fecha date, p_recurso_id uuid, p_cliente_id uuid default null)
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
    v_res := public.agendar_clase(p_horario_id, p_fecha, p_cliente_id);
    v_reserva_id := (v_res->>'reserva_id')::uuid;
    update public.reservas set recurso_id = p_recurso_id where id = v_reserva_id;
  exception when unique_violation then
    perform set_config('reserveos.carril', '', true);
    raise exception 'Ese carril ya fue reservado por otra persona. Elige otro.';
  end;
  perform set_config('reserveos.carril', '', true);
  return json_build_object('ok', true, 'reserva_id', v_reserva_id, 'carril', v_r.nombre, 'pago_pendiente', coalesce((v_res->>'pago_pendiente')::boolean, false));
end $$;
revoke all on function public.agendar_clase_carril(uuid, date, uuid, uuid) from public, anon;
grant execute on function public.agendar_clase_carril(uuid, date, uuid, uuid) to authenticated;
