-- Paquetes: cobertura por sede, sede elegida al comprar y trazabilidad exacta del crédito.
--  1) Un paquete de "una sede" ahora registra CUÁL sede (antes no la registraba y quedaba sin cobertura en ninguna).
--  2) La cobertura adquirida queda fija en la membresía (snapshot); cambiar el catálogo después no la altera.
--  3) Cada reserva guarda la membresía cuyo crédito consumió, y al cancelar se devuelve exactamente allí.

alter table public.reservas add column if not exists membresia_id uuid references public.membresias(id) on delete set null;
alter table public.reservas add column if not exists credito_devuelto_at timestamptz;
create index if not exists reservas_membresia_idx on public.reservas (membresia_id) where membresia_id is not null;

-- Sede que corresponde a una compra: la elegida, o la única posible; si es ambiguo, se exige elegir.
create or replace function public._resolver_sede_compra(p_tenant_id uuid, p_paquete_id uuid, p_cliente_id uuid, p_sede_elegida uuid)
returns uuid language plpgsql stable security definer set search_path to 'public' as $$
declare v_paq record; v_n int; v_unica uuid; v_hab uuid; v_sede uuid;
begin
  select cobertura into v_paq from public.paquetes where id = p_paquete_id;
  if p_sede_elegida is not null then
    if not exists (select 1 from public.sedes where id = p_sede_elegida and tenant_id = p_tenant_id and status = 'activa') then raise exception 'La sede elegida no es válida.'; end if;
    if v_paq.cobertura = 'sedes' and not exists (select 1 from public.paquete_sedes where paquete_id = p_paquete_id and sede_id = p_sede_elegida) then
      raise exception 'Ese paquete no se puede usar en la sede elegida.';
    end if;
    return p_sede_elegida;
  end if;
  select count(*), min(sede_id::text)::uuid into v_n, v_unica from public.paquete_sedes where paquete_id = p_paquete_id;
  if v_n = 1 then return v_unica; end if;
  select sede_habitual_id into v_hab from public.clientes where id = p_cliente_id;
  if v_hab is not null and (v_paq.cobertura <> 'sedes' or exists (select 1 from public.paquete_sedes where paquete_id = p_paquete_id and sede_id = v_hab)) then return v_hab; end if;
  select count(*), min(id::text)::uuid into v_n, v_sede from public.sedes where tenant_id = p_tenant_id and status = 'activa';
  if v_n = 1 then return v_sede; end if;
  raise exception 'Elige en qué sede usarás este paquete.';
end $$;
revoke all on function public._resolver_sede_compra(uuid, uuid, uuid, uuid) from public;

-- Snapshot de cobertura al crear la membresía. Para 'sede' guarda la sede de venta; para 'sedes' copia las del paquete en ese momento;
-- para 'todas' no enumera (incluye sedes futuras, como define el maestro).
create or replace function public._snapshot_cobertura_membresia(p_membresia_id uuid, p_paquete_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_m record; v_sede uuid;
begin
  select * into v_m from public.membresias where id = p_membresia_id;
  if v_m is null then return; end if;
  if v_m.cobertura_tipo = 'todas' then return; end if;
  if v_m.cobertura_tipo = 'sedes' then
    insert into public.membresia_sedes (membresia_id, sede_id) select p_membresia_id, sede_id from public.paquete_sedes where paquete_id = p_paquete_id on conflict do nothing;
    if exists (select 1 from public.membresia_sedes where membresia_id = p_membresia_id) then return; end if;
  end if;
  v_sede := coalesce(v_m.sede_venta_id, public._resolver_sede_compra(v_m.tenant_id, p_paquete_id, v_m.cliente_id, null));
  if v_m.sede_venta_id is null then update public.membresias set sede_venta_id = v_sede where id = p_membresia_id; end if;
  insert into public.membresia_sedes (membresia_id, sede_id) values (p_membresia_id, v_sede) on conflict do nothing;
end $$;

-- Reparación de lo ya existente: membresías sin sede de venta o sin cobertura registrada.
do $$
declare r record; v_sede uuid;
begin
  for r in select m.* from public.membresias m where m.cobertura_tipo in ('sede','sedes')
      and not exists (select 1 from public.membresia_sedes ms where ms.membresia_id = m.id) loop
    begin
      perform public._snapshot_cobertura_membresia(r.id, r.paquete_id);
    exception when others then
      raise notice 'Membresía % sin cobertura resoluble: %', r.id, sqlerrm;
    end;
  end loop;
end $$;

-- ---------- Compra con elección de sede ----------
drop function if exists public.solicitar_membresia(uuid, text, text, text, uuid, text);
create or replace function public.solicitar_membresia(p_paquete_id uuid, p_referencia_pago text, p_metodo_pago text default 'transferencia', p_comprobante_url text default null,
  p_cliente_id uuid default null, p_codigo_descuento text default null, p_sede_id uuid default null)
returns json language plpgsql security definer set search_path to 'public' as $$
declare
  v_tenant_id uuid; v_propio_id uuid; v_cliente_id uuid; v_paquete record; v_membresia_id uuid; v_descuento_pct int := 0; v_codigo_id uuid; v_sede uuid;
begin
  select tenant_id into v_tenant_id from public.paquetes where id = p_paquete_id and activo = true;
  if v_tenant_id is null then raise exception 'Paquete no válido'; end if;
  v_propio_id := public.mi_cliente_id(v_tenant_id);
  if v_propio_id is null then raise exception 'Primero completa tu registro'; end if;
  v_cliente_id := v_propio_id;
  if p_cliente_id is not null and p_cliente_id <> v_propio_id then
    if not exists (select 1 from public.clientes where id = p_cliente_id and tutor_id = v_propio_id and tenant_id = v_tenant_id) then raise exception 'No tienes permiso para comprar un paquete para esa persona.'; end if;
    v_cliente_id := p_cliente_id;
  end if;
  select * into v_paquete from public.paquetes where id = p_paquete_id;
  if p_metodo_pago not in ('transferencia','tarjeta_estudio') then raise exception 'Método de pago no válido'; end if;
  if p_metodo_pago = 'transferencia' then
    p_referencia_pago := trim(p_referencia_pago);
    if coalesce(p_referencia_pago, '') = '' then raise exception 'Ingresa el número de referencia de tu transferencia'; end if;
    if length(regexp_replace(p_referencia_pago, '\s', '', 'g')) < 6 then raise exception 'Ese número de referencia se ve incompleto — cópialo tal cual aparece en tu comprobante de transferencia.'; end if;
    if p_referencia_pago ~ '^(.)\1*$' then raise exception 'Ese número de referencia no parece real — cópialo tal cual aparece en tu comprobante de transferencia.'; end if;
    if exists (select 1 from public.membresias where tenant_id = v_tenant_id and metodo_pago = 'transferencia' and estado <> 'anulada' and referencia_pago = p_referencia_pago) then
      raise exception 'Ese número de referencia ya se usó antes en otra solicitud. Si crees que es un error, contacta al estudio directamente.';
    end if;
  end if;
  if p_codigo_descuento is not null and trim(p_codigo_descuento) <> '' then
    select v.v_descuento_pct, v.v_codigo_id into v_descuento_pct, v_codigo_id from public._aplicar_codigo_descuento(v_tenant_id, p_codigo_descuento, p_paquete_id) v;
  end if;
  v_sede := public._resolver_sede_compra(v_tenant_id, p_paquete_id, v_cliente_id, p_sede_id);
  insert into public.membresias (tenant_id, cliente_id, paquete_id, sede_venta_id, cobertura_tipo, referencia_pago, metodo_pago, comprobante_url,
      descuento_pct, codigo_descuento_id, estado, clases_totales, clases_usadas, fecha_inicio, fecha_vencimiento, pagada)
    values (v_tenant_id, v_cliente_id, p_paquete_id, v_sede, v_paquete.cobertura, nullif(trim(p_referencia_pago), ''), p_metodo_pago, p_comprobante_url,
      v_descuento_pct, v_codigo_id, 'activa', 1, 0, public.hoy_en_sede(v_sede), public.hoy_en_sede(v_sede) + v_paquete.vigencia_dias, false)
    returning id into v_membresia_id;
  perform public._snapshot_cobertura_membresia(v_membresia_id, p_paquete_id);
  return json_build_object('ok', true, 'membresia_id', v_membresia_id, 'activa_al_instante', true, 'capada_a_una_clase', true, 'descuento_pct', v_descuento_pct, 'sede_id', v_sede);
end $$;
revoke all on function public.solicitar_membresia(uuid, text, text, text, uuid, text, uuid) from public;
grant execute on function public.solicitar_membresia(uuid, text, text, text, uuid, text, uuid) to authenticated;

drop function if exists public.iniciar_transaccion_pasarela(uuid, uuid, text, text);
create or replace function public.iniciar_transaccion_pasarela(p_tenant_id uuid, p_paquete_id uuid, p_codigo_descuento text default null, p_proveedor text default 'recurrente', p_sede_id uuid default null)
returns json language plpgsql security definer set search_path to 'public' as $$
declare v_cliente_id uuid; v_paquete record; v_descuento_pct int; v_codigo_id uuid; v_precio_final numeric; v_transaccion_id uuid; v_sede uuid;
begin
  v_cliente_id := public.mi_cliente_id(p_tenant_id);
  if v_cliente_id is null then raise exception 'No se encontró tu cuenta de clienta'; end if;
  select * into v_paquete from public.paquetes where id = p_paquete_id and tenant_id = p_tenant_id and activo = true;
  if v_paquete is null then raise exception 'Paquete no válido'; end if;
  select v.v_descuento_pct, v.v_codigo_id into v_descuento_pct, v_codigo_id from public._validar_codigo_descuento(p_tenant_id, p_codigo_descuento, p_paquete_id) v;
  v_precio_final := public._precio_con_descuento(p_paquete_id, v_paquete.precio, v_codigo_id, v_descuento_pct);
  v_sede := public._resolver_sede_compra(p_tenant_id, p_paquete_id, v_cliente_id, p_sede_id);   -- queda registrada la sede elegida
  insert into public.pago_transacciones (tenant_id, cliente_id, paquete_id, sede_venta_id, proveedor, monto, codigo_descuento_id, descuento_pct)
    values (p_tenant_id, v_cliente_id, p_paquete_id, v_sede, p_proveedor, v_precio_final, v_codigo_id, v_descuento_pct) returning id into v_transaccion_id;
  return json_build_object('transaccion_id', v_transaccion_id, 'monto', v_precio_final, 'nombre_paquete', v_paquete.nombre, 'sede_id', v_sede);
end $$;
revoke all on function public.iniciar_transaccion_pasarela(uuid, uuid, text, text, uuid) from public;
grant execute on function public.iniciar_transaccion_pasarela(uuid, uuid, text, text, uuid) to authenticated;

-- ---------- Devolución exacta de crédito ----------
create or replace function public.devolver_credito_reserva(p_reserva_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare r record;
begin
  select * into r from public.reservas where id = p_reserva_id for update;
  if r is null or r.credito_devuelto_at is not null then return; end if;     -- idempotente: nunca se devuelve dos veces
  if r.membresia_id is not null then
    update public.membresias set clases_usadas = greatest(clases_usadas - 1, 0) where id = r.membresia_id and clases_totales is not null;
  else
    perform public.devolver_clase_a_membresia(r.cliente_id);                  -- reservas anteriores a este cambio (sin vínculo)
  end if;
  update public.reservas set credito_devuelto_at = now() where id = p_reserva_id;
end $$;
revoke all on function public.devolver_credito_reserva(uuid) from public;

-- ---------- Vincular cada reserva con la membresía consumida y usar la devolución exacta ----------
do $$
declare
  r record; v_oid oid; v_def text; v_ok boolean;
begin
  -- consumo: (función, texto antes del cual se vincula, variable de la reserva)
  for r in select * from (values
    ('agendar_clase',          'return json_build_object(''ok'', true, ''reserva_id'', v_reserva_id, ''pago_pendiente'', v_pago_pendiente);', 'v_reserva_id', 'v_clases_totales'),
    ('admin_agregar_reserva',  'return json_build_object(''ok'', true, ''reserva_id'', v_reserva_id);',                                       'v_reserva_id', 'v_clases_totales'),
    ('agendar_clase_privada',  'return json_build_object(''ok'', true, ''reserva_id'', v_reserva_id);',                                       'v_reserva_id', 'null::int')
  ) as x(fn, ancla, rv, tot) loop
    for v_oid in select oid from pg_proc where proname = r.fn and pronamespace = 'public'::regnamespace loop
      v_def := pg_get_functiondef(v_oid);
      if v_def like '%reservas set membresia_id%' then continue; end if;
      if position(r.ancla in v_def) = 0 then raise exception 'No se encontró el punto de enlace en %', r.fn; end if;
      v_def := replace(v_def, r.ancla, format('update public.reservas set membresia_id = v_membresia_id, credito_devuelto_at = case when %s is null and v_membresia_id is not null then now() else null end where id = %s and v_membresia_id is not null;', r.tot, r.rv) || E'\n  ' || r.ancla);
      execute v_def;
    end loop;
  end loop;

  -- promoción de lista de espera
  select oid into v_oid from pg_proc where proname = 'promover_lista_espera' and pronamespace = 'public'::regnamespace;
  v_def := pg_get_functiondef(v_oid);
  if v_def not like '%reservas set membresia_id%' then
    if position('update public.membresias set clases_usadas = clases_usadas + 1 where id = v_membresia_id;' in v_def) = 0 then raise exception 'No se encontró el punto de enlace en promover_lista_espera'; end if;
    v_def := replace(v_def, 'update public.membresias set clases_usadas = clases_usadas + 1 where id = v_membresia_id;',
      'update public.membresias set clases_usadas = clases_usadas + 1 where id = v_membresia_id;' || E'\n    update public.reservas set membresia_id = v_membresia_id where id = v_nueva_reserva_id;');
    execute v_def;
  end if;

  -- devolución: cada cancelación devuelve el crédito de ESA reserva
  for r in select p.oid, p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and p.proname in
      ('admin_cancelar_reserva','cancelar_clase_fecha','cancelar_fecha_horario','cerrar_fechas','cancelar_mi_reserva') loop
    v_def := pg_get_functiondef(r.oid);
    if v_def ~ 'devolver_clase_a_membresia\(\w+\.cliente_id\)' then
      v_def := regexp_replace(v_def, 'devolver_clase_a_membresia\((\w+)\.cliente_id\)', 'devolver_credito_reserva(\1.id)', 'g');
      execute v_def;
    end if;
  end loop;
end $$;

-- ---------- El portal distingue paquetes con pago pendiente ----------
create or replace function public.mi_resumen(p_tenant_id uuid)
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare v_c record;
begin
  select * into v_c from public.clientes where user_id = auth.uid() and tenant_id = p_tenant_id limit 1;
  if v_c is null then return null; end if;
  return json_build_object(
    'cliente_id', v_c.id, 'nombre', v_c.nombre, 'telefono', v_c.telefono, 'email', v_c.email,
    'contacto_emergencia', v_c.contacto_emergencia, 'cuidados', v_c.cuidados_especiales,
    'consentimiento_pendiente', v_c.consentimiento_completado_at is null,
    'paquetes', coalesce((select json_agg(x order by x.vence) from (
        select m.id, p.nombre as paquete, case when not m.pagada then 'pendiente_pago' else m.estado end as estado, m.pagada, m.clases_totales as totales, m.clases_usadas as usadas, m.fecha_vencimiento as vence,
          m.congelada_desde is not null as congelada,
          (select string_agg(s.name, ', ' order by s.name) from public.membresia_sedes ms join public.sedes s on s.id = ms.sede_id where ms.membresia_id = m.id) as sedes,
          m.cobertura_tipo as cobertura
        from public.membresias m join public.paquetes p on p.id = m.paquete_id
        where m.cliente_id = v_c.id and m.estado = 'activa' order by m.fecha_vencimiento) x), '[]'::json),
    'proximas', coalesce((select json_agg(y order by y.fecha, y.hora) from (
        select r.id, r.fecha, h.hora_inicio as hora, h.nombre_clase as clase, s.name as sede, r.confirmada_por_clienta_at is not null as confirmada, c2.nombre as para
        from public.reservas r join public.horarios h on h.id = r.horario_id join public.sedes s on s.id = r.sede_id join public.clientes c2 on c2.id = r.cliente_id
        where (r.cliente_id = v_c.id or c2.tutor_id = v_c.id) and r.estado = 'confirmada' and r.fecha >= public.hoy_en_sede(r.sede_id)
        order by r.fecha, h.hora_inicio limit 20) y), '[]'::json)
  );
end $$;
