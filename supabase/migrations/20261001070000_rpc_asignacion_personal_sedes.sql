-- P06/P08 de la matriz: "Invitar personal y asignar roles/sedes" y "Asignar instructora a sedes y
-- clases" -- hasta ahora staff_sedes solo tenia policy de SELECT, nadie podia asignar/quitar sede
-- a un miembro del personal desde el panel. No crea personal nuevo (eso sigue bloqueado por el
-- mismo motivo que crear la primera dueña -- requiere invitacion/email, pendiente de decision de
-- infraestructura); esto solo gestiona las sedes de alguien que YA tiene cuenta en el tenant.

create or replace function public.asignar_sede_personal(p_tenant_membership_id uuid, p_sede_id uuid)
returns void
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid;
  v_sede_tenant_id uuid;
  v_mi_role text;
  v_mi_membership_id uuid;
begin
  select tenant_id into v_tenant_id from public.tenant_memberships where id = p_tenant_membership_id;
  if v_tenant_id is null then raise exception 'Miembro de personal no encontrado'; end if;

  select tenant_id into v_sede_tenant_id from public.sedes where id = p_sede_id;
  if v_sede_tenant_id is distinct from v_tenant_id then
    raise exception 'La sede no pertenece al mismo tenant';
  end if;

  if not public.tengo_rol_en_tenant(v_tenant_id, array['duena','gerente_general','admin_sede']) then
    raise exception 'No autorizado';
  end if;

  select id, role into v_mi_membership_id, v_mi_role from public.tenant_memberships
    where user_id = auth.uid() and tenant_id = v_tenant_id;

  if v_mi_role = 'admin_sede' and not exists (
    select 1 from public.staff_sedes where tenant_membership_id = v_mi_membership_id and sede_id = p_sede_id
  ) then
    raise exception 'Solo puedes asignar sedes que tú misma administras';
  end if;

  insert into public.staff_sedes (tenant_membership_id, sede_id)
  values (p_tenant_membership_id, p_sede_id)
  on conflict do nothing;
end;
$$;
revoke all on function public.asignar_sede_personal(uuid, uuid) from public;
grant execute on function public.asignar_sede_personal(uuid, uuid) to authenticated;

create or replace function public.quitar_sede_personal(p_tenant_membership_id uuid, p_sede_id uuid)
returns void
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid;
  v_mi_role text;
  v_mi_membership_id uuid;
begin
  select tenant_id into v_tenant_id from public.tenant_memberships where id = p_tenant_membership_id;
  if v_tenant_id is null then raise exception 'Miembro de personal no encontrado'; end if;

  if not public.tengo_rol_en_tenant(v_tenant_id, array['duena','gerente_general','admin_sede']) then
    raise exception 'No autorizado';
  end if;

  select id, role into v_mi_membership_id, v_mi_role from public.tenant_memberships
    where user_id = auth.uid() and tenant_id = v_tenant_id;

  if v_mi_role = 'admin_sede' and not exists (
    select 1 from public.staff_sedes where tenant_membership_id = v_mi_membership_id and sede_id = p_sede_id
  ) then
    raise exception 'Solo puedes modificar sedes que tú misma administras';
  end if;

  delete from public.staff_sedes
    where tenant_membership_id = p_tenant_membership_id and sede_id = p_sede_id;
end;
$$;
revoke all on function public.quitar_sede_personal(uuid, uuid) from public;
grant execute on function public.quitar_sede_personal(uuid, uuid) to authenticated;
