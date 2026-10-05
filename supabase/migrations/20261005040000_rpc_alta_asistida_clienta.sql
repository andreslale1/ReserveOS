-- P09 de la matriz: "Crear ficha e invitar a clienta" -- clientes.user_id ya es nullable por
-- diseño (sección 6/"Alta asistida" del documento maestro: primero se crea la ficha con datos
-- minimos, la invitacion para activar login es un paso aparte, todavia no construido por la
-- misma razon que crear la primera dueña -- requiere decision de proveedor de email). Esto NO
-- toca auth.users, es una fila normal de datos -- no necesita service_role.
--
-- Bug de clase conocido en Forma (sección 2.3, punto 8): identificador duplicado debe bloquear
-- y decir de quién es el dato en conflicto, no solo "no se pudo".

create or replace function public.crear_cliente(
  p_tenant_id uuid,
  p_nombre text,
  p_telefono text,
  p_email text default null,
  p_sede_habitual_id uuid default null,
  p_genero text default null,
  p_como_se_entero text default null
)
returns public.clientes
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_row public.clientes;
  v_dup_nombre text;
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','admin_sede','recepcion']) then
    raise exception 'No autorizado';
  end if;
  if trim(coalesce(p_nombre, '')) = '' then
    raise exception 'El nombre es obligatorio';
  end if;
  if trim(coalesce(p_telefono, '')) = '' then
    raise exception 'El teléfono es obligatorio';
  end if;

  select nombre into v_dup_nombre from public.clientes
    where tenant_id = p_tenant_id and telefono = p_telefono
    limit 1;
  if v_dup_nombre is not null then
    raise exception 'Ya existe una clienta con ese teléfono: %', v_dup_nombre;
  end if;

  if p_email is not null and trim(p_email) <> '' then
    select nombre into v_dup_nombre from public.clientes
      where tenant_id = p_tenant_id and email = p_email
      limit 1;
    if v_dup_nombre is not null then
      raise exception 'Ya existe una clienta con ese correo: %', v_dup_nombre;
    end if;
  end if;

  insert into public.clientes (
    tenant_id, nombre, telefono, email, sede_habitual_id, genero, como_se_entero
  ) values (
    p_tenant_id, trim(p_nombre), trim(p_telefono), nullif(trim(coalesce(p_email, '')), ''),
    p_sede_habitual_id, p_genero, p_como_se_entero
  )
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.crear_cliente(uuid, text, text, text, uuid, text, text) from public;
grant execute on function public.crear_cliente(uuid, text, text, text, uuid, text, text) to authenticated;
