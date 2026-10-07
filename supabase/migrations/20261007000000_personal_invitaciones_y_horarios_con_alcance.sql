-- Cierre de la matriz sobre personal y horarios (P06, P08, P13).
-- Reglas:
--  * Quién puede invitar/asignar a quién (jerarquía) y solo dentro de sus propias sedes.
--  * Nadie amplía su propio alcance (solo dueña y gerencia general pueden tocar el de cualquiera).
--  * Cada sede indicada debe pertenecer al estudio y estar activa.
--  * La instructora de una clase debe estar asignada a la sede de esa clase.

create or replace function public._rango_rol(p_rol text)
returns integer language sql immutable as $$
  select case p_rol when 'duena' then 100 when 'gerente_general' then 90 when 'gerente_regional' then 70 when 'admin_sede' then 60
    when 'contadora' then 40 when 'recepcion' then 30 when 'instructora' then 30 when 'marketing' then 30 else 0 end
$$;
-- Roles que trabajan en sedes concretas (los demás son de todo el estudio).
create or replace function public._rol_de_sede(p_rol text)
returns boolean language sql immutable as $$ select p_rol in ('gerente_regional','admin_sede','recepcion','instructora') $$;

create or replace function public._mis_sedes_asignadas(p_tenant_id uuid)
returns uuid[] language sql stable security definer set search_path to 'public' as $$
  select coalesce(array_agg(ss.sede_id), '{}')
  from public.tenant_memberships tm join public.staff_sedes ss on ss.tenant_membership_id = tm.id
  where tm.user_id = auth.uid() and tm.tenant_id = p_tenant_id;
$$;
revoke all on function public._rango_rol(text), public._rol_de_sede(text), public._mis_sedes_asignadas(uuid) from public;
grant execute on function public._rango_rol(text), public._rol_de_sede(text), public._mis_sedes_asignadas(uuid) to authenticated;

-- ¿Puede quien llama invitar/asignar a un rol dado en las sedes dadas?
create or replace function public._validar_alcance_personal(p_tenant_id uuid, p_rol_objetivo text, p_sede_ids uuid[])
returns void language plpgsql stable security definer set search_path to 'public' as $$
declare v_mi_rol text; v_s uuid; v_mis uuid[];
begin
  select role into v_mi_rol from public.tenant_memberships where user_id = auth.uid() and tenant_id = p_tenant_id limit 1;
  if v_mi_rol is null then raise exception 'No autorizado'; end if;
  if v_mi_rol not in ('duena','gerente_general','gerente_regional','admin_sede') then raise exception 'No autorizado'; end if;
  if p_rol_objetivo = 'duena' then raise exception 'Rol inválido'; end if;
  -- Solo se puede invitar/asignar a un rol de menor rango que el propio (la dueña y la gerencia general, a cualquiera).
  if v_mi_rol not in ('duena','gerente_general') then
    if public._rango_rol(p_rol_objetivo) >= public._rango_rol(v_mi_rol) then
      raise exception 'Con tu rol no puedes invitar ni asignar a ese rol.';
    end if;
    -- Los roles de todo el estudio (contabilidad, marketing) los define solo la dueña o la gerencia general.
    if not public._rol_de_sede(p_rol_objetivo) then raise exception 'Ese rol lo define la dueña o la gerencia general.'; end if;
  end if;
  if public._rol_de_sede(p_rol_objetivo) and (p_sede_ids is null or cardinality(p_sede_ids) = 0) then
    raise exception 'Indica al menos una sede para ese rol.';
  end if;
  if p_sede_ids is not null then
    foreach v_s in array p_sede_ids loop
      if not exists (select 1 from public.sedes where id = v_s and tenant_id = p_tenant_id and status = 'activa') then
        raise exception 'Una de las sedes no existe o no pertenece a este estudio.';
      end if;
    end loop;
    if v_mi_rol not in ('duena','gerente_general') then
      v_mis := public._mis_sedes_asignadas(p_tenant_id);
      foreach v_s in array p_sede_ids loop
        if not (v_s = any(v_mis)) then raise exception 'Solo puedes asignar sedes que tú misma tienes.'; end if;
      end loop;
    end if;
  end if;
end $$;
revoke all on function public._validar_alcance_personal(uuid, text, uuid[]) from public;

create or replace function public.crear_invitacion_personal(p_tenant_id uuid, p_email text, p_role text, p_nombre text, p_sede_ids uuid[] default '{}'::uuid[])
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_token uuid; v_sedes uuid[];
begin
  perform public._exigir_accion(p_tenant_id, null::uuid, 'P06');
  if p_role not in ('gerente_general','gerente_regional','admin_sede','recepcion','instructora','contadora','marketing') then raise exception 'Rol inválido'; end if;
  if p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Escribe un correo válido'; end if;
  if p_nombre is null or length(trim(p_nombre)) < 2 then raise exception 'Escribe el nombre de la persona'; end if;
  -- Los roles de todo el estudio no llevan sedes.
  v_sedes := case when public._rol_de_sede(p_role) then coalesce(p_sede_ids, '{}') else '{}' end;
  perform public._validar_alcance_personal(p_tenant_id, p_role, v_sedes);
  if exists (select 1 from public.tenant_memberships tm join auth.users u on u.id = tm.user_id where tm.tenant_id = p_tenant_id and lower(u.email) = lower(p_email)) then
    raise exception 'Ya hay alguien con ese correo en el equipo de este estudio';
  end if;
  insert into public.invitaciones_personal (tenant_id, email, role, nombre, sede_ids, creado_por)
    values (p_tenant_id, lower(trim(p_email)), p_role, trim(p_nombre), v_sedes, auth.uid()) returning token into v_token;
  return v_token;
end $$;

-- Defensa en el canje: aunque la invitación se haya alterado, solo se asignan sedes del propio estudio.
create or replace function public.reclamar_invitacion_personal(p_token uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_inv record; v_mi_email text; v_membership_id uuid; v_sede uuid;
begin
  select * into v_inv from public.invitaciones_personal where token = p_token for update;
  if v_inv is null then raise exception 'Invitación no encontrada'; end if;
  if v_inv.usado then raise exception 'Esta invitación ya fue usada'; end if;
  select email into v_mi_email from auth.users where id = auth.uid();
  if v_mi_email is null or lower(v_mi_email) <> v_inv.email then raise exception 'Esta invitación es para otro correo'; end if;
  insert into public.tenant_memberships (tenant_id, user_id, role, nombre) values (v_inv.tenant_id, auth.uid(), v_inv.role, v_inv.nombre) returning id into v_membership_id;
  if public._rol_de_sede(v_inv.role) then
    foreach v_sede in array coalesce(v_inv.sede_ids, '{}') loop
      if exists (select 1 from public.sedes where id = v_sede and tenant_id = v_inv.tenant_id) then
        insert into public.staff_sedes (tenant_membership_id, sede_id) values (v_membership_id, v_sede) on conflict do nothing;
      end if;
    end loop;
  end if;
  update public.invitaciones_personal set usado = true where id = v_inv.id;
  return v_inv.tenant_id;
end $$;

create or replace function public.asignar_sede_personal(p_tenant_membership_id uuid, p_sede_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_t uuid; v_rol_obj text; v_mi_id uuid; v_mi_rol text;
begin
  select tenant_id, role into v_t, v_rol_obj from public.tenant_memberships where id = p_tenant_membership_id;
  if v_t is null then raise exception 'Miembro de personal no encontrado'; end if;
  perform public._exigir_accion(v_t, null::uuid, 'P06');
  select id, role into v_mi_id, v_mi_rol from public.tenant_memberships where user_id = auth.uid() and tenant_id = v_t limit 1;
  if v_mi_id = p_tenant_membership_id and v_mi_rol not in ('duena','gerente_general') then raise exception 'No puedes ampliar tu propio alcance. Pídeselo a la dueña o a la gerencia general.'; end if;
  if not public._rol_de_sede(v_rol_obj) then raise exception 'Ese rol trabaja en todo el estudio; no se le asignan sedes.'; end if;
  perform public._validar_alcance_personal(v_t, v_rol_obj, array[p_sede_id]);
  insert into public.staff_sedes (tenant_membership_id, sede_id) values (p_tenant_membership_id, p_sede_id) on conflict do nothing;
end $$;

create or replace function public.quitar_sede_personal(p_tenant_membership_id uuid, p_sede_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_t uuid; v_rol_obj text; v_mi_id uuid; v_mi_rol text; v_quedan int; v_clases int;
begin
  select tenant_id, role into v_t, v_rol_obj from public.tenant_memberships where id = p_tenant_membership_id;
  if v_t is null then raise exception 'Miembro de personal no encontrado'; end if;
  perform public._exigir_accion(v_t, null::uuid, 'P06');
  select id, role into v_mi_id, v_mi_rol from public.tenant_memberships where user_id = auth.uid() and tenant_id = v_t limit 1;
  if v_mi_id = p_tenant_membership_id and v_mi_rol not in ('duena','gerente_general') then raise exception 'No puedes modificar tu propio alcance. Pídeselo a la dueña o a la gerencia general.'; end if;
  perform public._validar_alcance_personal(v_t, v_rol_obj, array[p_sede_id]);
  select count(*) into v_clases from public.horarios where instructor_membership_id = p_tenant_membership_id and sede_id = p_sede_id and activo;
  if v_clases > 0 then raise exception 'Esa instructora todavía tiene % clase(s) activas en esa sede. Reasígnalas primero.', v_clases; end if;
  delete from public.staff_sedes where tenant_membership_id = p_tenant_membership_id and sede_id = p_sede_id;
end $$;

-- ---------- Horarios: la instructora debe trabajar en la sede de la clase ----------
create or replace function public._validar_instructora_sede(p_tenant_id uuid, p_sede_id uuid, p_instructor uuid)
returns void language plpgsql stable security definer set search_path to 'public' as $$
begin
  if p_instructor is null then return; end if;
  if not exists (select 1 from public.tenant_memberships where id = p_instructor and tenant_id = p_tenant_id and role = 'instructora') then
    raise exception 'Esa persona no es instructora de este estudio';
  end if;
  if not exists (select 1 from public.staff_sedes where tenant_membership_id = p_instructor and sede_id = p_sede_id) then
    raise exception 'Esa instructora no está asignada a esta sede. Asígnala primero en Personal.';
  end if;
end $$;
revoke all on function public._validar_instructora_sede(uuid, uuid, uuid) from public;

create or replace function public.crear_horario(p_tenant_id uuid, p_sede_id uuid, p_dia_semana integer, p_hora_inicio time, p_hora_fin time, p_nombre_clase text,
  p_cupo_maximo integer default 6, p_instructor_membership_id uuid default null, p_categoria text default 'regular')
returns public.horarios language plpgsql security definer set search_path to 'public' as $$
declare v_row public.horarios;
begin
  perform public._exigir_accion(p_tenant_id, p_sede_id, 'P13');
  if not public.staff_puede_en_sede(p_tenant_id, p_sede_id, array['duena','gerente_general','admin_sede']) then raise exception 'No autorizado'; end if;
  if not exists (select 1 from public.sedes where id = p_sede_id and tenant_id = p_tenant_id and status = 'activa') then raise exception 'Sede no válida'; end if;
  if p_dia_semana < 0 or p_dia_semana > 6 then raise exception 'Día de la semana inválido'; end if;
  if p_hora_fin <= p_hora_inicio then raise exception 'La hora de fin debe ser después de la de inicio'; end if;
  if p_cupo_maximo < 1 then raise exception 'El cupo debe ser al menos 1'; end if;
  perform public._validar_instructora_sede(p_tenant_id, p_sede_id, p_instructor_membership_id);
  insert into public.horarios (tenant_id, sede_id, instructor_membership_id, dia_semana, hora_inicio, hora_fin, cupo_maximo, nombre_clase, categoria)
    values (p_tenant_id, p_sede_id, p_instructor_membership_id, p_dia_semana, p_hora_inicio, p_hora_fin, p_cupo_maximo, trim(p_nombre_clase), p_categoria)
    returning * into v_row;   -- el disparador _choque_horarios bloquea clases incompatibles de la instructora (en cualquier sede) y de la sala
  return v_row;
end $$;

create or replace function public.actualizar_horario(p_horario_id uuid, p_activo boolean default null, p_cupo_maximo integer default null, p_instructor_membership_id uuid default null)
returns public.horarios language plpgsql security definer set search_path to 'public' as $$
declare v_h public.horarios; v_row public.horarios;
begin
  select * into v_h from public.horarios where id = p_horario_id;
  if v_h is null then raise exception 'Horario no encontrado'; end if;
  perform public._exigir_accion(v_h.tenant_id, v_h.sede_id, 'P14');
  if not public.staff_puede_en_sede(v_h.tenant_id, v_h.sede_id, array['admin_sede','duena','gerente_general','gerente_regional','recepcion']) then raise exception 'No autorizado'; end if;
  if p_cupo_maximo is not null and p_cupo_maximo < 1 then raise exception 'El cupo debe ser al menos 1'; end if;
  if p_instructor_membership_id is not null then
    -- Cambiar de instructora es un cambio de agenda (P13), no de cupo: solo quien administra horarios.
    if not public.staff_puede_en_sede(v_h.tenant_id, v_h.sede_id, array['admin_sede','duena','gerente_general']) then raise exception 'Solo quien administra horarios puede cambiar la instructora.'; end if;
    perform public._validar_instructora_sede(v_h.tenant_id, v_h.sede_id, p_instructor_membership_id);
  end if;
  update public.horarios set activo = coalesce(p_activo, activo), cupo_maximo = coalesce(p_cupo_maximo, cupo_maximo),
    instructor_membership_id = coalesce(p_instructor_membership_id, instructor_membership_id)
    where id = p_horario_id returning * into v_row;
  return v_row;
end $$;
