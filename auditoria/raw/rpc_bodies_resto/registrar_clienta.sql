CREATE OR REPLACE FUNCTION public.registrar_clienta(p_nombre text, p_telefono text, p_genero text DEFAULT NULL::text, p_codigo_referido text DEFAULT NULL::text, p_como_se_entero text DEFAULT NULL::text, p_es_cuenta_familiar boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  v_telefono_normalizado := telefono_normalizado(p_telefono);
  if v_telefono_normalizado is null then
    raise exception 'Ingresa un teléfono de Guatemala válido (8 dígitos).';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  select id, user_id into v_existente_id, v_existente_user_id
    from clientes
    where regexp_replace(telefono, '\D', '', 'g') = v_telefono_normalizado
      and tutor_id is null
    limit 1;

  if v_existente_id is not null and v_existente_user_id is not null and v_existente_user_id <> auth.uid() then
    raise exception 'Ya existe una cuenta con este número de teléfono. Inicia sesión o recupera tu contraseña.';
  end if;

  if p_codigo_referido is not null then
    select id into v_referido_por from clientes where codigo_referido = upper(trim(p_codigo_referido));
  end if;

  -- Solo el correo (el de la sesión ya autenticada, verificado por
  -- Supabase/Google) puede heredar en automático un lead sin dueño — el
  -- teléfono es texto libre sin verificar y ya no basta por sí solo,
  -- para que nadie pueda heredar el historial de otra persona con solo
  -- escribir su número.
  select id into v_cliente_id from clientes
    where user_id is null and tutor_id is null and email = v_email
    limit 1;

  if v_cliente_id is not null then
    update clientes set user_id = auth.uid(), nombre = p_nombre, telefono = v_telefono_normalizado, email = v_email,
      genero = coalesce(p_genero, genero), referido_por = coalesce(referido_por, v_referido_por),
      terminos_aceptados_at = now(), como_se_entero = coalesce(como_se_entero, p_como_se_entero),
      es_cuenta_familiar = p_es_cuenta_familiar
      where id = v_cliente_id;
  else
    insert into clientes (nombre, email, telefono, genero, user_id, referido_por, terminos_aceptados_at, como_se_entero, es_cuenta_familiar)
      values (p_nombre, v_email, v_telefono_normalizado, p_genero, auth.uid(), v_referido_por, now(), p_como_se_entero, p_es_cuenta_familiar)
      returning id into v_cliente_id;
  end if;

  return json_build_object('ok', true, 'cliente_id', v_cliente_id);
end;
$function$
