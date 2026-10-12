-- Sitio público vendedor + registro autónomo + seguimiento de clases de prueba + avisos y referidos para la clienta.
-- La superficie anónima NO cambia: se amplía lo que ya devolvía horarios_publicos (una de las 7 funciones permitidas).

-- 1) Registro: género y «cómo te enteraste» pasan a ser opcionales (una clienta nueva no debe toparse con campos que no necesita).
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='registrar_clienta';
  d := replace(d, E'  if coalesce(trim(p_genero), '''') = '''' then\n    raise exception ''Selecciona una opción de género'';\n  end if;\n', '');
  d := replace(d, E'  if coalesce(trim(p_como_se_entero), '''') = '''' then\n    raise exception ''Selecciona cómo te enteraste de nosotras'';\n  end if;\n', '');
  d := replace(d, 'p_genero text DEFAULT NULL::text', 'p_genero text DEFAULT NULL::text');
  if d like '%Selecciona una opción de género%' or d like '%Selecciona cómo te enteraste%' then raise exception 'no se pudo parchear registrar_clienta'; end if;
  -- limpiar vacíos a null para no guardar cadenas vacías
  d := replace(d, 'genero = coalesce(p_genero, genero)', 'genero = coalesce(nullif(trim(p_genero), ''''), genero)');
  d := replace(d, 'como_se_entero = coalesce(como_se_entero, p_como_se_entero)', 'como_se_entero = coalesce(como_se_entero, nullif(trim(p_como_se_entero), ''''))');
  d := replace(d, 'values (p_tenant_id, p_nombre, v_email, v_telefono_normalizado, p_genero, auth.uid(), v_referido_por, now(), p_como_se_entero, p_es_cuenta_familiar)',
                  'values (p_tenant_id, p_nombre, v_email, v_telefono_normalizado, nullif(trim(p_genero), ''''), auth.uid(), v_referido_por, now(), nullif(trim(p_como_se_entero), ''''), p_es_cuenta_familiar)');
  execute d;
end $$;

-- 2) Página pública: paquetes con precio y cobertura, contenido editable, contacto y testimonios aprobados.
create or replace function public.horarios_publicos(p_slug text)
returns json language plpgsql stable security definer set search_path = public as $$
declare v_t record; v_c record;
begin
  select id, name, slug, branding into v_t from public.tenants where slug = lower(trim(p_slug)) and status = 'activo';
  if v_t is null then return null; end if;
  select * into v_c from public.contenido_sitio where tenant_id = v_t.id;
  return json_build_object(
    'id', v_t.id,
    'nombre', v_t.name,
    'slug', v_t.slug,
    'color', v_t.branding->>'color_primario',
    'logo', v_t.branding->>'logo_url',
    'sedes', coalesce((select json_agg(json_build_object('id', s.id, 'nombre', s.name, 'direccion', s.address) order by s.name)
                       from public.sedes s where s.tenant_id = v_t.id and s.status = 'activa'), '[]'::json),
    'clases', coalesce((select json_agg(json_build_object('id', h.id, 'sede_id', h.sede_id, 'dia', h.dia_semana, 'inicio', h.hora_inicio,
                          'fin', h.hora_fin, 'nombre', h.nombre_clase, 'cupo', h.cupo_maximo,
                          'instructora', split_part(coalesce(tm.nombre, ''), ' ', 1)) order by h.dia_semana, h.hora_inicio)
                       from public.horarios h
                       join public.sedes s on s.id = h.sede_id and s.status = 'activa'
                       left join public.tenant_memberships tm on tm.id = h.instructor_membership_id
                       where h.tenant_id = v_t.id and h.activo = true and h.fecha_especifica is null and h.categoria = 'regular'), '[]'::json),
    'paquetes', case when coalesce(v_c.paquetes_visible, true) then coalesce((
        select json_agg(json_build_object('id', p.id, 'nombre', p.nombre, 'descripcion', p.descripcion, 'num_clases', p.num_clases, 'precio', p.precio,
                 'vigencia_dias', p.vigencia_dias, 'destacado', p.featured, 'etiqueta', p.badge,
                 'cobertura', case p.cobertura when 'todas' then 'Todas las sedes' else (select string_agg(s.name, ', ' order by s.name) from public.paquete_sedes ps join public.sedes s on s.id = ps.sede_id where ps.paquete_id = p.id) end)
               order by p.orden, p.precio)
        from public.paquetes p where p.tenant_id = v_t.id and p.activo), '[]'::json) else '[]'::json end,
    'contacto', (select json_build_object('whatsapp', cc.whatsapp_numero, 'instagram', cc.instagram_url, 'facebook', cc.facebook_url)
                 from public.configuracion_contacto cc where cc.tenant_id = v_t.id),
    'contenido', case when v_c.tenant_id is null then null else to_json(v_c) end,
    'testimonios', case when coalesce(v_c.reviews_visible, true) then coalesce((
        select json_agg(json_build_object('nombre', t.nombre_publico, 'texto', t.texto, 'calificacion', t.calificacion) order by t.created_at desc)
        from (select * from public.testimonios where tenant_id = v_t.id and aprobado = true order by created_at desc limit 12) t), '[]'::json) else '[]'::json end
  );
end $$;
grant execute on function public.horarios_publicos(text) to anon, authenticated;

-- 3) Edición del sitio por el estudio (dueña/gerencia general): solo campos del contenido, con tope de largo y URLs https.
create or replace function public.guardar_contenido_sitio(p_tenant_id uuid, p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare k text; v jsonb; permitidas text[];
begin
  if not public._es_g(p_tenant_id) then raise exception 'Solo la dueña o la gerencia general editan el sitio'; end if;
  if jsonb_typeof(p_datos) <> 'object' then raise exception 'Datos no válidos'; end if;
  select array_agg(column_name::text) into permitidas from information_schema.columns
    where table_schema = 'public' and table_name = 'contenido_sitio' and column_name not in ('tenant_id', 'updated_at');
  insert into public.contenido_sitio (tenant_id) values (p_tenant_id) on conflict (tenant_id) do nothing;
  for k, v in select * from jsonb_each(p_datos) loop
    if not (k = any(permitidas)) then raise exception 'Campo no permitido: %', k; end if;
    if jsonb_typeof(v) = 'string' then
      if length(v #>> '{}') > 2000 then raise exception 'El texto de "%" es demasiado largo (máximo 2000 caracteres)', k; end if;
      if k like '%\_url' and nullif(v #>> '{}', '') is not null and (v #>> '{}') !~* '^https://' then raise exception 'La dirección de "%" debe empezar con https://', k; end if;
    end if;
    execute format('update public.contenido_sitio set %1$I = (jsonb_populate_record(null::public.contenido_sitio, $2)).%1$I, updated_at = now() where tenant_id = $1', k)
      using p_tenant_id, jsonb_build_object(k, case when jsonb_typeof(v) = 'string' and (v #>> '{}') = '' then 'null'::jsonb else v end);
  end loop;
end $$;

create or replace function public.guardar_contacto_estudio(p_tenant_id uuid, p_whatsapp text, p_instagram text, p_facebook text)
returns void language plpgsql security definer set search_path = public as $$
declare v_w text := nullif(regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g'), '');
begin
  if not public._es_g(p_tenant_id) then raise exception 'Solo la dueña o la gerencia general editan el contacto'; end if;
  if v_w is not null and length(v_w) not between 8 and 15 then raise exception 'El número de WhatsApp debe tener entre 8 y 15 dígitos, con código de país (ej. 50255551234)'; end if;
  if nullif(p_instagram, '') is not null and p_instagram !~* '^https://' then raise exception 'La dirección de Instagram debe empezar con https://'; end if;
  if nullif(p_facebook, '') is not null and p_facebook !~* '^https://' then raise exception 'La dirección de Facebook debe empezar con https://'; end if;
  insert into public.configuracion_contacto (tenant_id, whatsapp_numero, instagram_url, facebook_url)
    values (p_tenant_id, v_w, nullif(p_instagram, ''), nullif(p_facebook, ''))
    on conflict (tenant_id) do update set whatsapp_numero = excluded.whatsapp_numero, instagram_url = excluded.instagram_url, facebook_url = excluded.facebook_url, updated_at = now();
end $$;

-- 4) Seguimiento de clases de prueba: sin contactar → contactada → convertida (esta última la pone sola la primera compra pagada).
update public.reservas set estado_lead = 'sin_contactar' where tipo = 'prueba' and estado_lead is null;
create or replace function public._lead_prueba_default() returns trigger language plpgsql as $$
begin
  if new.tipo = 'prueba' and new.estado_lead is null then new.estado_lead := 'sin_contactar'; end if;
  return new;
end $$;
drop trigger if exists trg_lead_prueba_default on public.reservas;
create trigger trg_lead_prueba_default before insert or update of tipo on public.reservas for each row execute function public._lead_prueba_default();

-- Invoker: el alcance lo dan las políticas de lectura (sede/rol). La instructora no ve clientas, así que no ve nada aquí.
create or replace function public.leads_prueba_listar(p_tenant_id uuid)
returns table(reserva_id uuid, cliente_id uuid, nombre text, telefono text, email text, fecha date, hora time, sede text, estado_lead text, asistio boolean, reserva_estado text)
language sql stable security invoker set search_path = public as $$
  select r.id, c.id, c.nombre, c.telefono, c.email, r.fecha, h.hora_inicio, s.name, coalesce(r.estado_lead, 'sin_contactar'), r.asistio, r.estado
  from public.reservas r
  join public.clientes c on c.id = r.cliente_id
  join public.horarios h on h.id = r.horario_id
  join public.sedes s on s.id = r.sede_id
  where r.tenant_id = p_tenant_id and r.tipo = 'prueba'
  order by case coalesce(r.estado_lead, 'sin_contactar') when 'sin_contactar' then 0 when 'contactada' then 1 else 2 end, r.fecha desc;
$$;

create or replace function public.lead_prueba_estado(p_reserva_id uuid, p_estado text)
returns void language plpgsql security definer set search_path = public as $$
declare v_r record;
begin
  if p_estado not in ('sin_contactar', 'contactada') then raise exception '«Convertida» se marca sola cuando la clienta compra su primer paquete'; end if;
  select * into v_r from public.reservas where id = p_reserva_id and tipo = 'prueba';
  if v_r is null then raise exception 'Clase de prueba no encontrada'; end if;
  if not (public._es_g(v_r.tenant_id) or (public._es_rol_sede(v_r.tenant_id) and v_r.sede_id = any(public._mis_sedes(v_r.tenant_id)))) then raise exception 'No autorizado'; end if;
  if v_r.estado_lead = 'convertida' then raise exception 'Esta clienta ya compró: no se vuelve a marcar'; end if;
  update public.reservas set estado_lead = p_estado where id = p_reserva_id;
end $$;

-- 5) Avisos para la clienta + «Invitar y ganar».
create or replace function public.mis_comunicados(p_tenant_id uuid)
returns table(id uuid, titulo text, mensaje text, creado timestamptz, visto boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.titulo, c.mensaje, c.created_at, exists (select 1 from public.comunicados_vistos v where v.comunicado_id = c.id and v.user_id = auth.uid())
  from public.comunicados c
  where c.tenant_id = p_tenant_id and public.mi_cliente_id(p_tenant_id) is not null
    and c.audiencias && array['clientas', 'clientes', 'todas', 'todos']
  order by c.created_at desc limit 20;
$$;

create or replace function public.comunicado_marcar_visto(p_comunicado_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_t uuid;
begin
  select tenant_id into v_t from public.comunicados where id = p_comunicado_id;
  if v_t is null or public.mi_cliente_id(v_t) is null then raise exception 'No autorizado'; end if;
  insert into public.comunicados_vistos (tenant_id, comunicado_id, user_id) values (v_t, p_comunicado_id, auth.uid()) on conflict do nothing;
end $$;

create or replace function public.comunicado_crear(p_tenant_id uuid, p_titulo text, p_mensaje text, p_audiencias text[])
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public._es_g(p_tenant_id) then raise exception 'Solo la dueña o la gerencia general publican comunicados'; end if;
  if length(trim(coalesce(p_titulo, ''))) < 3 or length(trim(coalesce(p_mensaje, ''))) < 3 then raise exception 'Escribe un título y un mensaje'; end if;
  if p_audiencias is null or cardinality(p_audiencias) = 0 or not (p_audiencias <@ array['clientas', 'instructoras']) then raise exception 'La audiencia debe ser clientas, instructoras o ambas'; end if;
  insert into public.comunicados (tenant_id, titulo, mensaje, audiencias, created_by) values (p_tenant_id, trim(p_titulo), trim(p_mensaje), p_audiencias, auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.mi_codigo_referido(p_tenant_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select codigo_referido from public.clientes where tenant_id = p_tenant_id and user_id = auth.uid() and tutor_id is null limit 1;
$$;

do $$
declare f text;
begin
  foreach f in array array['guardar_contenido_sitio(uuid,jsonb)', 'guardar_contacto_estudio(uuid,text,text,text)', 'leads_prueba_listar(uuid)', 'lead_prueba_estado(uuid,text)',
      'mis_comunicados(uuid)', 'comunicado_marcar_visto(uuid)', 'comunicado_crear(uuid,uuid,text,text[])', 'mi_codigo_referido(uuid)'] loop
    begin
      execute format('revoke all on function public.%s from public, anon', f);
      execute format('grant execute on function public.%s to authenticated', f);
    exception when undefined_function then null; end;
  end loop;
  revoke all on function public.comunicado_crear(uuid,text,text,text[]) from public, anon;
  grant execute on function public.comunicado_crear(uuid,text,text,text[]) to authenticated;
end $$;
