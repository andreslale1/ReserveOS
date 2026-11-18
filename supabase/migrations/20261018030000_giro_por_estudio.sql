-- Cada estudio es de UN solo giro: pilates, crossfit, hyrox o crossfit_hyrox. Nunca se mezcla Pilates con los otros.
alter table public.tenants add column if not exists giro text not null default 'pilates';
alter table public.tenants drop constraint if exists tenants_giro_check;
alter table public.tenants add constraint tenants_giro_check check (giro in ('pilates','crossfit','hyrox','crossfit_hyrox'));

-- La página pública entrega el giro (el portal y el sitio del estudio lo usan para su vocabulario).
create or replace function public.horarios_publicos(p_slug text)
returns json language plpgsql stable security definer set search_path = public as $$
declare v_t record; v_c record;
begin
  select id, name, slug, branding, giro into v_t from public.tenants where slug = lower(trim(p_slug)) and status = 'activo';
  if v_t is null then return null; end if;
  select * into v_c from public.contenido_sitio where tenant_id = v_t.id;
  return json_build_object(
    'id', v_t.id,
    'nombre', v_t.name,
    'slug', v_t.slug,
    'giro', v_t.giro,
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

-- Solo el equipo de ReserveOS fija el giro de un estudio (queda en la auditoría).
create or replace function public.fijar_giro_estudio(p_tenant_id uuid, p_giro text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.soy_staff_plataforma() then raise exception 'No autorizado'; end if;
  if p_giro not in ('pilates','crossfit','hyrox','crossfit_hyrox') then raise exception 'Giro no válido'; end if;
  update public.tenants set giro = p_giro where id = p_tenant_id;
  insert into public.admin_acciones_log (tenant_id, actor_id, tabla, operacion, registro_id, detalle)
    values (p_tenant_id, auth.uid(), 'plataforma_giro', 'update', p_tenant_id::text, jsonb_build_object('giro', p_giro));
end $$;
revoke all on function public.fijar_giro_estudio(uuid, text) from public, anon;
grant execute on function public.fijar_giro_estudio(uuid, text) to authenticated;
