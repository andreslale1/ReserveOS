-- RO-07: facturación de ReserveOS a los estudios: cobros de distinto concepto (setup, licencia, sede extra,
-- módulo, otro), pagos parciales, descuento, instantánea del plan/precio al facturar, costos propios y margen.
-- Idempotencia: un cobro por (estudio, periodo, concepto); generar el mes dos veces no duplica nada.

alter table public.plataforma_cobros
  add column if not exists concepto text not null default 'licencia',
  add column if not exists descuento numeric not null default 0 check (descuento >= 0),
  add column if not exists monto_pagado numeric not null default 0 check (monto_pagado >= 0),
  add column if not exists plan_snapshot text,
  add column if not exists precio_snapshot numeric,
  add column if not exists notas text;
alter table public.plataforma_cobros drop constraint if exists plataforma_cobros_concepto_check;
alter table public.plataforma_cobros add constraint plataforma_cobros_concepto_check
  check (concepto in ('licencia','setup','sede_extra','modulo','app','otro'));
alter table public.plataforma_cobros drop constraint if exists plataforma_cobros_estado_check;
alter table public.plataforma_cobros add constraint plataforma_cobros_estado_check
  check (estado in ('pendiente','parcial','pagado','anulado'));
alter table public.plataforma_cobros drop constraint if exists plataforma_cobros_tenant_id_periodo_key;
create unique index if not exists plataforma_cobros_uni_idx on public.plataforma_cobros (tenant_id, periodo, concepto)
  where concepto = 'licencia';

-- Los cobros ya pagados antes de esta migración conservan su pago.
update public.plataforma_cobros set monto_pagado = monto where estado = 'pagado' and monto_pagado = 0;
update public.plataforma_cobros set plan_snapshot = (select plan from public.plataforma_suscripciones s where s.tenant_id = plataforma_cobros.tenant_id),
  precio_snapshot = monto where plan_snapshot is null;

create table if not exists public.plataforma_pagos (
  id uuid primary key default gen_random_uuid(),
  cobro_id uuid not null references public.plataforma_cobros(id) on delete cascade,
  monto numeric not null check (monto > 0),
  fecha date not null default current_date,
  metodo text not null default 'transferencia',
  referencia text,
  registrado_por uuid default auth.uid(),
  created_at timestamptz not null default now()
);
insert into public.plataforma_pagos (cobro_id, monto, fecha, metodo, referencia)
  select id, monto_pagado, coalesce(fecha_pago, current_date), coalesce(metodo,'transferencia'), referencia
  from public.plataforma_cobros c where monto_pagado > 0 and not exists (select 1 from public.plataforma_pagos p where p.cobro_id = c.id);

create table if not exists public.plataforma_costos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  categoria text not null check (categoria in ('infraestructura','mensajeria','dominios','soporte','app','marketing','otros')),
  descripcion text,
  monto numeric not null check (monto > 0),
  tenant_id uuid references public.tenants(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.plataforma_pagos enable row level security;
alter table public.plataforma_costos enable row level security;
revoke all on public.plataforma_pagos, public.plataforma_costos from anon, authenticated;

-- ---------- Cobros ----------
drop function if exists public.registrar_pago_cobro(uuid, text, text, date);
create or replace function public.registrar_pago_cobro(p_cobro_id uuid, p_metodo text, p_referencia text, p_fecha date, p_monto numeric default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_c record; v_monto numeric; v_saldo numeric;
begin
  if not public._plat_ok(array['finanzas']) then raise exception 'No autorizado'; end if;
  select * into v_c from public.plataforma_cobros where id = p_cobro_id for update;
  if v_c is null or v_c.estado in ('pagado','anulado') then raise exception 'El cobro no existe o ya no admite pagos'; end if;
  v_saldo := v_c.monto - v_c.descuento - v_c.monto_pagado;
  v_monto := coalesce(p_monto, v_saldo);
  if v_monto <= 0 then raise exception 'El monto del pago debe ser mayor a 0'; end if;
  if v_monto > v_saldo then raise exception 'El pago (Q%) supera el saldo pendiente (Q%)', v_monto, v_saldo; end if;
  insert into public.plataforma_pagos (cobro_id, monto, fecha, metodo, referencia)
    values (p_cobro_id, v_monto, coalesce(p_fecha, current_date), coalesce(nullif(p_metodo,''),'transferencia'), p_referencia);
  update public.plataforma_cobros set monto_pagado = monto_pagado + v_monto,
    estado = case when monto_pagado + v_monto >= monto - descuento then 'pagado' else 'parcial' end,
    fecha_pago = case when monto_pagado + v_monto >= monto - descuento then coalesce(p_fecha, current_date) else fecha_pago end,
    metodo = coalesce(nullif(p_metodo,''), metodo), referencia = coalesce(p_referencia, referencia)
  where id = p_cobro_id;
end $$;
revoke all on function public.registrar_pago_cobro(uuid, text, text, date, numeric) from public;
grant execute on function public.registrar_pago_cobro(uuid, text, text, date, numeric) to authenticated;

create or replace function public.anular_cobro_plataforma(p_cobro_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['finanzas']) then raise exception 'No autorizado'; end if;
  update public.plataforma_cobros set estado = 'anulado' where id = p_cobro_id and estado = 'pendiente' and monto_pagado = 0;
  if not found then raise exception 'Solo se anulan cobros pendientes sin pagos registrados'; end if;
end $$;

create or replace function public.cobro_crear(p_tenant_id uuid, p_concepto text, p_monto numeric, p_descuento numeric, p_vence date, p_notas text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; v_s record;
begin
  if not public._plat_ok(array['finanzas']) then raise exception 'No autorizado'; end if;
  if p_concepto not in ('setup','sede_extra','modulo','app','otro') then raise exception 'Concepto no válido (la licencia mensual se genera con "Generar cobros")'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'El monto debe ser mayor a 0'; end if;
  if coalesce(p_descuento,0) >= p_monto then raise exception 'El descuento no puede ser igual o mayor al monto'; end if;
  if not exists (select 1 from public.tenants where id = p_tenant_id) then raise exception 'Estudio no encontrado'; end if;
  select plan, precio_mensual into v_s from public.plataforma_suscripciones where tenant_id = p_tenant_id;
  insert into public.plataforma_cobros (tenant_id, periodo, monto, descuento, fecha_vencimiento, concepto, plan_snapshot, precio_snapshot, notas)
    values (p_tenant_id, date_trunc('month', current_date)::date, p_monto, coalesce(p_descuento,0), coalesce(p_vence, current_date + 15),
            p_concepto, v_s.plan, v_s.precio_mensual, p_notas) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.cobro_crear(uuid, text, numeric, numeric, date, text) from public;
grant execute on function public.cobro_crear(uuid, text, numeric, numeric, date, text) to authenticated;

create or replace function public.generar_cobros_mes(p_periodo date)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_n integer; v_per date := date_trunc('month', p_periodo)::date;
begin
  if not public._plat_ok(array['finanzas']) then raise exception 'No autorizado'; end if;
  insert into public.plataforma_cobros (tenant_id, periodo, monto, fecha_vencimiento, concepto, plan_snapshot, precio_snapshot)
  select s.tenant_id, v_per, s.precio_mensual, v_per + (s.dia_cobro - 1), 'licencia', s.plan, s.precio_mensual
  from public.plataforma_suscripciones s
  where s.estado = 'activa' and s.precio_mensual > 0 and s.fecha_alta <= (v_per + interval '1 month' - interval '1 day')::date
  on conflict (tenant_id, periodo) where concepto = 'licencia' do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ---------- Lecturas (saldo = monto - descuento - pagado) ----------
drop function if exists public.plataforma_estudios_cobro();
create or replace function public.plataforma_estudios_cobro()
returns table(tenant_id uuid, nombre text, slug text, status text, plan text, precio_mensual numeric, sub_estado text,
  pendiente numeric, en_mora numeric, dias_mora integer, ultimo_pago date)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['finanzas','soporte','ventas']) then raise exception 'No autorizado'; end if;
  return query
  select t.id, t.name, t.slug, t.status, s.plan, s.precio_mensual, s.estado,
    coalesce((select sum(c.monto - c.descuento - c.monto_pagado) from public.plataforma_cobros c where c.tenant_id = t.id and c.estado in ('pendiente','parcial')), 0),
    coalesce((select sum(c.monto - c.descuento - c.monto_pagado) from public.plataforma_cobros c where c.tenant_id = t.id and c.estado in ('pendiente','parcial') and c.fecha_vencimiento < current_date), 0),
    coalesce((select max(current_date - c.fecha_vencimiento) from public.plataforma_cobros c where c.tenant_id = t.id and c.estado in ('pendiente','parcial') and c.fecha_vencimiento < current_date), 0)::integer,
    (select max(p.fecha) from public.plataforma_pagos p join public.plataforma_cobros c on c.id = p.cobro_id where c.tenant_id = t.id)
  from public.tenants t left join public.plataforma_suscripciones s on s.tenant_id = t.id
  order by 9 desc, t.name;
end $$;
revoke all on function public.plataforma_estudios_cobro() from public;
grant execute on function public.plataforma_estudios_cobro() to authenticated;

drop function if exists public.plataforma_cobros_listar(text);
create or replace function public.plataforma_cobros_listar(p_estado text default null)
returns table(id uuid, tenant_id uuid, estudio text, periodo date, concepto text, monto numeric, descuento numeric, pagado numeric, saldo numeric,
  estado text, fecha_vencimiento date, fecha_pago date, metodo text, referencia text, en_mora boolean, plan_snapshot text, notas text)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['finanzas']) then raise exception 'No autorizado'; end if;
  return query
  select c.id, c.tenant_id, t.name, c.periodo, c.concepto, c.monto, c.descuento, c.monto_pagado, c.monto - c.descuento - c.monto_pagado,
    c.estado, c.fecha_vencimiento, c.fecha_pago, c.metodo, c.referencia,
    (c.estado in ('pendiente','parcial') and c.fecha_vencimiento < current_date), c.plan_snapshot, c.notas
  from public.plataforma_cobros c join public.tenants t on t.id = c.tenant_id
  where (p_estado is null and c.estado <> 'anulado') or c.estado = p_estado or (p_estado = 'abierto' and c.estado in ('pendiente','parcial'))
  order by c.periodo desc, t.name, c.concepto;
end $$;
revoke all on function public.plataforma_cobros_listar(text) from public;
grant execute on function public.plataforma_cobros_listar(text) to authenticated;

create or replace function public.plataforma_resumen()
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare v json;
begin
  if not public._plat_ok(array['finanzas','ventas','soporte']) then raise exception 'No autorizado'; end if;
  select json_build_object(
    'estudios_activos', (select count(*) from public.tenants where status = 'activo'),
    'mrr', coalesce((select sum(precio_mensual) from public.plataforma_suscripciones where estado = 'activa'), 0),
    'cobrado_mes', coalesce((select sum(monto) from public.plataforma_pagos where date_trunc('month', fecha) = date_trunc('month', current_date)), 0),
    'por_cobrar', coalesce((select sum(monto - descuento - monto_pagado) from public.plataforma_cobros where estado in ('pendiente','parcial')), 0),
    'en_mora', coalesce((select sum(monto - descuento - monto_pagado) from public.plataforma_cobros where estado in ('pendiente','parcial') and fecha_vencimiento < current_date), 0),
    'estudios_en_mora', (select count(distinct tenant_id) from public.plataforma_cobros where estado in ('pendiente','parcial') and fecha_vencimiento < current_date),
    'facturado_mes', coalesce((select sum(monto - descuento) from public.plataforma_cobros where estado <> 'anulado' and date_trunc('month', periodo) = date_trunc('month', current_date)), 0),
    'leads_abiertos', (select count(*) from public.plataforma_leads where etapa not in ('ganado','perdido')),
    'valor_pipeline', coalesce((select sum(valor_mensual) from public.plataforma_leads where etapa not in ('ganado','perdido')), 0)
  ) into v;
  return v;
end $$;

create or replace function public.mi_suscripcion(p_tenant_id uuid)
returns json language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then return null; end if;
  return json_build_object(
    'suscripcion', (select to_json(s) from (select plan, precio_mensual, dia_cobro, estado, fecha_alta from public.plataforma_suscripciones where tenant_id = p_tenant_id) s),
    'cobros', coalesce((select json_agg(c order by c.periodo desc) from (
        select periodo, concepto, monto - descuento as monto, monto_pagado, estado, fecha_vencimiento, fecha_pago
        from public.plataforma_cobros where tenant_id = p_tenant_id and estado <> 'anulado'
        order by periodo desc limit 24) c), '[]'::json)
  );
end $$;

-- ---------- Costos y rentabilidad ----------
create or replace function public.costo_guardar(p_fecha date, p_categoria text, p_descripcion text, p_monto numeric, p_tenant_id uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  if not public._plat_ok(array['finanzas']) then raise exception 'No autorizado'; end if;
  insert into public.plataforma_costos (fecha, categoria, descripcion, monto, tenant_id)
    values (coalesce(p_fecha, current_date), p_categoria, p_descripcion, p_monto, p_tenant_id) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.costo_guardar(date, text, text, numeric, uuid) from public;
grant execute on function public.costo_guardar(date, text, text, numeric, uuid) to authenticated;

create or replace function public.costo_eliminar(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['finanzas']) then raise exception 'No autorizado'; end if;
  delete from public.plataforma_costos where id = p_id;
end $$;
revoke all on function public.costo_eliminar(uuid) from public;
grant execute on function public.costo_eliminar(uuid) to authenticated;

create or replace function public.costos_listar(p_desde date, p_hasta date)
returns table(id uuid, fecha date, categoria text, descripcion text, monto numeric, estudio text)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['finanzas']) then raise exception 'No autorizado'; end if;
  return query select c.id, c.fecha, c.categoria, c.descripcion, c.monto, t.name
    from public.plataforma_costos c left join public.tenants t on t.id = c.tenant_id
    where c.fecha between p_desde and p_hasta order by c.fecha desc;
end $$;
revoke all on function public.costos_listar(date, date) from public;
grant execute on function public.costos_listar(date, date) to authenticated;

-- Rentabilidad: lo cobrado (pagos reales) menos costos, global y por estudio. Costos sin estudio son generales.
create or replace function public.plataforma_rentabilidad(p_desde date, p_hasta date)
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare v_ing numeric; v_cos numeric;
begin
  if not public._plat_ok(array['finanzas']) then raise exception 'No autorizado'; end if;
  select coalesce(sum(monto),0) into v_ing from public.plataforma_pagos where fecha between p_desde and p_hasta;
  select coalesce(sum(monto),0) into v_cos from public.plataforma_costos where fecha between p_desde and p_hasta;
  return json_build_object(
    'ingresos', v_ing, 'costos', v_cos, 'margen', v_ing - v_cos,
    'margen_pct', case when v_ing > 0 then round((v_ing - v_cos) / v_ing * 100, 1) else null end,
    'costos_por_categoria', coalesce((select json_agg(x) from (select categoria, sum(monto) monto from public.plataforma_costos
        where fecha between p_desde and p_hasta group by categoria order by 2 desc) x), '[]'::json),
    'por_estudio', coalesce((select json_agg(x order by x.margen desc) from (
        select t.name estudio,
          coalesce((select sum(p.monto) from public.plataforma_pagos p join public.plataforma_cobros c on c.id = p.cobro_id
                    where c.tenant_id = t.id and p.fecha between p_desde and p_hasta), 0) ingresos,
          coalesce((select sum(k.monto) from public.plataforma_costos k where k.tenant_id = t.id and k.fecha between p_desde and p_hasta), 0) costos,
          coalesce((select sum(p.monto) from public.plataforma_pagos p join public.plataforma_cobros c on c.id = p.cobro_id
                    where c.tenant_id = t.id and p.fecha between p_desde and p_hasta), 0)
          - coalesce((select sum(k.monto) from public.plataforma_costos k where k.tenant_id = t.id and k.fecha between p_desde and p_hasta), 0) margen
        from public.tenants t) x), '[]'::json),
    'costos_generales', coalesce((select sum(monto) from public.plataforma_costos where tenant_id is null and fecha between p_desde and p_hasta), 0)
  );
end $$;
revoke all on function public.plataforma_rentabilidad(date, date) from public;
grant execute on function public.plataforma_rentabilidad(date, date) to authenticated;
