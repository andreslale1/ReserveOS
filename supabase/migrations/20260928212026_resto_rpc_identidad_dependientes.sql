-- Módulo resto — RPCs de identidad, dependientes y consentimiento. Estas funciones deberían haber
-- sido núcleo (son parte del flujo real de alta de clienta), la clasificación del Hito A las dejó
-- fuera por no matchear las palabras clave del filtro — se portan igual, con el mismo rigor.
--
-- Simplificación: `es_duena()`/`es_staff()` no se portan — están reemplazadas por
-- `tengo_rol_en_tenant()`/`staff_puede_en_sede()` del Hito C, que sí saben de multi-tenant.
-- `p_tenant_id` en `registrar_clienta` no es un hueco de seguridad: en el alta, todavía no existe
-- membresía que verificar — el tenant ES el contexto de registro (qué portal/dominio usó la persona
-- para registrarse), igual que "en qué tienda te creas una cuenta".

create or replace function public.telefono_normalizado(p_telefono text)
returns text
language plpgsql immutable
as $$
declare
  v_digitos text := regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g');
begin
  if length(v_digitos) = 8 then
    return v_digitos;
  elsif length(v_digitos) = 11 and left(v_digitos, 3) = '502' then
    return right(v_digitos, 8);
  else
    return null;
  end if;
end;
$$;

create or replace function public.usuario_tiene_password(p_user_id uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from auth.users u where u.id = p_user_id and u.encrypted_password is not null and u.encrypted_password <> ''
  );
$$;
revoke all on function public.usuario_tiene_password(uuid) from public;
grant execute on function public.usuario_tiene_password(uuid) to authenticated;

create or replace function public.necesita_contrasena()
returns boolean
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_sin_password boolean;
begin
  select (u.encrypted_password is null or u.encrypted_password = '')
    and not exists (select 1 from auth.identities i where i.user_id = auth.uid() and i.provider <> 'email')
  into v_sin_password
  from auth.users u where u.id = auth.uid();
  return coalesce(v_sin_password, false);
end;
$$;
revoke all on function public.necesita_contrasena() from public;
grant execute on function public.necesita_contrasena() to authenticated;

-- p_tenant_id agregado: un email puede repetirse entre tenants con filas de clientes distintas.
create or replace function public.necesita_password_por_email(p_email text, p_tenant_id uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.clientes c
    join auth.users u on u.id = c.user_id
    where c.tenant_id = p_tenant_id and lower(c.email) = lower(trim(p_email))
      and (u.encrypted_password is null or u.encrypted_password = '')
      and not exists (select 1 from auth.identities i where i.user_id = c.user_id and i.provider <> 'email')
  );
$$;
revoke all on function public.necesita_password_por_email(text, uuid) from public;
grant execute on function public.necesita_password_por_email(text, uuid) to authenticated, anon;

-- Trigger: protege columnas sensibles de `clientes` contra edición directa por la propia clienta.
-- `perfiles`→`tenant_memberships`, y ahora scoped al tenant de la fila (NEW.tenant_id).
create or replace function public.proteger_columnas_clienta()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
begin
  if current_user = 'authenticated'
     and not exists (select 1 from public.tenant_memberships where user_id = auth.uid() and tenant_id = new.tenant_id and role in ('duena','gerente_general','admin_sede','recepcion')) then
    if new.tutor_id is distinct from old.tutor_id
       or new.es_cuenta_familiar is distinct from old.es_cuenta_familiar
       or new.es_menor is distinct from old.es_menor
       or new.user_id is distinct from old.user_id
       or new.email is distinct from old.email
       or new.codigo_referido is distinct from old.codigo_referido
       or new.referido_por is distinct from old.referido_por
       or new.credito_referido_otorgado is distinct from old.credito_referido_otorgado
       or new.notas is distinct from old.notas then
      raise exception 'No puedes modificar ese dato de tu perfil.';
    end if;
  end if;
  return new;
end;
$$;
create trigger clientes_proteger_columnas before update on public.clientes
  for each row execute function public.proteger_columnas_clienta();

create or replace function public.generar_codigo_referido()
returns text
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_codigo text;
begin
  loop
    v_codigo := upper(substr(md5(random()::text), 1, 6));
    exit when not exists (select 1 from public.clientes where codigo_referido = v_codigo);
  end loop;
  return v_codigo;
end;
$$;

create or replace function public.set_codigo_referido()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
begin
  if new.codigo_referido is null then
    new.codigo_referido := public.generar_codigo_referido();
  end if;
  return new;
end;
$$;
create trigger clientes_set_codigo_referido before insert on public.clientes
  for each row execute function public.set_codigo_referido();

create or replace function public.contar_mis_referidos(p_tenant_id uuid)
returns integer
language sql stable security definer
set search_path to 'public'
as $$
  select count(*)::int from public.clientes
    where tenant_id = p_tenant_id and referido_por = (select id from public.clientes where user_id = auth.uid() and tenant_id = p_tenant_id)
      and credito_referido_otorgado = true;
$$;
revoke all on function public.contar_mis_referidos(uuid) from public;
grant execute on function public.contar_mis_referidos(uuid) to authenticated;

-- Bono de referido: 1 clase gratis (paquete núcleo, no código de descuento) al referido_por cuando el
-- referido completa su primera membresía de compra. Vive aquí (no en descuentos) porque no depende de
-- codigos_descuento — solo de clientes.referido_por, que sí es núcleo.
create or replace function public.otorgar_bono_referido_si_corresponde(p_cliente_id uuid, p_paquete_id uuid)
returns void
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_cliente record;
begin
  select tenant_id, referido_por, credito_referido_otorgado into v_cliente from public.clientes where id = p_cliente_id;

  if v_cliente.referido_por is not null and not v_cliente.credito_referido_otorgado then
    insert into public.membresias (tenant_id, cliente_id, paquete_id, cobertura_tipo, clases_totales, clases_usadas,
      fecha_inicio, fecha_vencimiento, estado, metodo_pago, precio_final, pagada, origen)
      select v_cliente.tenant_id, v_cliente.referido_por, p_paquete_id, pq.cobertura, 1, 0,
        public.hoy_en_sede(null), public.hoy_en_sede(null) + 90, 'activa', 'transferencia', 0, true, 'bono_referido'
      from public.paquetes pq where pq.id = p_paquete_id;

    update public.clientes set credito_referido_otorgado = true where id = p_cliente_id;
  end if;
end;
$$;
revoke all on function public.otorgar_bono_referido_si_corresponde(uuid, uuid) from public;

create or replace function public.completar_consentimiento(
  p_tenant_id uuid, p_contacto_emergencia text, p_cuidados_especiales text, p_objetivos text[],
  p_objetivo_otro text, p_experiencia_pilates text, p_consiente_responsabilidad boolean,
  p_consiente_cancelacion boolean, p_autoriza_imagen boolean, p_firma_nombre text
)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_cliente_id uuid;
begin
  v_cliente_id := public.mi_cliente_id(p_tenant_id);
  if v_cliente_id is null then
    raise exception 'Primero completa tu registro';
  end if;
  if not p_consiente_responsabilidad or not p_consiente_cancelacion then
    raise exception 'Debes aceptar la exención de responsabilidad y la política de cancelación';
  end if;
  if coalesce(trim(p_firma_nombre), '') = '' then
    raise exception 'Escribe tu nombre completo como firma';
  end if;

  update public.clientes set
    contacto_emergencia = nullif(trim(p_contacto_emergencia), ''),
    cuidados_especiales = nullif(trim(p_cuidados_especiales), ''),
    objetivos = p_objetivos,
    objetivo_otro = nullif(trim(p_objetivo_otro), ''),
    experiencia_pilates = p_experiencia_pilates,
    consiente_responsabilidad = p_consiente_responsabilidad,
    consiente_cancelacion = p_consiente_cancelacion,
    autoriza_imagen = p_autoriza_imagen,
    consentimiento_firma_nombre = trim(p_firma_nombre),
    consentimiento_completado_at = now()
  where id = v_cliente_id;

  return json_build_object('ok', true);
end;
$$;
revoke all on function public.completar_consentimiento(uuid, text, text, text[], text, text, boolean, boolean, boolean, text) from public;
grant execute on function public.completar_consentimiento(uuid, text, text, text[], text, text, boolean, boolean, boolean, text) to authenticated;

create or replace function public.registrar_clienta(
  p_tenant_id uuid, p_nombre text, p_telefono text, p_genero text default null,
  p_codigo_referido text default null, p_como_se_entero text default null, p_es_cuenta_familiar boolean default false
)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_email text;
  v_cliente_id uuid;
  v_referido_por uuid;
  v_telefono_normalizado text;
  v_existente_id uuid;
  v_existente_user_id uuid;
begin
  if coalesce(trim(p_genero), '') = '' then
    raise exception 'Selecciona una opción de género';
  end if;
  if coalesce(trim(p_como_se_entero), '') = '' then
    raise exception 'Selecciona cómo te enteraste de nosotras';
  end if;

  v_telefono_normalizado := public.telefono_normalizado(p_telefono);
  if v_telefono_normalizado is null then
    raise exception 'Ingresa un teléfono válido.';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  select id, user_id into v_existente_id, v_existente_user_id
    from public.clientes
    where tenant_id = p_tenant_id and regexp_replace(telefono, '\D', '', 'g') = v_telefono_normalizado and tutor_id is null
    limit 1;

  if v_existente_id is not null and v_existente_user_id is not null and v_existente_user_id <> auth.uid() then
    raise exception 'Ya existe una cuenta con este número de teléfono en este estudio. Inicia sesión o recupera tu contraseña.';
  end if;

  if p_codigo_referido is not null then
    select id into v_referido_por from public.clientes where tenant_id = p_tenant_id and codigo_referido = upper(trim(p_codigo_referido));
  end if;

  select id into v_cliente_id from public.clientes
    where tenant_id = p_tenant_id and user_id is null and tutor_id is null and email = v_email
    limit 1;

  if v_cliente_id is not null then
    update public.clientes set user_id = auth.uid(), nombre = p_nombre, telefono = v_telefono_normalizado, email = v_email,
      genero = coalesce(p_genero, genero), referido_por = coalesce(referido_por, v_referido_por),
      terminos_aceptados_at = now(), como_se_entero = coalesce(como_se_entero, p_como_se_entero),
      es_cuenta_familiar = p_es_cuenta_familiar
      where id = v_cliente_id;
  else
    insert into public.clientes (tenant_id, nombre, email, telefono, genero, user_id, referido_por, terminos_aceptados_at, como_se_entero, es_cuenta_familiar)
      values (p_tenant_id, p_nombre, v_email, v_telefono_normalizado, p_genero, auth.uid(), v_referido_por, now(), p_como_se_entero, p_es_cuenta_familiar)
      returning id into v_cliente_id;
  end if;

  return json_build_object('ok', true, 'cliente_id', v_cliente_id);
end;
$$;
revoke all on function public.registrar_clienta(uuid, text, text, text, text, text, boolean) from public;
grant execute on function public.registrar_clienta(uuid, text, text, text, text, text, boolean) to authenticated;

create or replace function public.agregar_dependiente(p_tenant_id uuid, p_nombre text, p_fecha_nacimiento date default null)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tutor_id uuid;
  v_tutor_telefono text;
  v_nuevo_id uuid;
begin
  v_tutor_id := public.mi_cliente_id(p_tenant_id);
  if v_tutor_id is null then
    raise exception 'Completa tu perfil antes de agregar un familiar';
  end if;
  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'Ingresa el nombre';
  end if;

  select telefono into v_tutor_telefono from public.clientes where id = v_tutor_id;

  insert into public.clientes (tenant_id, nombre, telefono, tutor_id, es_menor, fecha_nacimiento)
    values (p_tenant_id, trim(p_nombre), v_tutor_telefono, v_tutor_id, true, p_fecha_nacimiento)
    returning id into v_nuevo_id;

  update public.clientes set es_cuenta_familiar = true where id = v_tutor_id;

  return json_build_object('ok', true, 'id', v_nuevo_id);
end;
$$;
revoke all on function public.agregar_dependiente(uuid, text, date) from public;
grant execute on function public.agregar_dependiente(uuid, text, date) to authenticated;

create or replace function public.agregar_dependiente_manual(p_tutor_id uuid, p_nombre text, p_fecha_nacimiento date default null)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid;
  v_tutor_telefono text;
  v_nuevo_id uuid;
begin
  select tenant_id, telefono into v_tenant_id, v_tutor_telefono from public.clientes where id = p_tutor_id and tutor_id is null;
  if v_tenant_id is null then raise exception 'Clienta no encontrada'; end if;

  if not public.staff_puede_en_sede(v_tenant_id, null, array['duena','gerente_general','admin_sede','recepcion']) then
    raise exception 'No autorizado';
  end if;
  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'Ingresa el nombre';
  end if;

  insert into public.clientes (tenant_id, nombre, telefono, tutor_id, es_menor, fecha_nacimiento)
    values (v_tenant_id, trim(p_nombre), v_tutor_telefono, p_tutor_id, true, p_fecha_nacimiento)
    returning id into v_nuevo_id;

  update public.clientes set es_cuenta_familiar = true where id = p_tutor_id;

  return json_build_object('ok', true, 'id', v_nuevo_id);
end;
$$;
revoke all on function public.agregar_dependiente_manual(uuid, text, date) from public;
grant execute on function public.agregar_dependiente_manual(uuid, text, date) to authenticated;

create or replace function public.editar_dependiente(p_tenant_id uuid, p_id uuid, p_nombre text, p_fecha_nacimiento date default null)
returns void
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tutor_id uuid;
begin
  v_tutor_id := public.mi_cliente_id(p_tenant_id);
  update public.clientes set nombre = trim(p_nombre), fecha_nacimiento = p_fecha_nacimiento
    where id = p_id and tutor_id = v_tutor_id;
end;
$$;
revoke all on function public.editar_dependiente(uuid, uuid, text, date) from public;
grant execute on function public.editar_dependiente(uuid, uuid, text, date) to authenticated;

create or replace function public.eliminar_dependiente(p_tenant_id uuid, p_id uuid)
returns void
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tutor_id uuid;
begin
  v_tutor_id := public.mi_cliente_id(p_tenant_id);
  if exists (select 1 from public.reservas where cliente_id = p_id) or exists (select 1 from public.membresias where cliente_id = p_id) then
    raise exception 'Esta persona ya tiene reservas o paquetes registrados — contacta al estudio para eliminarla.';
  end if;
  delete from public.clientes where id = p_id and tutor_id = v_tutor_id;
end;
$$;
revoke all on function public.eliminar_dependiente(uuid, uuid) from public;
grant execute on function public.eliminar_dependiente(uuid, uuid) to authenticated;

create or replace function public.mis_dependientes(p_tenant_id uuid)
returns table(id uuid, nombre text, fecha_nacimiento date)
language sql stable security definer
set search_path to 'public'
as $$
  select c.id, c.nombre, c.fecha_nacimiento from public.clientes c
    where c.tutor_id = public.mi_cliente_id(p_tenant_id)
    order by c.created_at;
$$;
revoke all on function public.mis_dependientes(uuid) from public;
grant execute on function public.mis_dependientes(uuid) to authenticated;
