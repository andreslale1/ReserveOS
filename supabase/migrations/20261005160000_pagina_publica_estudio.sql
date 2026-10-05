-- Página pública por estudio (/e/[slug]): horario semanal visible sin login, para enlazar o embeber
-- desde la web del gimnasio. Solo datos no sensibles: nombre, marca, sedes y clases regulares recurrentes.
create or replace function public.horarios_publicos(p_slug text)
returns json
language plpgsql stable security definer
set search_path to 'public'
as $$
declare v_t record;
begin
  select id, name, slug, branding into v_t from public.tenants where slug = lower(trim(p_slug)) and status = 'activo';
  if v_t is null then return null; end if;
  return json_build_object(
    'nombre', v_t.name,
    'slug', v_t.slug,
    'color', v_t.branding->>'color_primario',
    'logo', v_t.branding->>'logo_url',
    'sedes', coalesce((select json_agg(json_build_object('id', s.id, 'nombre', s.name, 'direccion', s.address) order by s.name)
                       from public.sedes s where s.tenant_id = v_t.id and s.status = 'activa'), '[]'::json),
    'clases', coalesce((select json_agg(json_build_object('sede_id', h.sede_id, 'dia', h.dia_semana, 'inicio', h.hora_inicio,
                          'fin', h.hora_fin, 'nombre', h.nombre_clase, 'cupo', h.cupo_maximo,
                          'instructora', split_part(coalesce(tm.nombre, ''), ' ', 1)) order by h.dia_semana, h.hora_inicio)
                       from public.horarios h
                       join public.sedes s on s.id = h.sede_id and s.status = 'activa'
                       left join public.tenant_memberships tm on tm.id = h.instructor_membership_id
                       where h.tenant_id = v_t.id and h.activo = true and h.fecha_especifica is null and h.categoria = 'regular'), '[]'::json)
  );
end;
$$;
revoke all on function public.horarios_publicos(text) from public;
grant execute on function public.horarios_publicos(text) to anon, authenticated;
