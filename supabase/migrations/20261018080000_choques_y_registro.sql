-- AUDITORÍA · tanda 4: HOR-03 (salas), HOR-04 (instructoras, regla simétrica), REG-01 (el registro se puede reintentar).

-- ───────── Regla única y simétrica de coincidencia de días entre clases recurrentes y puntuales ─────────
create or replace function public._horarios_coinciden_en_dia(p_fecha_a date, p_dia_a integer, p_fecha_b date, p_dia_b integer)
returns boolean language sql immutable set search_path to 'public' as $$
  select case
    when p_fecha_a is null and p_fecha_b is null then p_dia_a = p_dia_b                                   -- recurrente con recurrente
    when p_fecha_a is not null and p_fecha_b is not null then p_fecha_a = p_fecha_b                        -- puntual con puntual
    when p_fecha_a is not null then p_fecha_a >= current_date and extract(dow from p_fecha_a)::int = p_dia_b  -- puntual (A) con recurrente (B)
    else p_fecha_b >= current_date and extract(dow from p_fecha_b)::int = p_dia_a                           -- recurrente (A) con puntual (B)
  end;
$$;
revoke all on function public._horarios_coinciden_en_dia(date, integer, date, integer) from public, anon, authenticated;

-- HOR-03 / HOR-04: ni la instructora ni la sala pueden quedar en dos clases a la vez, en cualquier orden de creación.
create or replace function public._choque_horarios()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if not new.activo then return new; end if;
  if new.instructor_membership_id is not null and exists (
    select 1 from public.horarios o where o.id <> new.id and o.activo and o.instructor_membership_id = new.instructor_membership_id
      and public._horarios_coinciden_en_dia(o.fecha_especifica, o.dia_semana, new.fecha_especifica, new.dia_semana)
      and o.hora_inicio < new.hora_fin and new.hora_inicio < o.hora_fin) then
    raise exception 'La instructora ya tiene otra clase en ese horario.';
  end if;
  if new.sala_id is not null and exists (
    select 1 from public.horarios o where o.id <> new.id and o.activo and o.sala_id = new.sala_id
      and public._horarios_coinciden_en_dia(o.fecha_especifica, o.dia_semana, new.fecha_especifica, new.dia_semana)
      and o.hora_inicio < new.hora_fin and new.hora_inicio < o.hora_fin) then
    raise exception 'Esa sala ya está ocupada en ese horario.';
  end if;
  return new;
end $$;

-- ───────── REG-01 · registrar_clienta es idempotente: si la persona ya tiene su ficha, la devuelve en lugar de fallar ─────────
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

select public._parchear_funcion('registrar_clienta',
  'select email into v_email from auth.users where id = auth.uid();',
  E'select email into v_email from auth.users where id = auth.uid();\n\n  select id into v_cliente_id from public.clientes where tenant_id = p_tenant_id and user_id = auth.uid() and tutor_id is null limit 1;\n  if v_cliente_id is not null then\n    return json_build_object(''ok'', true, ''cliente_id'', v_cliente_id, ''ya_existia'', true);\n  end if;',
  'ya_existia');

drop function public._parchear_funcion(text, text, text, text, integer);
