-- P13 de la matriz: "Crear / cambiar horarios semanales" -- hueco todavía más fundamental que
-- paquetes: sin esto un estudio nuevo no puede ni programar su primera clase desde el panel.
-- Bloquea el conflicto documentado en el maestro (sección 6/8 y bug de clase): una instructora no
-- puede quedar en dos clases que se traslapan el mismo día de la semana, sin importar la sede.

create or replace function public.crear_horario(
  p_tenant_id uuid,
  p_sede_id uuid,
  p_dia_semana integer,
  p_hora_inicio time,
  p_hora_fin time,
  p_nombre_clase text,
  p_cupo_maximo integer default 6,
  p_instructor_membership_id uuid default null,
  p_categoria text default 'regular'
)
returns public.horarios
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_row public.horarios;
begin
  if not public.staff_puede_en_sede(p_tenant_id, p_sede_id, array['duena','gerente_general','admin_sede']) then
    raise exception 'No autorizado';
  end if;
  if p_dia_semana < 0 or p_dia_semana > 6 then raise exception 'Día de la semana inválido'; end if;
  if p_hora_fin <= p_hora_inicio then raise exception 'La hora de fin debe ser después de la de inicio'; end if;
  if p_cupo_maximo < 1 then raise exception 'El cupo debe ser al menos 1'; end if;

  if p_instructor_membership_id is not null then
    if not exists (
      select 1 from public.tenant_memberships
      where id = p_instructor_membership_id and tenant_id = p_tenant_id and role = 'instructora'
    ) then
      raise exception 'Esa persona no es instructora de este estudio';
    end if;
    if exists (
      select 1 from public.horarios h
      where h.instructor_membership_id = p_instructor_membership_id
        and h.dia_semana = p_dia_semana and h.activo = true
        and h.hora_inicio < p_hora_fin and h.hora_fin > p_hora_inicio
    ) then
      raise exception 'Esa instructora ya tiene otra clase que se traslapa ese día y hora';
    end if;
  end if;

  insert into public.horarios (tenant_id, sede_id, instructor_membership_id, dia_semana, hora_inicio, hora_fin, cupo_maximo, nombre_clase, categoria)
  values (p_tenant_id, p_sede_id, p_instructor_membership_id, p_dia_semana, p_hora_inicio, p_hora_fin, p_cupo_maximo, trim(p_nombre_clase), p_categoria)
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.crear_horario(uuid, uuid, integer, time, time, text, integer, uuid, text) from public;
grant execute on function public.crear_horario(uuid, uuid, integer, time, time, text, integer, uuid, text) to authenticated;

create or replace function public.actualizar_horario(
  p_horario_id uuid,
  p_activo boolean default null,
  p_cupo_maximo integer default null,
  p_instructor_membership_id uuid default null
)
returns public.horarios
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_h public.horarios;
  v_row public.horarios;
begin
  select * into v_h from public.horarios where id = p_horario_id;
  if v_h is null then raise exception 'Horario no encontrado'; end if;
  if not public.staff_puede_en_sede(v_h.tenant_id, v_h.sede_id, array['duena','gerente_general','admin_sede']) then
    raise exception 'No autorizado';
  end if;
  if p_cupo_maximo is not null and p_cupo_maximo < 1 then raise exception 'El cupo debe ser al menos 1'; end if;

  update public.horarios set
    activo = coalesce(p_activo, activo),
    cupo_maximo = coalesce(p_cupo_maximo, cupo_maximo),
    instructor_membership_id = case when p_instructor_membership_id is not null then p_instructor_membership_id else instructor_membership_id end
  where id = p_horario_id
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.actualizar_horario(uuid, boolean, integer, uuid) from public;
grant execute on function public.actualizar_horario(uuid, boolean, integer, uuid) to authenticated;
