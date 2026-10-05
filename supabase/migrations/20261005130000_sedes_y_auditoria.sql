-- P05: crear / cerrar / reabrir sedes (solo dueña y gerente general).
-- P43: el log de auditoría deja de ser legible por todo el personal; solo dueña y gerente general.

create or replace function public.crear_sede(p_tenant_id uuid, p_nombre text, p_direccion text default null, p_timezone text default 'America/Guatemala')
returns uuid
language plpgsql security definer
set search_path to 'public'
as $$
declare v_id uuid;
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then
    raise exception 'No autorizado';
  end if;
  if p_nombre is null or length(trim(p_nombre)) = 0 then raise exception 'El nombre de la sede es obligatorio'; end if;
  if not exists (select 1 from pg_timezone_names where name = p_timezone) then raise exception 'Zona horaria no válida'; end if;
  if exists (select 1 from public.sedes where tenant_id = p_tenant_id and lower(name) = lower(trim(p_nombre))) then
    raise exception 'Ya existe una sede con ese nombre';
  end if;
  insert into public.sedes (tenant_id, name, address, timezone)
    values (p_tenant_id, trim(p_nombre), nullif(trim(coalesce(p_direccion, '')), ''), p_timezone)
    returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.crear_sede(uuid, text, text, text) from public;
grant execute on function public.crear_sede(uuid, text, text, text) to authenticated;

create or replace function public.cerrar_sede(p_sede_id uuid)
returns void
language plpgsql security definer
set search_path to 'public'
as $$
declare v_s record; v_activas integer;
begin
  select * into v_s from public.sedes where id = p_sede_id;
  if v_s is null then raise exception 'Sede no encontrada'; end if;
  if not public.tengo_rol_en_tenant(v_s.tenant_id, array['duena','gerente_general']) then
    raise exception 'No autorizado';
  end if;
  select count(*) into v_activas from public.sedes where tenant_id = v_s.tenant_id and status = 'activa';
  if v_activas <= 1 and v_s.status = 'activa' then raise exception 'No puedes cerrar la única sede activa'; end if;
  if exists (select 1 from public.reservas where sede_id = p_sede_id and estado = 'confirmada'
             and fecha >= public.hoy_en_sede(p_sede_id)) then
    raise exception 'Hay reservas futuras en esta sede; cancélalas o muévelas antes de cerrarla';
  end if;
  update public.sedes set status = 'cerrada' where id = p_sede_id;
  update public.horarios set activo = false where sede_id = p_sede_id;
end;
$$;
revoke all on function public.cerrar_sede(uuid) from public;
grant execute on function public.cerrar_sede(uuid) to authenticated;

create or replace function public.reabrir_sede(p_sede_id uuid)
returns void
language plpgsql security definer
set search_path to 'public'
as $$
declare v_s record;
begin
  select * into v_s from public.sedes where id = p_sede_id;
  if v_s is null then raise exception 'Sede no encontrada'; end if;
  if not public.tengo_rol_en_tenant(v_s.tenant_id, array['duena','gerente_general']) then
    raise exception 'No autorizado';
  end if;
  update public.sedes set status = 'activa' where id = p_sede_id;
end;
$$;
revoke all on function public.reabrir_sede(uuid) from public;
grant execute on function public.reabrir_sede(uuid) to authenticated;

-- La política de select del log dependía solo de pertenecer al tenant.
drop policy if exists admin_acciones_log_select on public.admin_acciones_log;
create policy admin_acciones_log_select on public.admin_acciones_log for select
  using (public.tengo_rol_en_tenant(tenant_id, array['duena','gerente_general']));
