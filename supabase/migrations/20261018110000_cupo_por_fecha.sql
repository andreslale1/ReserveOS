-- HOR-02 · Cambiar el cupo de UNA clase concreta (una fecha) sin tocar toda la serie semanal.
create table if not exists public.horario_cupo_fecha (
  horario_id uuid not null references public.horarios(id) on delete cascade,
  fecha date not null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  cupo_maximo integer not null check (cupo_maximo >= 1),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (horario_id, fecha)
);
alter table public.horario_cupo_fecha enable row level security;
drop policy if exists horario_cupo_fecha_select on public.horario_cupo_fecha;
create policy horario_cupo_fecha_select on public.horario_cupo_fecha for select to authenticated using (
  tenant_id in (select public.current_tenant_ids()) or tenant_id in (select c.tenant_id from public.clientes c where c.user_id = auth.uid()));
revoke all on public.horario_cupo_fecha from anon, authenticated;
grant select on public.horario_cupo_fecha to authenticated;

-- Cupo real de una clase en una fecha: el de esa fecha si existe, y si no el de la serie.
create or replace function public.cupos_efectivos(p_horario_ids uuid[], p_fecha date)
returns table(horario_id uuid, cupo integer)
language sql stable security definer set search_path to 'public' as $$
  select h.id, coalesce(o.cupo_maximo, h.cupo_maximo)
    from public.horarios h left join public.horario_cupo_fecha o on o.horario_id = h.id and o.fecha = p_fecha
   where h.id = any(p_horario_ids)
     and (h.tenant_id in (select public.current_tenant_ids()) or exists (select 1 from public.clientes c where c.user_id = auth.uid() and c.tenant_id = h.tenant_id));
$$;
revoke all on function public.cupos_efectivos(uuid[], date) from public, anon;
grant execute on function public.cupos_efectivos(uuid[], date) to authenticated;

create or replace function public.fijar_cupo_fecha(p_horario_id uuid, p_fecha date, p_cupo integer)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_h public.horarios; v_ocup integer;
begin
  select * into v_h from public.horarios where id = p_horario_id;
  if v_h is null then raise exception 'Horario no encontrado'; end if;
  perform public._exigir_accion(v_h.tenant_id, v_h.sede_id, 'P14');
  if not public.staff_puede_en_sede(v_h.tenant_id, v_h.sede_id, array['admin_sede','duena','gerente_general','gerente_regional','recepcion']) then raise exception 'No autorizado'; end if;
  if p_cupo is null or p_cupo < 1 then raise exception 'El cupo debe ser al menos 1'; end if;
  if not public._fecha_coincide_horario(p_horario_id, p_fecha) then raise exception 'Esa fecha no corresponde a esa clase.'; end if;
  select count(*) into v_ocup from public.reservas where horario_id = p_horario_id and fecha = p_fecha and estado = 'confirmada';
  if p_cupo < v_ocup then raise exception 'Ese día ya hay % reservas confirmadas: no puedes bajar el cupo a %. Cancela o traslada reservas primero.', v_ocup, p_cupo; end if;
  if v_h.modo_reserva = 'carril' and p_cupo > (select count(*) from public.recursos where sede_id = v_h.sede_id and activo) then
    raise exception 'La clase es por carril y la sede no tiene tantos carriles activos.';
  end if;
  if p_cupo = v_h.cupo_maximo then
    delete from public.horario_cupo_fecha where horario_id = p_horario_id and fecha = p_fecha;
  else
    insert into public.horario_cupo_fecha (horario_id, fecha, tenant_id, cupo_maximo) values (p_horario_id, p_fecha, v_h.tenant_id, p_cupo)
      on conflict (horario_id, fecha) do update set cupo_maximo = excluded.cupo_maximo, updated_at = now(), updated_by = auth.uid();
  end if;
end $$;
revoke all on function public.fijar_cupo_fecha(uuid, date, integer) from public, anon;
grant execute on function public.fijar_cupo_fecha(uuid, date, integer) to authenticated;

-- El control de cupo, la reserva y la promoción de la espera usan el cupo de ESA fecha.
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

select public._parchear_funcion('_control_cupo_reserva', 'v_cupo int; v_priv int; v_ocupadas int;', 'v_cupo int; v_priv int; v_ocupadas int; v_over int;', 'v_ocupadas int; v_over int;');
select public._parchear_funcion('_control_cupo_reserva', 'v_cupo := coalesce(v_priv, v_cupo);',
  E'select cupo_maximo into v_over from public.horario_cupo_fecha where horario_id = new.horario_id and fecha = new.fecha;\n  v_cupo := coalesce(v_priv, v_over, v_cupo);', 'coalesce(v_priv, v_over, v_cupo)');
select public._parchear_funcion('agendar_clase', 'if v_tenant_id is null then raise exception ''Horario no válido''; end if;',
  E'if v_tenant_id is null then raise exception ''Horario no válido''; end if;\n  v_cupo := coalesce((select cupo_maximo from public.horario_cupo_fecha where horario_id = p_horario_id and fecha = p_fecha), v_cupo);',
  'from public.horario_cupo_fecha where horario_id = p_horario_id');
select public._parchear_funcion('promover_lista_espera', 'select cupo_maximo, hora_inicio into v_cupo, v_hora_inicio from public.horarios where id = new.horario_id;',
  E'select cupo_maximo, hora_inicio into v_cupo, v_hora_inicio from public.horarios where id = new.horario_id;\n  v_cupo := coalesce((select cupo_maximo from public.horario_cupo_fecha where horario_id = new.horario_id and fecha = new.fecha), v_cupo);',
  'from public.horario_cupo_fecha where horario_id = new.horario_id');

drop function public._parchear_funcion(text, text, text, text, integer);
