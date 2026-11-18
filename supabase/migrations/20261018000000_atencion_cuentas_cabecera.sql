-- Vigilancia de la plataforma: estudios que requieren atención, empleado de cabecera y revisión de cuentas.

create table if not exists public.plataforma_asignaciones (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
alter table public.plataforma_asignaciones enable row level security;
revoke all on public.plataforma_asignaciones from anon, authenticated;

create or replace function public.asignar_estudio(p_tenant_id uuid, p_user_id uuid, p_asignar boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.soy_staff_plataforma() then raise exception 'No autorizado'; end if;
  if not exists (select 1 from public.plataforma_staff where user_id = p_user_id) then raise exception 'Esa persona no es del equipo de ReserveOS'; end if;
  if p_asignar then
    insert into public.plataforma_asignaciones (tenant_id, user_id) values (p_tenant_id, p_user_id) on conflict do nothing;
  else
    delete from public.plataforma_asignaciones where tenant_id = p_tenant_id and user_id = p_user_id;
  end if;
  insert into public.admin_acciones_log (tenant_id, actor_id, tabla, operacion, registro_id, detalle)
    values (p_tenant_id, auth.uid(), 'plataforma_asignaciones', case when p_asignar then 'insert' else 'delete' end, p_user_id::text, jsonb_build_object('responsable', p_user_id));
end $$;
revoke all on function public.asignar_estudio(uuid, uuid, boolean) from public, anon;
grant execute on function public.asignar_estudio(uuid, uuid, boolean) to authenticated;

-- Estudios activos ordenados por riesgo, con el motivo en palabras simples.
create or replace function public._estudios_atencion()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v jsonb;
begin
  select coalesce(jsonb_agg(x order by (x->>'puntos')::int desc, x->>'nombre'), '[]'::jsonb) into v from (
    select jsonb_build_object(
      'tenant_id', t.id, 'nombre', t.name, 'slug', t.slug,
      'reservas_7d', r.n, 'ultima_reserva', r.ultima,
      'cobros_vencidos', c.n, 'monto_vencido', c.monto,
      'tickets_abiertos', k.n, 'tickets_urgentes', k.urg,
      'personal_total', p.total, 'personal_sin_entrar', p.sin_entrar,
      'responsables', coalesce(a.nombres, '[]'::jsonb),
      'puntos', (case when r.n = 0 then 3 else 0 end) + (case when c.n > 0 then 3 else 0 end) + (case when k.urg > 0 then 4 else 0 end)
                + (case when k.n > 0 then 1 else 0 end) + (case when p.sin_entrar > 0 then 1 else 0 end),
      'motivos', to_jsonb(array_remove(array[
        case when r.n = 0 then 'Sin reservas en 7 días' end,
        case when c.n > 0 then c.n || ' cobro(s) vencido(s) por Q' || c.monto end,
        case when k.urg > 0 then k.urg || ' ticket(s) urgente(s)' end,
        case when k.n > 0 and k.urg = 0 then k.n || ' ticket(s) abierto(s)' end,
        case when p.sin_entrar > 0 then p.sin_entrar || ' persona(s) del equipo sin entrar en 60 días' end], null))
    ) as x
    from public.tenants t
    cross join lateral (select count(*) filter (where estado = 'confirmada' and fecha >= public.hoy_gt() - 7) n, max(fecha) filter (where estado = 'confirmada') ultima from public.reservas where tenant_id = t.id) r
    cross join lateral (select count(*) n, coalesce(sum(monto), 0) monto from public.plataforma_cobros where tenant_id = t.id and estado = 'pendiente' and fecha_vencimiento < public.hoy_gt()) c
    cross join lateral (select count(*) filter (where estado in ('abierto','en_curso','esperando')) n, count(*) filter (where estado in ('abierto','en_curso','esperando') and prioridad = 'urgente') urg from public.plataforma_tickets where tenant_id = t.id) k
    cross join lateral (select count(*) total, count(*) filter (where u.last_sign_in_at is null or u.last_sign_in_at < now() - interval '60 days') sin_entrar
                          from public.tenant_memberships m join auth.users u on u.id = m.user_id where m.tenant_id = t.id) p
    left join lateral (select jsonb_agg(coalesce(s.nombre, u.email::text)) nombres from public.plataforma_asignaciones pa
                         join public.plataforma_staff s on s.user_id = pa.user_id join auth.users u on u.id = pa.user_id where pa.tenant_id = t.id) a on true
    where t.status = 'activo'
  ) q;
  return v;
end $$;
revoke all on function public._estudios_atencion() from public, anon, authenticated;
grant execute on function public._estudios_atencion() to service_role;

create or replace function public.estudios_atencion()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['soporte']) then raise exception 'No autorizado'; end if;
  return public._estudios_atencion();
end $$;
revoke all on function public.estudios_atencion() from public, anon;
grant execute on function public.estudios_atencion() to authenticated;

-- Correos del equipo que reciben la alerta diaria (solo servidor).
create or replace function public._destinatarios_alerta()
returns table(email text) language sql stable security definer set search_path to 'public' as $$
  select u.email::text from public.plataforma_staff s join auth.users u on u.id = s.user_id where s.rol in ('operador','soporte');
$$;
revoke all on function public._destinatarios_alerta() from public, anon, authenticated;
grant execute on function public._destinatarios_alerta() to service_role;

-- Revisión de cuentas del estudio: solo dueña / gerente general de ese estudio.
create or replace function public.revision_cuentas(p_tenant_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then raise exception 'No autorizado'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'membership_id', m.id, 'nombre', m.nombre, 'email', u.email, 'rol', m.role,
      'ultimo_acceso', u.last_sign_in_at, 'creada', m.created_at,
      'sedes', coalesce((select jsonb_agg(sd.name order by sd.name) from public.staff_sedes ss join public.sedes sd on sd.id = ss.sede_id where ss.tenant_membership_id = m.id), '[]'::jsonb))
      order by u.last_sign_in_at nulls first, m.created_at)
    from public.tenant_memberships m join auth.users u on u.id = m.user_id where m.tenant_id = p_tenant_id), '[]'::jsonb);
end $$;
revoke all on function public.revision_cuentas(uuid) from public, anon;
grant execute on function public.revision_cuentas(uuid) to authenticated;
