-- Cierra el ultimo pendiente documentado en la consola de operador (/owner): crear_tenant_
-- plataforma() crea el tenant+sede pero no a la primera dueña, porque crear_invitacion_personal()
-- exige que quien invita ya sea staff DE ESE tenant -- un operador de plataforma nunca lo es.
-- Mismo mecanismo de invitacion ya construido (sin service_role, sin proveedor de email nuevo).
--
-- invitaciones_personal.role excluía 'duena' a propósito (nadie dentro de un tenant puede crear
-- otra dueña vía invitación, por diseño) -- se habilita aquí solo porque esta función nueva es la
-- única que inserta con role='duena', y solo un operador de plataforma puede llamarla.
-- crear_invitacion_personal() conserva su propia lista de roles permitidos sin 'duena', así que
-- el personal normal sigue sin poder invitar a otra dueña.
alter table public.invitaciones_personal drop constraint invitaciones_personal_role_check;
alter table public.invitaciones_personal add constraint invitaciones_personal_role_check
  check (role in ('duena','gerente_general','admin_sede','recepcion','instructora','contadora'));

create or replace function public.invitar_primera_duena_plataforma(
  p_tenant_id uuid, p_email text, p_nombre text
)
returns uuid
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_token uuid;
begin
  if not public.soy_staff_plataforma() then
    raise exception 'No autorizado';
  end if;
  if exists (select 1 from public.tenant_memberships where tenant_id = p_tenant_id) then
    raise exception 'Este estudio ya tiene personal -- usa la invitación normal desde su panel';
  end if;

  insert into public.invitaciones_personal (tenant_id, email, role, nombre, creado_por)
  values (p_tenant_id, lower(trim(p_email)), 'duena', trim(p_nombre), auth.uid())
  returning token into v_token;

  return v_token;
end;
$$;
revoke all on function public.invitar_primera_duena_plataforma(uuid, text, text) from public;
grant execute on function public.invitar_primera_duena_plataforma(uuid, text, text) to authenticated;
