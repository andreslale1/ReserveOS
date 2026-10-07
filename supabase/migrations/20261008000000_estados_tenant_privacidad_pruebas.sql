-- Consola de owner · Estudios (auditoría O-01, O-02, O-06, O-11)
--  O-01  Estados reales del estudio, con bloqueo en la base de datos, motivo, actor e historial.
--  O-02  La ficha del estudio ya NO entrega datos identificables de clientas ni finanzas del gimnasio; eso solo se ve con
--        acceso excepcional (ticket + motivo + alcance + caducidad), validado y registrado en la base.
--  O-06  Cada estudio es 'cliente', 'demo' o 'interno'; los que no son 'cliente' no cuentan en MRR ni en estudios activos.
--  O-11  Métricas separadas: clientas registradas vs clientas con acceso.
--
-- SEMÁNTICA DE ESTADOS
--   borrador, en_implantacion  El estudio se está armando; opera normal para su equipo (no es público).
--   activo                     Opera normal.
--   pausado                    No se aceptan operaciones nuevas de venta/reserva/alta de clientas; la configuración sigue editable.
--   suspendido, cancelado      Además, no se puede cambiar la configuración. Siguen funcionando: lectura y exportación para
--                              la dueña y su equipo, cancelaciones y cambios sobre lo ya creado, confirmación de pagos ya
--                              iniciados (webhook) y todo lo que haga el operador de ReserveOS (soporte, reactivación).

-- ───────────────────────── Estados y tipo ─────────────────────────
alter table public.tenants drop constraint if exists tenants_status_check;
alter table public.tenants add constraint tenants_status_check
  check (status = any (array['borrador','en_implantacion','activo','pausado','suspendido','cancelado']));

alter table public.tenants add column if not exists tipo text not null default 'cliente';
alter table public.tenants drop constraint if exists tenants_tipo_check;
alter table public.tenants add constraint tenants_tipo_check check (tipo in ('cliente','demo','interno'));
alter table public.tenants add column if not exists estado_motivo text;
alter table public.tenants add column if not exists estado_cambiado_at timestamptz;
alter table public.tenants add column if not exists estado_cambiado_por uuid;

update public.tenants set tipo = 'demo' where slug in ('demo','segundo-demo') and tipo = 'cliente';
update public.tenants set tipo = 'interno'
  where (slug like 'ficticio-%' or slug like '%-prueba') and tipo = 'cliente';

create table if not exists public.tenant_estado_historial (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  estado_anterior text not null,
  estado_nuevo text not null,
  motivo text not null,
  actor_id uuid,
  actor_nombre text,
  created_at timestamptz not null default now()
);
create index if not exists tenant_estado_historial_tenant on public.tenant_estado_historial (tenant_id, created_at desc);
alter table public.tenant_estado_historial enable row level security;
drop policy if exists tenant_estado_historial_select on public.tenant_estado_historial;
create policy tenant_estado_historial_select on public.tenant_estado_historial for select using (public._plat_ok(array['soporte','auditor']));

-- ───────────────────────── Bloqueo real (O-01) ─────────────────────────
create or replace function public._tenant_bloqueado(p_tenant uuid, p_nivel text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists(select 1 from public.tenants t where t.id = p_tenant and (
    (p_nivel = 'tx'  and t.status in ('pausado','suspendido','cancelado')) or
    (p_nivel = 'cfg' and t.status in ('suspendido','cancelado'))));
$$;

-- tg_argv[0] = 'tx' (altas transaccionales: solo INSERT) | 'cfg' (configuración: INSERT/UPDATE/DELETE)
create or replace function public._guard_estado_tenant()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_t uuid; v_rol text := nullif(auth.role(), '');
begin
  -- Exentos: operador de la plataforma, rol de servicio y procesos internos sin sesión (cron, migraciones).
  if v_rol is null or v_rol = 'service_role' or public.soy_staff_plataforma() then
    return coalesce(new, old);
  end if;
  v_t := coalesce((to_jsonb(new)->>'tenant_id')::uuid, (to_jsonb(old)->>'tenant_id')::uuid);
  if v_t is not null and public._tenant_bloqueado(v_t, tg_argv[0]) then
    raise exception 'Este estudio no admite esta operación en su estado actual (pausado, suspendido o cancelado). Contacta a ReserveOS.'
      using errcode = 'P0001', hint = 'estudio_bloqueado';
  end if;
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['reservas','membresias','pedidos','clientes','lista_espera','carritos','pago_transacciones'] loop
    execute format('drop trigger if exists guard_estado_tx on public.%I', t);
    execute format('create trigger guard_estado_tx before insert on public.%I for each row execute function public._guard_estado_tenant(%L)', t, 'tx');
  end loop;
  foreach t in array array['horarios','paquetes','sedes','productos','configuracion_reservas'] loop
    execute format('drop trigger if exists guard_estado_cfg on public.%I', t);
    execute format('create trigger guard_estado_cfg before insert or update or delete on public.%I for each row execute function public._guard_estado_tenant(%L)', t, 'cfg');
  end loop;
end $$;

-- Los pagos ya iniciados deben poder confirmarse aunque el estudio esté pausado o suspendido.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.pago_webhook(text,text,text,text)'::regprocedure);
  if d like '%and status = ''activo'';%' then
    execute replace(d, 'and status = ''activo'';', 'and status in (''activo'',''pausado'',''suspendido'');');
  end if;
end $$;
-- El evento que cierra funciones nuevas a anon también actúa al reemplazar: el webhook debe seguir siendo público (lo firma el proveedor).
grant execute on function public.pago_webhook(text,text,text,text) to anon, authenticated;

-- ───────────────────────── Cambio de estado con motivo, actor e historial ─────────────────────────
drop function if exists public.cambiar_estado_tenant_plataforma(uuid, text);
create or replace function public.cambiar_estado_tenant_plataforma(p_tenant_id uuid, p_status text, p_motivo text default null)
returns public.tenants
language plpgsql security definer set search_path to 'public' as $$
declare v_row public.tenants; v_old text; v_motivo text := nullif(trim(coalesce(p_motivo, '')), ''); v_nom text;
begin
  if not public.soy_staff_plataforma() then raise exception 'No autorizado'; end if;
  if p_status is null or p_status not in ('borrador','en_implantacion','activo','pausado','suspendido','cancelado') then
    raise exception 'Estado inválido';
  end if;
  select status into v_old from public.tenants where id = p_tenant_id for update;
  if v_old is null then raise exception 'Estudio no encontrado'; end if;
  if v_old = p_status then raise exception 'El estudio ya está en ese estado'; end if;
  if p_status in ('pausado','suspendido','cancelado') and (v_motivo is null or length(v_motivo) < 5) then
    raise exception 'Escribe el motivo (mínimo 5 caracteres)';
  end if;
  v_motivo := coalesce(v_motivo, case when v_old in ('pausado','suspendido','cancelado') then 'Reactivación' else 'Cambio de estado' end);
  select nombre into v_nom from public.plataforma_staff where user_id = auth.uid();

  update public.tenants set status = p_status, estado_motivo = v_motivo, estado_cambiado_at = now(),
         estado_cambiado_por = auth.uid(), updated_at = now()
   where id = p_tenant_id returning * into v_row;
  insert into public.tenant_estado_historial (tenant_id, estado_anterior, estado_nuevo, motivo, actor_id, actor_nombre)
    values (p_tenant_id, v_old, p_status, v_motivo, auth.uid(), v_nom);
  insert into public.admin_acciones_log (tenant_id, actor_id, actor_nombre, tabla, operacion, registro_id, detalle)
    values (p_tenant_id, auth.uid(), v_nom, 'plataforma_tenant_estado', 'estado', p_tenant_id::text,
            jsonb_build_object('de', v_old, 'a', p_status, 'motivo', v_motivo));
  return v_row;
end $$;
revoke all on function public.cambiar_estado_tenant_plataforma(uuid, text, text) from public, anon;
grant execute on function public.cambiar_estado_tenant_plataforma(uuid, text, text) to authenticated;

create or replace function public.tenant_estado_historial_listar(p_tenant_id uuid)
returns table(created_at timestamptz, estado_anterior text, estado_nuevo text, motivo text, actor text)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['soporte','auditor']) then raise exception 'No autorizado'; end if;
  return query select h.created_at, h.estado_anterior, h.estado_nuevo, h.motivo, coalesce(h.actor_nombre, 'Sistema')
    from public.tenant_estado_historial h where h.tenant_id = p_tenant_id order by h.created_at desc limit 50;
end $$;
revoke all on function public.tenant_estado_historial_listar(uuid) from public, anon;
grant execute on function public.tenant_estado_historial_listar(uuid) to authenticated;

-- ───────────────────────── Lista de estudios (O-06, O-11) ─────────────────────────
drop function if exists public.listar_tenants_plataforma();
create or replace function public.listar_tenants_plataforma()
returns table(id uuid, slug text, name text, status text, tipo text, created_at timestamptz, num_sedes bigint, num_staff bigint,
              clientas_registradas bigint, clientas_con_acceso bigint, estado_motivo text, estado_cambiado_at timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['soporte','ventas','finanzas']) then raise exception 'No autorizado'; end if;
  return query
  select t.id, t.slug, t.name, t.status, t.tipo, t.created_at,
    (select count(*) from public.sedes s where s.tenant_id = t.id),
    (select count(*) from public.tenant_memberships tm where tm.tenant_id = t.id),
    (select count(*) from public.clientes c where c.tenant_id = t.id and c.tutor_id is null),
    (select count(*) from public.clientes c where c.tenant_id = t.id and c.user_id is not null),
    t.estado_motivo, t.estado_cambiado_at
  from public.tenants t order by t.created_at desc;
end $$;
revoke all on function public.listar_tenants_plataforma() from public, anon;
grant execute on function public.listar_tenants_plataforma() to authenticated;

-- Los estudios demo/interno no cuentan en MRR, estudios activos ni suspendidos de la dirección.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.plataforma_resumen()'::regprocedure); n := d;
  n := replace(n, '(select count(*) from public.tenants where status = ''activo'')', '(select count(*) from public.tenants where status = ''activo'' and tipo = ''cliente'')');
  n := replace(n, 'sum(precio_mensual) from public.plataforma_suscripciones where estado = ''activa''',
    'sum(s.precio_mensual) from public.plataforma_suscripciones s join public.tenants tn on tn.id = s.tenant_id and tn.tipo = ''cliente'' where s.estado = ''activa''');
  if n <> d then execute n; end if;

  d := pg_get_functiondef('public.plataforma_direccion()'::regprocedure); n := d;
  n := replace(n, '(select count(*) from public.tenants where status = ''activo'')', '(select count(*) from public.tenants where status = ''activo'' and tipo = ''cliente'')');
  n := replace(n, '(select count(*) from public.tenants where status <> ''activo'')', '(select count(*) from public.tenants where status in (''pausado'',''suspendido'',''cancelado'') and tipo = ''cliente'')');
  if n <> d then execute n; end if;
end $$;

-- ───────────────────────── Acceso excepcional a datos del estudio (O-02) ─────────────────────────
create table if not exists public.acceso_excepcional_tenant (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  ticket_id uuid not null references public.plataforma_tickets(id),
  otorgado_a uuid not null,
  otorgado_nombre text,
  motivo text not null,
  alcance text[] not null check (cardinality(alcance) > 0 and alcance <@ array['clientas','finanzas']),
  expira_at timestamptz not null,
  revocado_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists acceso_excepcional_tenant_idx on public.acceso_excepcional_tenant (tenant_id, expira_at desc);
alter table public.acceso_excepcional_tenant enable row level security;
-- La dueña del estudio puede ver quién accedió a sus datos; el equipo de soporte/auditoría ve todo. Nadie escribe directo.
drop policy if exists acceso_excepcional_select on public.acceso_excepcional_tenant;
create policy acceso_excepcional_select on public.acceso_excepcional_tenant for select using (
  public._plat_ok(array['soporte','auditor'])
  or exists (select 1 from public.tenant_memberships m where m.tenant_id = acceso_excepcional_tenant.tenant_id
             and m.user_id = auth.uid() and m.role in ('duena','gerente_general')));

create or replace function public._acceso_ok(p_tenant uuid, p_alcance text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists(select 1 from public.acceso_excepcional_tenant a
    where a.tenant_id = p_tenant and a.otorgado_a = auth.uid() and a.revocado_at is null and a.expira_at > now() and p_alcance = any(a.alcance));
$$;

create or replace function public.acceso_excepcional_otorgar(p_tenant_id uuid, p_ticket_id uuid, p_motivo text, p_alcance text[], p_horas integer default 4)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; v_nom text; v_motivo text := trim(coalesce(p_motivo, ''));
begin
  if not exists (select 1 from public.plataforma_staff s where s.user_id = auth.uid() and s.rol in ('operador','soporte')) then
    raise exception 'No autorizado';
  end if;
  if not exists (select 1 from public.plataforma_tickets k where k.id = p_ticket_id and k.tenant_id = p_tenant_id and k.estado in ('abierto','en_curso')) then
    raise exception 'Se requiere un ticket abierto de este estudio';
  end if;
  if length(v_motivo) < 15 then raise exception 'Describe el motivo (mínimo 15 caracteres)'; end if;
  if p_alcance is null or cardinality(p_alcance) = 0 or not (p_alcance <@ array['clientas','finanzas']) then raise exception 'Alcance inválido'; end if;
  if p_horas is null or p_horas < 1 or p_horas > 72 then raise exception 'La duración debe ser de 1 a 72 horas'; end if;
  select nombre into v_nom from public.plataforma_staff where user_id = auth.uid();
  insert into public.acceso_excepcional_tenant (tenant_id, ticket_id, otorgado_a, otorgado_nombre, motivo, alcance, expira_at)
    values (p_tenant_id, p_ticket_id, auth.uid(), v_nom, v_motivo, p_alcance, now() + make_interval(hours => p_horas)) returning id into v_id;
  insert into public.admin_acciones_log (tenant_id, actor_id, actor_nombre, tabla, operacion, registro_id, detalle)
    values (p_tenant_id, auth.uid(), v_nom, 'plataforma_acceso_excepcional', 'otorgar', v_id::text,
            jsonb_build_object('ticket_id', p_ticket_id, 'motivo', v_motivo, 'alcance', p_alcance, 'horas', p_horas));
  return v_id;
end $$;

create or replace function public.acceso_excepcional_revocar(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_a public.acceso_excepcional_tenant; v_nom text;
begin
  if not public._plat_ok(array['soporte']) then raise exception 'No autorizado'; end if;
  select * into v_a from public.acceso_excepcional_tenant where id = p_id;
  if v_a.id is null then raise exception 'Acceso no encontrado'; end if;
  select nombre into v_nom from public.plataforma_staff where user_id = auth.uid();
  update public.acceso_excepcional_tenant set revocado_at = now() where id = p_id and revocado_at is null;
  insert into public.admin_acciones_log (tenant_id, actor_id, actor_nombre, tabla, operacion, registro_id, detalle)
    values (v_a.tenant_id, auth.uid(), v_nom, 'plataforma_acceso_excepcional', 'revocar', p_id::text, '{}'::jsonb);
end $$;

create or replace function public.acceso_excepcional_listar(p_tenant_id uuid)
returns table(id uuid, ticket_id uuid, otorgado_nombre text, motivo text, alcance text[], expira_at timestamptz, revocado_at timestamptz, vigente boolean, mio boolean, created_at timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['soporte','auditor']) then raise exception 'No autorizado'; end if;
  return query select a.id, a.ticket_id, a.otorgado_nombre, a.motivo, a.alcance, a.expira_at, a.revocado_at,
      (a.revocado_at is null and a.expira_at > now()), (a.otorgado_a = auth.uid()), a.created_at
    from public.acceso_excepcional_tenant a where a.tenant_id = p_tenant_id order by a.created_at desc limit 20;
end $$;

create or replace function public.acceso_excepcional_tickets(p_tenant_id uuid)
returns table(id uuid, asunto text, estado text, prioridad text)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['soporte']) then raise exception 'No autorizado'; end if;
  return query select k.id, k.asunto, k.estado, k.prioridad from public.plataforma_tickets k
    where k.tenant_id = p_tenant_id and k.estado in ('abierto','en_curso') order by k.created_at desc limit 20;
end $$;

-- Lectura de datos sensibles: exige un acceso vigente propio con ese alcance y deja registro de CADA lectura.
create or replace function public.owner_tenant_datos_sensibles(p_tenant_id uuid, p_alcance text, p_limite integer default 100, p_offset integer default 0)
returns json language plpgsql security definer set search_path to 'public' as $$
declare v_res json; v_nom text; v_lim int := least(greatest(coalesce(p_limite, 100), 1), 200); v_off int := greatest(coalesce(p_offset, 0), 0);
begin
  if not public._plat_ok(array['soporte']) then raise exception 'No autorizado'; end if;
  if p_alcance not in ('clientas','finanzas') then raise exception 'Alcance inválido'; end if;
  if not public._acceso_ok(p_tenant_id, p_alcance) then
    raise exception 'Sin acceso excepcional vigente para ver % de este estudio', p_alcance;
  end if;
  if p_alcance = 'clientas' then
    select json_build_object('total', (select count(*) from public.clientes where tenant_id = p_tenant_id),
      'clientas', coalesce((select json_agg(x) from (
        select c.id, c.nombre, c.telefono, c.email, (c.user_id is not null) as tiene_acceso
        from public.clientes c where c.tenant_id = p_tenant_id order by c.nombre limit v_lim offset v_off) x), '[]'::json))
    into v_res;
  else
    select json_build_object(
      'ingreso_mes', coalesce((select sum(coalesce(m.precio_final, pq.precio, 0)) from public.membresias m join public.paquetes pq on pq.id = m.paquete_id
          where m.tenant_id = p_tenant_id and m.pagada and m.confirmado_at is not null and date_trunc('month', m.confirmado_at) = date_trunc('month', now())), 0),
      'gastos_mes', coalesce((select sum(g.monto) from public.gastos g where g.tenant_id = p_tenant_id and date_trunc('month', g.fecha) = date_trunc('month', now())), 0))
    into v_res;
  end if;
  select nombre into v_nom from public.plataforma_staff where user_id = auth.uid();
  insert into public.admin_acciones_log (tenant_id, actor_id, actor_nombre, tabla, operacion, registro_id, detalle)
    values (p_tenant_id, auth.uid(), v_nom, 'plataforma_acceso_excepcional', 'lectura', p_tenant_id::text,
            jsonb_build_object('alcance', p_alcance, 'limite', v_lim, 'offset', v_off));
  return v_res;
end $$;

-- ───────────────────────── Ficha del estudio: solo metadatos y salud ─────────────────────────
create or replace function public.owner_tenant_detalle(p_tenant_id uuid)
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare v_tenant record; v_res json;
begin
  if not public._plat_ok(array['soporte']) then raise exception 'No autorizado'; end if;
  select id, slug, name, status, tipo, estado_motivo, estado_cambiado_at, created_at into v_tenant from public.tenants where id = p_tenant_id;
  if v_tenant.id is null then raise exception 'Estudio no encontrado'; end if;

  select json_build_object(
    'tenant', json_build_object('id', v_tenant.id, 'slug', v_tenant.slug, 'name', v_tenant.name, 'status', v_tenant.status, 'tipo', v_tenant.tipo,
              'estado_motivo', v_tenant.estado_motivo, 'estado_cambiado_at', v_tenant.estado_cambiado_at, 'created_at', v_tenant.created_at),
    'sedes', coalesce((select json_agg(json_build_object('id', s.id, 'name', s.name, 'timezone', s.timezone, 'status', s.status) order by s.name)
              from public.sedes s where s.tenant_id = p_tenant_id), '[]'::json),
    -- Equipo del estudio: nombre y rol; el correo solo de la dueña/gerencia general (contacto administrativo).
    'personal', coalesce((select json_agg(json_build_object('id', tm.id, 'nombre', tm.nombre, 'role', tm.role,
                  'email', case when tm.role in ('duena','gerente_general') then u.email end) order by tm.role, tm.nombre)
              from public.tenant_memberships tm join auth.users u on u.id = tm.user_id where tm.tenant_id = p_tenant_id), '[]'::json),
    'paquetes', coalesce((select json_agg(x) from (select p.id, p.nombre, p.precio, p.num_clases, p.activo from public.paquetes p
              where p.tenant_id = p_tenant_id order by p.activo desc, p.precio limit 50) x), '[]'::json),
    'proximas_clases', coalesce((select json_agg(x) from (select h.id, h.nombre_clase, h.dia_semana, h.hora_inicio, h.cupo_maximo, s.name as sede
              from public.horarios h join public.sedes s on s.id = h.sede_id
              where h.tenant_id = p_tenant_id and h.activo order by h.dia_semana, h.hora_inicio limit 50) x), '[]'::json),
    'contrato', (select json_build_object('estado', c.estado, 'fecha_firma', c.fecha_firma, 'vigencia_meses', c.vigencia_meses, 'mensualidad', c.mensualidad)
              from public.plataforma_contratos c where c.tenant_id = p_tenant_id order by c.created_at desc limit 1),
    'suscripcion', (select json_build_object('plan', s.plan, 'precio_mensual', s.precio_mensual, 'estado', s.estado)
              from public.plataforma_suscripciones s where s.tenant_id = p_tenant_id),
    'metricas', json_build_object(
      'clientas_registradas', (select count(*) from public.clientes c where c.tenant_id = p_tenant_id and c.tutor_id is null),
      'clientas_con_acceso', (select count(*) from public.clientes c where c.tenant_id = p_tenant_id and c.user_id is not null),
      'pagos_pendientes', (select count(*) from public.membresias m where m.tenant_id = p_tenant_id and m.pagada = false and m.estado = 'activa'),
      'reservas_7d', (select count(*) from public.reservas r where r.tenant_id = p_tenant_id and r.created_at > now() - interval '7 days'),
      'ultima_reserva', (select max(r.created_at) from public.reservas r where r.tenant_id = p_tenant_id),
      'errores_24h', (select coalesce(sum(l.veces), 0) from public.error_logs l where l.tenant_id = p_tenant_id and not l.resuelto and l.ultima_vez > now() - interval '24 hours'),
      'tickets_abiertos', (select count(*) from public.plataforma_tickets k where k.tenant_id = p_tenant_id and k.estado in ('abierto','en_curso')))
  ) into v_res;
  return v_res;
end $$;
revoke all on function public.owner_tenant_detalle(uuid) from public, anon;
grant execute on function public.owner_tenant_detalle(uuid) to authenticated;

do $$
declare f text;
begin
  foreach f in array array['acceso_excepcional_otorgar(uuid,uuid,text,text[],integer)','acceso_excepcional_revocar(uuid)','acceso_excepcional_listar(uuid)',
      'acceso_excepcional_tickets(uuid)','owner_tenant_datos_sensibles(uuid,text,integer,integer)','_acceso_ok(uuid,text)','_tenant_bloqueado(uuid,text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
