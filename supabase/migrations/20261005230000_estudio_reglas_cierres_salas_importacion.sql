-- ST-01 / ST-02 / ST-04: reglas de reserva configurables por estudio, feriados y cierres por sede, salas con
-- detección de choques (sala e instructora), e importación de clientas con detección de duplicados.

-- ---------- Reglas de reserva ----------
alter table public.configuracion_reservas
  add column if not exists cancelacion_tardia_devuelve_credito boolean not null default false,
  add column if not exists anticipacion_maxima_dias integer not null default 14 check (anticipacion_maxima_dias between 1 and 365),
  add column if not exists max_reservas_dia_por_clienta integer check (max_reservas_dia_por_clienta is null or max_reservas_dia_por_clienta >= 1);

create or replace function public.guardar_reglas_reservas(p_tenant_id uuid, p_horas_cancelacion integer, p_horas_confirmacion integer,
  p_devuelve_credito boolean, p_anticipacion_dias integer, p_max_por_dia integer)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then raise exception 'No autorizado'; end if;
  if p_horas_cancelacion < 0 or p_horas_cancelacion > 72 then raise exception 'Las horas de cancelación deben estar entre 0 y 72'; end if;
  if p_horas_confirmacion < 0 or p_horas_confirmacion > 24 then raise exception 'Las horas de confirmación deben estar entre 0 y 24'; end if;
  if p_anticipacion_dias < 1 or p_anticipacion_dias > 365 then raise exception 'La anticipación máxima debe estar entre 1 y 365 días'; end if;
  insert into public.configuracion_reservas (tenant_id, horas_minimas_cancelacion, horas_minimas_confirmacion,
      cancelacion_tardia_devuelve_credito, anticipacion_maxima_dias, max_reservas_dia_por_clienta, updated_at)
    values (p_tenant_id, p_horas_cancelacion, p_horas_confirmacion, p_devuelve_credito, p_anticipacion_dias, p_max_por_dia, now())
  on conflict (tenant_id) do update set horas_minimas_cancelacion = excluded.horas_minimas_cancelacion,
    horas_minimas_confirmacion = excluded.horas_minimas_confirmacion, cancelacion_tardia_devuelve_credito = excluded.cancelacion_tardia_devuelve_credito,
    anticipacion_maxima_dias = excluded.anticipacion_maxima_dias, max_reservas_dia_por_clienta = excluded.max_reservas_dia_por_clienta, updated_at = now();
end $$;
revoke all on function public.guardar_reglas_reservas(uuid, integer, integer, boolean, integer, integer) from public;
grant execute on function public.guardar_reglas_reservas(uuid, integer, integer, boolean, integer, integer) to authenticated;

-- La cancelación tardía puede o no devolver el crédito, según la política del estudio.
create or replace function public.cancelar_mi_reserva(p_reserva_id uuid)
returns json language plpgsql security definer set search_path to 'public' as $$
declare
  v_reserva record; v_tenant_id uuid; v_propio_id uuid; v_horas_minimas int; v_horas_faltantes numeric; v_es_tardia boolean; v_devuelve boolean;
begin
  select r.*, h.hora_inicio into v_reserva from public.reservas r join public.horarios h on h.id = r.horario_id
    where r.id = p_reserva_id and r.estado = 'confirmada';
  if v_reserva is null then raise exception 'Reserva no encontrada'; end if;
  v_tenant_id := v_reserva.tenant_id;
  v_propio_id := public.mi_cliente_id(v_tenant_id);
  if v_propio_id is null or (v_reserva.cliente_id <> v_propio_id
      and v_reserva.cliente_id not in (select id from public.clientes where tutor_id = v_propio_id and tenant_id = v_tenant_id)) then
    raise exception 'Reserva no encontrada';
  end if;
  select horas_minimas_cancelacion, cancelacion_tardia_devuelve_credito into v_horas_minimas, v_devuelve
    from public.configuracion_reservas where tenant_id = v_tenant_id;
  v_horas_minimas := coalesce(v_horas_minimas, 2);
  v_devuelve := coalesce(v_devuelve, false);
  v_horas_faltantes := extract(epoch from ((v_reserva.fecha + v_reserva.hora_inicio) - public.ahora_en_sede(v_reserva.sede_id))) / 3600;
  v_es_tardia := v_horas_faltantes < v_horas_minimas;
  update public.reservas set estado = 'cancelada', penalizada = v_es_tardia where id = p_reserva_id;
  if v_reserva.tipo = 'regular' and (not v_es_tardia or v_devuelve) then
    perform public.devolver_clase_a_membresia(v_reserva.cliente_id);
  end if;
  return json_build_object('ok', true, 'penalizada', v_es_tardia and not v_devuelve, 'horas_minimas', v_horas_minimas);
end $$;

-- ---------- Feriados y cierres por sede ----------
create table if not exists public.sede_cierres (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sede_id uuid references public.sedes(id) on delete cascade,   -- null = todas las sedes
  desde date not null,
  hasta date not null,
  motivo text not null,
  created_at timestamptz not null default now(),
  check (hasta >= desde)
);
alter table public.sede_cierres enable row level security;
create policy sede_cierres_select on public.sede_cierres for select using (tenant_id in (select public.current_tenant_ids()));
revoke all on public.sede_cierres from anon, authenticated;
grant select on public.sede_cierres to authenticated;

create or replace function public.cerrar_fechas(p_tenant_id uuid, p_sede_id uuid, p_desde date, p_hasta date, p_motivo text)
returns json language plpgsql security definer set search_path to 'public' as $$
declare v_h record; v_d date; v_n int := 0; v_r record;
begin
  if p_sede_id is null then
    if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then raise exception 'Cerrar todas las sedes solo lo hace la dueña o gerente general'; end if;
  elsif not public.staff_puede_en_sede(p_tenant_id, p_sede_id, array['duena','gerente_general','admin_sede']) then
    raise exception 'No autorizado';
  end if;
  if p_motivo is null or length(trim(p_motivo)) < 3 then raise exception 'Escribe el motivo (feriado, remodelación…)'; end if;
  if p_hasta < p_desde then raise exception 'La fecha final no puede ser anterior a la inicial'; end if;
  if p_hasta - p_desde > 90 then raise exception 'Un cierre no puede durar más de 90 días'; end if;
  if p_sede_id is not null and not exists (select 1 from public.sedes where id = p_sede_id and tenant_id = p_tenant_id) then raise exception 'Sede no válida'; end if;
  insert into public.sede_cierres (tenant_id, sede_id, desde, hasta, motivo) values (p_tenant_id, p_sede_id, p_desde, p_hasta, trim(p_motivo));
  -- Cancela clases y reservas de esos días, devolviendo la clase a cada paquete.
  for v_d in select generate_series(greatest(p_desde, current_date), p_hasta)::date loop
    for v_h in select h.* from public.horarios h where h.tenant_id = p_tenant_id and h.activo
        and (p_sede_id is null or h.sede_id = p_sede_id)
        and ((h.fecha_especifica is null and h.dia_semana = extract(dow from v_d)::int) or h.fecha_especifica = v_d) loop
      insert into public.horario_cancelaciones (tenant_id, horario_id, fecha) values (p_tenant_id, v_h.id, v_d) on conflict (horario_id, fecha) do nothing;
      for v_r in select * from public.reservas where horario_id = v_h.id and fecha = v_d and estado = 'confirmada' loop
        update public.reservas set estado = 'cancelada' where id = v_r.id;
        if v_r.tipo = 'regular' then perform public.devolver_clase_a_membresia(v_r.cliente_id); end if;
        v_n := v_n + 1;
      end loop;
    end loop;
  end loop;
  return json_build_object('ok', true, 'reservas_canceladas', v_n);
end $$;
revoke all on function public.cerrar_fechas(uuid, uuid, date, date, text) from public;
grant execute on function public.cerrar_fechas(uuid, uuid, date, date, text) to authenticated;

create or replace function public.quitar_cierre(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v record;
begin
  select * into v from public.sede_cierres where id = p_id;
  if v is null then raise exception 'Cierre no encontrado'; end if;
  if v.sede_id is null then
    if not public.tengo_rol_en_tenant(v.tenant_id, array['duena','gerente_general']) then raise exception 'No autorizado'; end if;
  elsif not public.staff_puede_en_sede(v.tenant_id, v.sede_id, array['duena','gerente_general','admin_sede']) then raise exception 'No autorizado'; end if;
  delete from public.horario_cancelaciones hc using public.horarios h
    where hc.horario_id = h.id and h.tenant_id = v.tenant_id and (v.sede_id is null or h.sede_id = v.sede_id) and hc.fecha between v.desde and v.hasta;
  delete from public.sede_cierres where id = p_id;
end $$;
revoke all on function public.quitar_cierre(uuid) from public;
grant execute on function public.quitar_cierre(uuid) to authenticated;

-- ---------- Salas y choques de horario ----------
create table if not exists public.salas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sede_id uuid not null references public.sedes(id) on delete cascade,
  nombre text not null,
  capacidad integer not null default 6 check (capacidad >= 1),
  equipamiento text,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  unique (sede_id, nombre)
);
alter table public.salas enable row level security;
create policy salas_select on public.salas for select using (tenant_id in (select public.current_tenant_ids()));
revoke all on public.salas from anon, authenticated;
grant select on public.salas to authenticated;
alter table public.horarios add column if not exists sala_id uuid references public.salas(id) on delete set null;

create or replace function public.sala_guardar(p_id uuid, p_sede_id uuid, p_nombre text, p_capacidad integer, p_equipamiento text, p_activa boolean)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_t uuid; v_id uuid;
begin
  select tenant_id into v_t from public.sedes where id = p_sede_id;
  if v_t is null then raise exception 'Sede no válida'; end if;
  if not public.staff_puede_en_sede(v_t, p_sede_id, array['duena','gerente_general','admin_sede']) then raise exception 'No autorizado'; end if;
  if p_nombre is null or length(trim(p_nombre)) = 0 then raise exception 'El nombre de la sala es obligatorio'; end if;
  if p_id is null then
    insert into public.salas (tenant_id, sede_id, nombre, capacidad, equipamiento) values (v_t, p_sede_id, trim(p_nombre), p_capacidad, p_equipamiento) returning id into v_id;
  else
    update public.salas set nombre = trim(p_nombre), capacidad = p_capacidad, equipamiento = p_equipamiento, activa = coalesce(p_activa, true)
      where id = p_id and sede_id = p_sede_id returning id into v_id;
    if v_id is null then raise exception 'Sala no encontrada'; end if;
  end if;
  return v_id;
end $$;
revoke all on function public.sala_guardar(uuid, uuid, text, integer, text, boolean) from public;
grant execute on function public.sala_guardar(uuid, uuid, text, integer, text, boolean) to authenticated;

create or replace function public.asignar_sala_horario(p_horario_id uuid, p_sala_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_h record;
begin
  select * into v_h from public.horarios where id = p_horario_id;
  if v_h is null then raise exception 'Horario no encontrado'; end if;
  if not public.staff_puede_en_sede(v_h.tenant_id, v_h.sede_id, array['duena','gerente_general','admin_sede']) then raise exception 'No autorizado'; end if;
  if p_sala_id is not null and not exists (select 1 from public.salas where id = p_sala_id and sede_id = v_h.sede_id) then raise exception 'Esa sala no pertenece a la sede de la clase'; end if;
  update public.horarios set sala_id = p_sala_id where id = p_horario_id;
end $$;
revoke all on function public.asignar_sala_horario(uuid, uuid) from public;
grant execute on function public.asignar_sala_horario(uuid, uuid) to authenticated;

-- Una instructora no puede dar dos clases a la vez (aunque sea en sedes distintas) y una sala no puede tener dos clases solapadas.
create or replace function public._choque_horarios()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if not new.activo then return new; end if;
  if new.instructor_membership_id is not null and exists (
    select 1 from public.horarios o where o.id <> new.id and o.activo and o.instructor_membership_id = new.instructor_membership_id
      and ((o.fecha_especifica is null and new.fecha_especifica is null and o.dia_semana = new.dia_semana)
           or (o.fecha_especifica is not distinct from new.fecha_especifica and new.fecha_especifica is not null)
           or (o.fecha_especifica is null and new.fecha_especifica is not null and o.dia_semana = extract(dow from new.fecha_especifica)::int)
           or (o.fecha_especifica is not null and new.fecha_especifica is null and new.dia_semana = extract(dow from o.fecha_especifica)::int and false))
      and o.hora_inicio < new.hora_fin and new.hora_inicio < o.hora_fin) then
    raise exception 'La instructora ya tiene otra clase en ese horario.';
  end if;
  if new.sala_id is not null and exists (
    select 1 from public.horarios o where o.id <> new.id and o.activo and o.sala_id = new.sala_id
      and ((o.fecha_especifica is null and new.fecha_especifica is null and o.dia_semana = new.dia_semana)
           or (o.fecha_especifica is not distinct from new.fecha_especifica and new.fecha_especifica is not null))
      and o.hora_inicio < new.hora_fin and new.hora_inicio < o.hora_fin) then
    raise exception 'Esa sala ya está ocupada en ese horario.';
  end if;
  return new;
end $$;
drop trigger if exists horarios_choques on public.horarios;
create trigger horarios_choques before insert or update of instructor_membership_id, sala_id, dia_semana, hora_inicio, hora_fin, fecha_especifica, activo on public.horarios
  for each row execute function public._choque_horarios();

-- ---------- Reglas al reservar: anticipación, tope diario, cierres ----------
create or replace function public._reglas_reserva()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_cfg record; v_hoy date; v_n int; v_sede uuid;
begin
  if new.estado <> 'confirmada' then return new; end if;
  if tg_op = 'UPDATE' and old.estado = 'confirmada' and old.fecha = new.fecha and old.horario_id = new.horario_id then return new; end if;
  v_sede := new.sede_id;
  if exists (select 1 from public.sede_cierres c where c.tenant_id = new.tenant_id and (c.sede_id is null or c.sede_id = v_sede) and new.fecha between c.desde and c.hasta) then
    raise exception 'La sede está cerrada ese día (%).', (select motivo from public.sede_cierres c where c.tenant_id = new.tenant_id and (c.sede_id is null or c.sede_id = v_sede) and new.fecha between c.desde and c.hasta limit 1);
  end if;
  select * into v_cfg from public.configuracion_reservas where tenant_id = new.tenant_id;
  v_hoy := public.hoy_en_sede(v_sede);
  -- La anticipación máxima solo aplica a la propia clienta; el personal puede agendar más adelante.
  if v_cfg.anticipacion_maxima_dias is not null and new.fecha > v_hoy + v_cfg.anticipacion_maxima_dias
     and new.cliente_id in (select id from public.clientes where user_id = auth.uid()) then
    raise exception 'Solo puedes reservar con hasta % días de anticipación.', v_cfg.anticipacion_maxima_dias;
  end if;
  if v_cfg.max_reservas_dia_por_clienta is not null and new.tipo = 'regular' then
    select count(*) into v_n from public.reservas r where r.cliente_id = new.cliente_id and r.fecha = new.fecha and r.estado = 'confirmada' and r.tipo = 'regular' and r.id <> new.id;
    if v_n >= v_cfg.max_reservas_dia_por_clienta then raise exception 'Alcanzaste el máximo de % reserva(s) por día.', v_cfg.max_reservas_dia_por_clienta; end if;
  end if;
  return new;
end $$;
drop trigger if exists reservas_reglas on public.reservas;
create trigger reservas_reglas before insert or update of estado, fecha, horario_id on public.reservas for each row execute function public._reglas_reserva();

-- ---------- Importación de clientas ----------
create or replace function public._tel_norm(p text)
returns text language sql immutable as $$
  select case when length(d) = 11 and d like '502%' then substr(d, 4) else d end from (select regexp_replace(coalesce(p,''), '[^0-9]', '', 'g') d) x
$$;

create or replace function public.importar_clientes(p_tenant_id uuid, p_filas jsonb, p_solo_validar boolean default false)
returns json language plpgsql security definer set search_path to 'public' as $$
declare
  f jsonb; i int := 0; v_nom text; v_tel text; v_mail text; v_ok int := 0; v_dup int := 0; v_err jsonb := '[]'::jsonb; v_motivo text;
  v_vistos_tel text[] := '{}'; v_vistos_mail text[] := '{}';
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','admin_sede','recepcion']) then raise exception 'No autorizado'; end if;
  if jsonb_typeof(p_filas) <> 'array' then raise exception 'Formato no válido'; end if;
  if jsonb_array_length(p_filas) > 2000 then raise exception 'Máximo 2000 filas por importación'; end if;
  for f in select * from jsonb_array_elements(p_filas) loop
    i := i + 1;
    v_nom := trim(coalesce(f->>'nombre','')); v_tel := trim(coalesce(f->>'telefono','')); v_mail := lower(trim(coalesce(f->>'email','')));
    v_motivo := null;
    if v_nom = '' then v_motivo := 'Falta el nombre';
    elsif length(public._tel_norm(v_tel)) < 7 then v_motivo := 'Teléfono no válido';
    elsif v_mail <> '' and v_mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then v_motivo := 'Correo no válido';
    elsif public._tel_norm(v_tel) = any(v_vistos_tel) then v_motivo := 'Teléfono repetido en el archivo';
    elsif v_mail <> '' and v_mail = any(v_vistos_mail) then v_motivo := 'Correo repetido en el archivo';
    elsif exists (select 1 from public.clientes c where c.tenant_id = p_tenant_id and c.tutor_id is null and public._tel_norm(c.telefono) = public._tel_norm(v_tel)) then v_motivo := 'Ya existe una clienta con ese teléfono';
    elsif v_mail <> '' and exists (select 1 from public.clientes c where c.tenant_id = p_tenant_id and lower(c.email) = v_mail) then v_motivo := 'Ya existe una clienta con ese correo';
    end if;
    if v_motivo is not null then
      if v_motivo like 'Ya existe%' or v_motivo like '%repetido%' then v_dup := v_dup + 1; end if;
      v_err := v_err || jsonb_build_array(jsonb_build_object('fila', i, 'nombre', v_nom, 'motivo', v_motivo));
      continue;
    end if;
    v_vistos_tel := v_vistos_tel || public._tel_norm(v_tel);
    if v_mail <> '' then v_vistos_mail := v_vistos_mail || v_mail; end if;
    if not p_solo_validar then
      insert into public.clientes (tenant_id, nombre, telefono, email) values (p_tenant_id, v_nom, v_tel, nullif(v_mail,''));
    end if;
    v_ok := v_ok + 1;
  end loop;
  return json_build_object('validas', v_ok, 'duplicadas', v_dup, 'con_error', jsonb_array_length(v_err), 'errores', v_err, 'importadas', case when p_solo_validar then 0 else v_ok end);
end $$;
revoke all on function public.importar_clientes(uuid, jsonb, boolean) from public;
grant execute on function public.importar_clientes(uuid, jsonb, boolean) to authenticated;
