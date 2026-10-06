-- ST-09: facturación del estudio (Guatemala, FEL). Define emisor, documento fiscal por venta, estados y anulaciones
-- coherentes con devoluciones. Dos caminos, según el contrato del estudio:
--   (a) un certificador conectado toma documentos con fiscal_tomar()/fiscal_resultado() (interfaz solo para el servidor);
--   (b) el estudio emite fuera de ReserveOS y registra aquí serie/número (factura_marcar_emitida), exportando los pendientes.
-- Un fallo de emisión nunca desaparece: queda en 'error' y se ve en el reporte.

create table if not exists public.configuracion_fiscal (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  nit_emisor text not null,
  razon_social text not null,
  nombre_comercial text,
  direccion_fiscal text not null,
  regimen text not null default 'general' check (regimen in ('general','pequeno_contribuyente')),
  serie text,
  updated_at timestamptz not null default now()
);
create table if not exists public.documentos_fiscales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sede_id uuid references public.sedes(id),
  origen_tipo text not null check (origen_tipo in ('membresia','pedido','cobro')),
  origen_id uuid not null,
  cliente_id uuid references public.clientes(id),
  nit_receptor text not null,
  nombre_receptor text not null,
  direccion_receptor text,
  concepto text not null,
  monto numeric not null check (monto > 0),
  iva numeric not null default 0,
  estado text not null default 'pendiente' check (estado in ('pendiente','enviando','emitido','error','anulacion_pendiente','anulado')),
  serie text,
  numero text,
  uuid_certificador text,
  error text,
  intentos integer not null default 0,
  motivo_anulacion text,
  emitido_at timestamptz,
  anulado_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index if not exists documentos_fiscales_origen_idx on public.documentos_fiscales (origen_tipo, origen_id) where estado <> 'anulado';
alter table public.configuracion_fiscal enable row level security;
alter table public.documentos_fiscales enable row level security;
revoke all on public.configuracion_fiscal, public.documentos_fiscales from anon, authenticated;

create or replace function public.fiscal_guardar_config(p_tenant_id uuid, p_nit text, p_razon text, p_comercial text, p_direccion text, p_regimen text, p_serie text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  perform public._exigir_accion(p_tenant_id, null::uuid, 'P36');
  perform public._exigir_modulo(p_tenant_id, 'finanzas_iva_fel');
  if p_nit is null or length(regexp_replace(p_nit, '[^0-9Kk]', '', 'g')) < 5 then raise exception 'NIT del emisor no válido'; end if;
  if p_razon is null or length(trim(p_razon)) < 3 then raise exception 'La razón social es obligatoria'; end if;
  if p_direccion is null or length(trim(p_direccion)) < 5 then raise exception 'La dirección fiscal es obligatoria'; end if;
  if p_regimen not in ('general','pequeno_contribuyente') then raise exception 'Régimen no válido'; end if;
  insert into public.configuracion_fiscal (tenant_id, nit_emisor, razon_social, nombre_comercial, direccion_fiscal, regimen, serie)
    values (p_tenant_id, upper(trim(p_nit)), trim(p_razon), nullif(trim(coalesce(p_comercial,'')),''), trim(p_direccion), p_regimen, nullif(trim(coalesce(p_serie,'')),''))
  on conflict (tenant_id) do update set nit_emisor = excluded.nit_emisor, razon_social = excluded.razon_social, nombre_comercial = excluded.nombre_comercial,
    direccion_fiscal = excluded.direccion_fiscal, regimen = excluded.regimen, serie = excluded.serie, updated_at = now();
end $$;
revoke all on function public.fiscal_guardar_config(uuid, text, text, text, text, text, text) from public;
grant execute on function public.fiscal_guardar_config(uuid, text, text, text, text, text, text) to authenticated;

create or replace function public.fiscal_config(p_tenant_id uuid)
returns json language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','contadora','admin_sede','recepcion']) then raise exception 'No autorizado'; end if;
  return (select to_json(c) from public.configuracion_fiscal c where c.tenant_id = p_tenant_id);
end $$;
revoke all on function public.fiscal_config(uuid) from public;
grant execute on function public.fiscal_config(uuid) to authenticated;

-- Ventas confirmadas de los últimos 60 días que aún no tienen documento fiscal.
create or replace function public.ventas_sin_factura(p_tenant_id uuid)
returns table(origen_tipo text, origen_id uuid, fecha date, sede_id uuid, sede text, cliente_id uuid, cliente text, concepto text, monto numeric)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','contadora','admin_sede','recepcion']) then raise exception 'No autorizado'; end if;
  return query
  select * from (
    select 'membresia'::text, m.id, m.confirmado_at::date, m.sede_venta_id, s.name, m.cliente_id, c.nombre, ('Paquete ' || p.nombre)::text, m.precio_final
      from public.membresias m join public.paquetes p on p.id = m.paquete_id join public.clientes c on c.id = m.cliente_id left join public.sedes s on s.id = m.sede_venta_id
      where m.tenant_id = p_tenant_id and m.pagada and m.estado = 'activa' and coalesce(m.precio_final, 0) > 0 and m.confirmado_at > now() - interval '60 days'
        and public.staff_puede_en_sede(p_tenant_id, m.sede_venta_id, array['duena','gerente_general','contadora','admin_sede','recepcion'])
    union all
    select 'pedido', o.id, o.pagado_at::date, o.sede_entrega_id, s.name, o.cliente_id, c.nombre, 'Compra en tienda', o.total
      from public.pedidos o join public.clientes c on c.id = o.cliente_id left join public.sedes s on s.id = o.sede_entrega_id
      where o.tenant_id = p_tenant_id and o.estado in ('pagado','entregado') and o.total > 0 and o.pagado_at > now() - interval '60 days'
        and public.staff_puede_en_sede(p_tenant_id, o.sede_entrega_id, array['duena','gerente_general','contadora','admin_sede','recepcion'])
    union all
    select 'cobro', k.id, k.confirmado_at::date, k.sede_id, s.name, k.cliente_id, c.nombre, k.concepto, k.monto
      from public.cobros_personalizados k join public.clientes c on c.id = k.cliente_id left join public.sedes s on s.id = k.sede_id
      where k.tenant_id = p_tenant_id and k.monto > 0 and k.confirmado_at > now() - interval '60 days'
        and public.staff_puede_en_sede(p_tenant_id, k.sede_id, array['duena','gerente_general','contadora','admin_sede','recepcion'])
  ) v where not exists (select 1 from public.documentos_fiscales d where d.origen_tipo = v.origen_tipo and d.origen_id = v.origen_id and d.estado <> 'anulado')
  order by 3 desc limit 200;
end $$;
revoke all on function public.ventas_sin_factura(uuid) from public;
grant execute on function public.ventas_sin_factura(uuid) to authenticated;

create or replace function public.factura_solicitar(p_tenant_id uuid, p_origen_tipo text, p_origen_id uuid, p_nit text, p_nombre text, p_direccion text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_cfg record; v_v record; v_id uuid; v_nit text := upper(regexp_replace(coalesce(p_nit,''), '[^0-9Kk]', '', 'g')); v_iva numeric;
begin
  perform public._exigir_modulo(p_tenant_id, 'finanzas_iva_fel');
  select * into v_cfg from public.configuracion_fiscal where tenant_id = p_tenant_id;
  if v_cfg is null then raise exception 'Primero registra los datos fiscales del estudio (NIT, razón social y dirección).'; end if;
  if v_nit = '' then v_nit := 'CF'; end if;                                   -- consumidor final
  if v_nit <> 'CF' and length(v_nit) < 5 then raise exception 'NIT del cliente no válido (usa CF para consumidor final)'; end if;
  if p_nombre is null or length(trim(p_nombre)) < 2 then
    if v_nit = 'CF' then p_nombre := 'Consumidor final'; else raise exception 'Escribe el nombre para la factura'; end if;
  end if;
  select * into v_v from public.ventas_sin_factura(p_tenant_id) x where x.origen_tipo = p_origen_tipo and x.origen_id = p_origen_id;
  if v_v is null then raise exception 'Esa venta no existe, ya tiene factura, o no tienes acceso a su sede.'; end if;
  v_iva := case when v_cfg.regimen = 'general' then round(v_v.monto / 1.12 * 0.12, 2) else 0 end;
  insert into public.documentos_fiscales (tenant_id, sede_id, origen_tipo, origen_id, cliente_id, nit_receptor, nombre_receptor, direccion_receptor, concepto, monto, iva)
    values (p_tenant_id, v_v.sede_id, p_origen_tipo, p_origen_id, v_v.cliente_id, v_nit, trim(p_nombre), nullif(trim(coalesce(p_direccion,'')),''), v_v.concepto, v_v.monto, v_iva) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.factura_solicitar(uuid, text, uuid, text, text, text) from public;
grant execute on function public.factura_solicitar(uuid, text, uuid, text, text, text) to authenticated;

-- Camino (b): el estudio emitió la factura por su cuenta y registra el resultado.
create or replace function public.factura_marcar_emitida(p_id uuid, p_serie text, p_numero text, p_uuid text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v record;
begin
  select * into v from public.documentos_fiscales where id = p_id for update;
  if v is null then raise exception 'Documento no encontrado'; end if;
  if not public.tengo_rol_en_tenant(v.tenant_id, array['duena','gerente_general','contadora','admin_sede','recepcion']) then raise exception 'No autorizado'; end if;
  if v.estado not in ('pendiente','error') then raise exception 'Este documento ya está %.', v.estado; end if;
  if p_numero is null or length(trim(p_numero)) < 1 then raise exception 'Escribe el número de la factura'; end if;
  update public.documentos_fiscales set estado = 'emitido', serie = nullif(trim(coalesce(p_serie,'')),''), numero = trim(p_numero), uuid_certificador = nullif(trim(coalesce(p_uuid,'')),''), emitido_at = now(), error = null where id = p_id;
end $$;
revoke all on function public.factura_marcar_emitida(uuid, text, text, text) from public;
grant execute on function public.factura_marcar_emitida(uuid, text, text, text) to authenticated;

create or replace function public.factura_anulada_manual(p_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v record;
begin
  select * into v from public.documentos_fiscales where id = p_id for update;
  if v is null then raise exception 'Documento no encontrado'; end if;
  perform public._exigir_accion(v.tenant_id, v.sede_id, 'P37');
  if not public.tengo_rol_en_tenant(v.tenant_id, array['duena','gerente_general','contadora']) then raise exception 'No autorizado'; end if;
  if v.estado not in ('emitido','anulacion_pendiente','pendiente','error') then raise exception 'Este documento ya está %.', v.estado; end if;
  if p_motivo is null or length(trim(p_motivo)) < 3 then raise exception 'Escribe el motivo'; end if;
  update public.documentos_fiscales set estado = 'anulado', anulado_at = now(), motivo_anulacion = trim(p_motivo) where id = p_id;
end $$;
revoke all on function public.factura_anulada_manual(uuid, text) from public;
grant execute on function public.factura_anulada_manual(uuid, text) to authenticated;

-- Una devolución deja la factura emitida marcada para anular (consistencia venta ↔ comprobante).
create or replace function public._tg_membresia_anulada_fiscal()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.estado = 'anulada' and old.estado <> 'anulada' then
    update public.documentos_fiscales set estado = 'anulacion_pendiente', motivo_anulacion = coalesce(new.anulada_motivo, 'Compra anulada')
      where origen_tipo = 'membresia' and origen_id = new.id and estado = 'emitido';
    update public.documentos_fiscales set estado = 'anulado', anulado_at = now(), motivo_anulacion = 'La compra se anuló antes de emitir'
      where origen_tipo = 'membresia' and origen_id = new.id and estado in ('pendiente','error');
  end if;
  return new;
end $$;
drop trigger if exists membresias_anulada_fiscal on public.membresias;
create trigger membresias_anulada_fiscal after update of estado on public.membresias for each row execute function public._tg_membresia_anulada_fiscal();

create or replace function public.documentos_fiscales_listar(p_tenant_id uuid, p_estado text default null)
returns table(id uuid, created_at timestamptz, sede text, concepto text, nit_receptor text, nombre_receptor text, monto numeric, iva numeric, estado text, serie text, numero text, error text, motivo_anulacion text)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','contadora','admin_sede','recepcion']) then raise exception 'No autorizado'; end if;
  return query select d.id, d.created_at, s.name, d.concepto, d.nit_receptor, d.nombre_receptor, d.monto, d.iva, d.estado, d.serie, d.numero, d.error, d.motivo_anulacion
    from public.documentos_fiscales d left join public.sedes s on s.id = d.sede_id
    where d.tenant_id = p_tenant_id and (p_estado is null or d.estado = p_estado)
      and public.staff_puede_en_sede(p_tenant_id, d.sede_id, array['duena','gerente_general','contadora','admin_sede','recepcion'])
    order by d.created_at desc limit 200;
end $$;
revoke all on function public.documentos_fiscales_listar(uuid, text) from public;
grant execute on function public.documentos_fiscales_listar(uuid, text) to authenticated;

-- Camino (a): interfaz para un certificador conectado (solo servidor).
create or replace function public.fiscal_tomar(p_lote integer default 20)
returns table(id uuid, tenant_id uuid, nit_emisor text, razon_social text, nit_receptor text, nombre_receptor text, concepto text, monto numeric, iva numeric, regimen text)
language plpgsql security definer set search_path to 'public' as $$
begin
  return query
  with t as (select d.id from public.documentos_fiscales d where d.estado = 'pendiente' and d.intentos < 5 order by d.created_at limit least(greatest(p_lote,1),100) for update skip locked)
  update public.documentos_fiscales d set estado = 'enviando', intentos = d.intentos + 1 from t where d.id = t.id
  returning d.id, d.tenant_id, (select c.nit_emisor from public.configuracion_fiscal c where c.tenant_id = d.tenant_id), (select c.razon_social from public.configuracion_fiscal c where c.tenant_id = d.tenant_id),
    d.nit_receptor, d.nombre_receptor, d.concepto, d.monto, d.iva, (select c.regimen from public.configuracion_fiscal c where c.tenant_id = d.tenant_id);
end $$;
revoke all on function public.fiscal_tomar(integer) from public;
grant execute on function public.fiscal_tomar(integer) to service_role;

create or replace function public.fiscal_resultado(p_id uuid, p_ok boolean, p_serie text, p_numero text, p_uuid text, p_error text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  update public.documentos_fiscales set
    estado = case when p_ok then 'emitido' when intentos >= 5 then 'error' else 'pendiente' end,
    serie = case when p_ok then p_serie else serie end, numero = case when p_ok then p_numero else numero end,
    uuid_certificador = case when p_ok then p_uuid else uuid_certificador end, emitido_at = case when p_ok then now() else emitido_at end,
    error = case when p_ok then null else left(p_error, 300) end
  where id = p_id and estado = 'enviando';
end $$;
revoke all on function public.fiscal_resultado(uuid, boolean, text, text, text, text) from public;
grant execute on function public.fiscal_resultado(uuid, boolean, text, text, text, text) to service_role;
