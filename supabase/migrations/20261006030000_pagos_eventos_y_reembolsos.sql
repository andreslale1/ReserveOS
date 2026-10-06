-- ST-05: pagos. (1) Corrige el checkout de tienda con pasarela (faltaba pago_transacciones.pedido_id).
-- (2) Eventos de proveedor: firma HMAC verificada con un secreto por estudio guardado en Vault, idempotentes (el mismo evento
--     dos veces no activa dos veces) y con verificación de monto. Pensado para que cualquier proveedor se conecte con un
--     adaptador que traduzca su evento al formato estándar de ReserveOS.
-- (3) Reembolsos: la clienta o el personal los solicitan, solo quien tenga la acción P31 (o delegación) los aprueba, y se
--     deja constancia de cuándo se devolvió el dinero realmente.

alter table public.pago_transacciones add column if not exists pedido_id uuid references public.pedidos(id) on delete set null;
alter table public.pago_transacciones drop constraint if exists pago_transacciones_estado_check;
alter table public.pago_transacciones add constraint pago_transacciones_estado_check
  check (estado in ('iniciado','confirmado','rechazado','reembolsado','revision'));   -- 'revision' = el proveedor reportó un monto distinto
create index if not exists pago_transacciones_proveedor_ref_idx on public.pago_transacciones (proveedor, proveedor_transaccion_id);

create table if not exists public.pago_eventos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  proveedor text not null,
  event_id text not null,
  tipo text,
  referencia text,
  monto numeric,
  resultado text not null,
  recibido_at timestamptz not null default now(),
  unique (proveedor, event_id, tenant_id)
);
alter table public.pago_eventos enable row level security;
revoke all on public.pago_eventos from anon, authenticated;

create table if not exists public.reembolsos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  membresia_id uuid not null references public.membresias(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  monto numeric not null check (monto > 0),
  motivo text not null,
  estado text not null default 'solicitado' check (estado in ('solicitado','aprobado','rechazado','devuelto')),
  solicitado_por uuid default auth.uid(),
  solicitado_por_clienta boolean not null default false,
  resuelto_por uuid,
  resuelto_at timestamptz,
  nota_resolucion text,
  devuelto_at timestamptz,
  referencia_devolucion text,
  created_at timestamptz not null default now()
);
create unique index if not exists reembolsos_uno_abierto_idx on public.reembolsos (membresia_id) where estado in ('solicitado','aprobado');
alter table public.reembolsos enable row level security;
revoke all on public.reembolsos from anon, authenticated;

-- ---------- Secreto de webhook por estudio ----------
-- Devuelve el secreto UNA sola vez (para pegarlo en el proveedor); en la base queda solo dentro de Vault.
create or replace function public.generar_secreto_webhook(p_tenant_id uuid, p_proveedor text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_secret text; v_id uuid;
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena']) then raise exception 'Solo la dueña configura los pagos en línea'; end if;
  perform public._exigir_modulo(p_tenant_id, 'cobros_online');
  if p_proveedor !~ '^[a-z0-9_-]{2,30}$' then raise exception 'Nombre de proveedor no válido (minúsculas, números y guiones)'; end if;
  v_secret := encode(extensions.gen_random_bytes(32), 'hex');
  select vault.create_secret(v_secret, p_tenant_id::text || ':webhook:' || p_proveedor || ':' || extract(epoch from now())::bigint, 'Secreto de webhook de pagos') into v_id;
  insert into public.integracion_pagos (tenant_id, proveedor, secret_id, activo) values (p_tenant_id, p_proveedor, v_id, true)
    on conflict (tenant_id) do update set proveedor = excluded.proveedor, secret_id = excluded.secret_id, activo = true, updated_at = now();
  return v_secret;
end $$;
revoke all on function public.generar_secreto_webhook(uuid, text) from public;
grant execute on function public.generar_secreto_webhook(uuid, text) to authenticated;

-- ---------- Evento de proveedor (público, protegido por firma) ----------
create or replace function public.pago_webhook(p_slug text, p_proveedor text, p_firma text, p_cuerpo text)
returns json language plpgsql security definer set search_path to 'public' as $$
declare
  v_t uuid; v_cfg record; v_secret text; v_calc text; v_j jsonb; v_event text; v_tipo text; v_ref text; v_monto numeric; v_ts bigint;
  v_tx record; v_res text := 'ignorado'; v_n int;
begin
  select id into v_t from public.tenants where slug = lower(trim(p_slug)) and status = 'activo';
  if v_t is null then raise exception 'Solicitud no válida'; end if;
  select * into v_cfg from public.integracion_pagos where tenant_id = v_t and proveedor = lower(p_proveedor) and activo and secret_id is not null;
  if v_cfg is null then raise exception 'Solicitud no válida'; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where id = v_cfg.secret_id;
  if v_secret is null then raise exception 'Solicitud no válida'; end if;
  v_calc := encode(extensions.hmac(p_cuerpo, v_secret, 'sha256'), 'hex');
  if v_calc <> lower(regexp_replace(coalesce(p_firma, ''), '^sha256=', '')) then raise exception 'Firma inválida'; end if;

  begin v_j := p_cuerpo::jsonb; exception when others then raise exception 'Cuerpo no válido'; end;
  v_event := v_j->>'event_id'; v_tipo := v_j->>'type'; v_ref := v_j->>'reference'; v_monto := nullif(v_j->>'amount','')::numeric; v_ts := nullif(v_j->>'ts','')::bigint;
  if v_event is null or v_tipo is null then raise exception 'Evento incompleto'; end if;
  if v_ts is not null and abs(extract(epoch from now())::bigint - v_ts) > 600 then raise exception 'Evento fuera de tiempo (posible repetición)'; end if;

  -- Idempotencia: el mismo evento solo se procesa una vez.
  insert into public.pago_eventos (tenant_id, proveedor, event_id, tipo, referencia, monto, resultado) values (v_t, lower(p_proveedor), v_event, v_tipo, v_ref, v_monto, 'recibido')
    on conflict (proveedor, event_id, tenant_id) do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then return json_build_object('ok', true, 'duplicado', true); end if;

  select * into v_tx from public.pago_transacciones where tenant_id = v_t and (id::text = v_ref or proveedor_transaccion_id = v_ref) order by created_at desc limit 1;
  if v_tx is null then
    update public.pago_eventos set resultado = 'sin_transaccion' where tenant_id = v_t and proveedor = lower(p_proveedor) and event_id = v_event;
    return json_build_object('ok', true, 'resultado', 'sin_transaccion');
  end if;
  if v_tx.proveedor_transaccion_id is null and v_tx.id::text <> v_ref then update public.pago_transacciones set proveedor_transaccion_id = v_ref where id = v_tx.id; end if;

  if v_tipo = 'payment.succeeded' then
    if v_monto is not null and abs(v_monto - v_tx.monto) > 0.01 then
      update public.pago_transacciones set estado = 'revision', actualizado_at = now(), metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('monto_reportado', v_monto) where id = v_tx.id and estado = 'iniciado';
      v_res := 'monto_distinto';
    elsif v_tx.estado = 'confirmado' then v_res := 'ya_confirmado';
    elsif v_tx.estado not in ('iniciado','revision') then v_res := 'estado_no_valido';
    elsif v_tx.pedido_id is not null then perform public.confirmar_transaccion_carrito(v_tx.id); v_res := 'confirmado';
    else perform public.confirmar_pago_transaccion(v_tx.id); v_res := 'confirmado'; end if;
  elsif v_tipo = 'payment.failed' then
    update public.pago_transacciones set estado = 'rechazado', actualizado_at = now() where id = v_tx.id and estado = 'iniciado'; v_res := 'rechazado';
  elsif v_tipo = 'refund.succeeded' then
    update public.pago_transacciones set estado = 'reembolsado', actualizado_at = now() where id = v_tx.id and estado = 'confirmado';
    update public.reembolsos set estado = 'devuelto', devuelto_at = now(), referencia_devolucion = coalesce(v_event, referencia_devolucion)
      where membresia_id = v_tx.membresia_id and estado = 'aprobado';
    v_res := 'reembolsado';
  end if;
  update public.pago_eventos set resultado = v_res where tenant_id = v_t and proveedor = lower(p_proveedor) and event_id = v_event;
  return json_build_object('ok', true, 'resultado', v_res);
end $$;
revoke all on function public.pago_webhook(text, text, text, text) from public;
grant execute on function public.pago_webhook(text, text, text, text) to anon, authenticated, service_role;

-- ---------- Reembolsos ----------
create or replace function public.reembolso_solicitar(p_membresia_id uuid, p_monto numeric, p_motivo text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_m record; v_propio uuid; v_es_clienta boolean := false; v_id uuid;
begin
  select * into v_m from public.membresias where id = p_membresia_id;
  if v_m is null then raise exception 'Compra no encontrada'; end if;
  v_propio := public.mi_cliente_id(v_m.tenant_id);
  if v_propio is not null and (v_m.cliente_id = v_propio) then v_es_clienta := true;
  elsif not public.tengo_rol_en_tenant(v_m.tenant_id, array['duena','gerente_general','admin_sede','recepcion']) then raise exception 'No autorizado'; end if;
  if not v_m.pagada or v_m.estado = 'anulada' then raise exception 'Solo se pueden reembolsar compras pagadas y vigentes'; end if;
  if p_monto is null or p_monto <= 0 or p_monto > coalesce(v_m.precio_final, 0) then raise exception 'El monto debe ser mayor a 0 y no superar lo pagado (Q%)', coalesce(v_m.precio_final, 0); end if;
  if p_motivo is null or length(trim(p_motivo)) < 4 then raise exception 'Cuéntanos el motivo del reembolso'; end if;
  insert into public.reembolsos (tenant_id, membresia_id, cliente_id, monto, motivo, solicitado_por_clienta)
    values (v_m.tenant_id, p_membresia_id, v_m.cliente_id, p_monto, trim(p_motivo), v_es_clienta) returning id into v_id;
  return v_id;
exception when unique_violation then raise exception 'Esta compra ya tiene un reembolso en trámite';
end $$;
revoke all on function public.reembolso_solicitar(uuid, numeric, text) from public;
grant execute on function public.reembolso_solicitar(uuid, numeric, text) to authenticated;

create or replace function public.reembolso_resolver(p_id uuid, p_aprobar boolean, p_nota text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_r record; v_m record;
begin
  select * into v_r from public.reembolsos where id = p_id for update;
  if v_r is null or v_r.estado <> 'solicitado' then raise exception 'Esta solicitud ya fue resuelta'; end if;
  select * into v_m from public.membresias where id = v_r.membresia_id;
  perform public._exigir_accion(v_r.tenant_id, v_m.sede_venta_id, 'P31');
  if not public.staff_puede_en_sede(v_r.tenant_id, v_m.sede_venta_id, array['duena','gerente_general','admin_sede']) then raise exception 'No autorizado'; end if;
  if not p_aprobar then
    if p_nota is null or length(trim(p_nota)) < 3 then raise exception 'Explica por qué se rechaza'; end if;
    update public.reembolsos set estado = 'rechazado', resuelto_por = auth.uid(), resuelto_at = now(), nota_resolucion = trim(p_nota) where id = p_id;
    return;
  end if;
  -- Aprobar anula la compra (devuelve lo no usado, cancela reservas futuras) y deja el reembolso pendiente de devolver el dinero.
  perform public.anular_cobro_membresia(v_r.membresia_id, 'Reembolso aprobado: ' || v_r.motivo);
  update public.reembolsos set estado = 'aprobado', resuelto_por = auth.uid(), resuelto_at = now(), nota_resolucion = nullif(trim(coalesce(p_nota,'')),'') where id = p_id;
end $$;
revoke all on function public.reembolso_resolver(uuid, boolean, text) from public;
grant execute on function public.reembolso_resolver(uuid, boolean, text) to authenticated;

create or replace function public.reembolso_marcar_devuelto(p_id uuid, p_referencia text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_r record;
begin
  select * into v_r from public.reembolsos where id = p_id;
  if v_r is null or v_r.estado <> 'aprobado' then raise exception 'Solo se marca como devuelto un reembolso aprobado'; end if;
  if not public.tengo_rol_en_tenant(v_r.tenant_id, array['duena','gerente_general','contadora','admin_sede']) then raise exception 'No autorizado'; end if;
  update public.reembolsos set estado = 'devuelto', devuelto_at = now(), referencia_devolucion = nullif(trim(coalesce(p_referencia,'')),'') where id = p_id;
end $$;
revoke all on function public.reembolso_marcar_devuelto(uuid, text) from public;
grant execute on function public.reembolso_marcar_devuelto(uuid, text) to authenticated;

create or replace function public.reembolsos_listar(p_tenant_id uuid)
returns table(id uuid, clienta text, paquete text, monto numeric, motivo text, estado text, por_clienta boolean, created_at timestamptz, resuelto_at timestamptz, nota text, devuelto_at timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','admin_sede','contadora']) then raise exception 'No autorizado'; end if;
  return query select r.id, c.nombre, p.nombre, r.monto, r.motivo, r.estado, r.solicitado_por_clienta, r.created_at, r.resuelto_at, r.nota_resolucion, r.devuelto_at
    from public.reembolsos r join public.clientes c on c.id = r.cliente_id join public.membresias m on m.id = r.membresia_id join public.paquetes p on p.id = m.paquete_id
    where r.tenant_id = p_tenant_id order by (r.estado in ('devuelto','rechazado')), r.created_at desc limit 100;
end $$;
revoke all on function public.reembolsos_listar(uuid) from public;
grant execute on function public.reembolsos_listar(uuid) to authenticated;

-- Transacciones en línea del estudio (para ver qué cobró el proveedor y qué quedó en revisión).
create or replace function public.transacciones_listar(p_tenant_id uuid)
returns table(id uuid, created_at timestamptz, clienta text, concepto text, monto numeric, estado text, proveedor text, referencia text)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','admin_sede','contadora']) then raise exception 'No autorizado'; end if;
  return query select t.id, t.created_at, c.nombre, case when t.pedido_id is not null then 'Tienda' else coalesce((select pq.nombre from public.paquetes pq where pq.id = t.paquete_id), 'Paquete') end,
      t.monto, t.estado, t.proveedor, t.proveedor_transaccion_id
    from public.pago_transacciones t join public.clientes c on c.id = t.cliente_id where t.tenant_id = p_tenant_id order by t.created_at desc limit 100;
end $$;
revoke all on function public.transacciones_listar(uuid) from public;
grant execute on function public.transacciones_listar(uuid) to authenticated;
