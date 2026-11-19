-- AUDITORÍA · tanda 5: PAG-05 (reembolso parcial), MEM-02 (anular una compra), COM-01/COM-02 (colas de mensajes y fiscal),
-- SAS-01/SAS-02 (alertas de atención de la consola). Misma técnica segura: se parchea el texto vivo y, si no coincide, se detiene.

create or replace function public._parchear_funcion(p_nombre text, p_ancla text, p_nuevo text, p_marca text, p_esperadas integer default 1)
returns void language plpgsql as $$
declare v_oid oid; v_def text; v_n integer;
begin
  select p.oid into v_oid from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = p_nombre;
  if v_oid is null then raise exception 'Se detiene: no existe la función %', p_nombre; end if;
  v_def := pg_get_functiondef(v_oid);
  if position(p_marca in v_def) > 0 then return; end if;
  v_n := (length(v_def) - length(replace(v_def, p_ancla, ''))) / greatest(length(p_ancla), 1);
  if v_n <> p_esperadas then raise exception 'Se detiene: en % se esperaban % coincidencias y hay % (el texto cambió)', p_nombre, p_esperadas, v_n; end if;
  execute replace(v_def, p_ancla, p_nuevo);
end $$;

-- ───────── PAG-05 · Un reembolso PARCIAL ya no anula la compra entera ─────────
select public._parchear_funcion('reembolso_resolver',
  'perform public.anular_cobro_membresia(v_r.membresia_id, ''Reembolso aprobado: '' || v_r.motivo);',
  E'if v_r.monto >= coalesce(v_m.precio_final, 0) - 0.01 then\n    perform public.anular_cobro_membresia(v_r.membresia_id, ''Reembolso aprobado: '' || v_r.motivo);\n  end if;   -- parcial: la compra sigue vigente y solo se registra la devolución de dinero',
  'v_r.monto >= coalesce(v_m.precio_final, 0) - 0.01');

-- Los reembolsos parciales (compra que sigue vigente) también restan del ingreso neto.
create or replace function public._ingreso_confirmado(p_tenant_id uuid, p_desde date, p_hasta date, p_sedes uuid[] default null)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with paq as (
    select coalesce(sum(coalesce(m.precio_final,0)),0) v from public.membresias m
     where m.tenant_id = p_tenant_id and m.pagada and (m.confirmado_at at time zone 'America/Guatemala')::date between p_desde and p_hasta
       and (p_sedes is null or m.sede_venta_id = any(p_sedes))),
  tie as (
    select coalesce(sum(greatest(p.total - coalesce((select sum(i.precio_unitario * coalesce(i.cantidad, 1)) from public.pedido_items i where i.pedido_id = p.id and i.tipo <> 'producto'), 0), 0)),0) v
      from public.pedidos p
     where p.tenant_id = p_tenant_id and p.estado in ('pagado','entregado') and (p.pagado_at at time zone 'America/Guatemala')::date between p_desde and p_hasta
       and (p_sedes is null or p.sede_entrega_id = any(p_sedes))),
  otr as (
    select coalesce(sum(c.monto),0) v from public.cobros_personalizados c
     where c.tenant_id = p_tenant_id and (c.confirmado_at at time zone 'America/Guatemala')::date between p_desde and p_hasta
       and (p_sedes is null or c.sede_id = any(p_sedes))),
  dev as (
    select coalesce(sum(coalesce((select r.monto from public.reembolsos r where r.membresia_id = m.id and r.estado in ('aprobado','devuelto') limit 1), m.precio_final, 0)),0)
         + coalesce((select sum(r.monto) from public.reembolsos r join public.membresias mm on mm.id = r.membresia_id
                      where r.tenant_id = p_tenant_id and mm.estado <> 'anulada' and r.estado in ('aprobado','devuelto')
                        and (r.resuelto_at at time zone 'America/Guatemala')::date between p_desde and p_hasta
                        and (p_sedes is null or mm.sede_venta_id = any(p_sedes))), 0) v
      from public.membresias m
     where m.tenant_id = p_tenant_id and m.pagada and m.estado = 'anulada' and (m.anulada_at at time zone 'America/Guatemala')::date between p_desde and p_hasta
       and (p_sedes is null or m.sede_venta_id = any(p_sedes)))
  select jsonb_build_object('paquetes', paq.v, 'tienda', tie.v, 'otros', otr.v, 'bruto', paq.v + tie.v + otr.v,
                            'devoluciones', dev.v, 'neto', paq.v + tie.v + otr.v - dev.v)
    from paq, tie, otr, dev;
$$;

-- ───────── MEM-02 · Anular una compra cancela SOLO las reservas ligadas a esa compra (antes movía contadores a otro paquete) ─────────
create or replace function public.anular_cobro_membresia(p_membresia_id uuid, p_motivo text default null)
returns json language plpgsql security definer set search_path to 'public' as $$
declare v_membresia record; v_canceladas integer := 0;
begin
  select * into v_membresia from public.membresias where id = p_membresia_id for update;
  if v_membresia is null then raise exception 'Cobro no encontrado'; end if;
  perform public._exigir_accion(v_membresia.tenant_id, v_membresia.sede_venta_id, 'P31');
  if not public.staff_puede_en_sede(v_membresia.tenant_id, v_membresia.sede_venta_id, array['admin_sede','duena','gerente_general','gerente_regional']) then
    raise exception 'No autorizado para anular un cobro';
  end if;
  if v_membresia.estado = 'anulada' then raise exception 'Este cobro ya estaba anulado'; end if;
  if not v_membresia.pagada then raise exception 'Esto todavía no es un cobro confirmado — usa "Eliminar" en pendientes en vez de anular'; end if;

  update public.membresias set estado = 'anulada', anulada_at = now(), anulada_por = auth.uid(), anulada_motivo = p_motivo where id = p_membresia_id;
  if v_membresia.codigo_descuento_id is not null then
    update public.codigos_descuento set usos_actuales = greatest(coalesce(usos_actuales,0) - 1, 0) where id = v_membresia.codigo_descuento_id;
  end if;

  with c as (
    update public.reservas set estado = 'cancelada'
     where membresia_id = p_membresia_id and estado = 'confirmada' and asistio is null and fecha >= public.hoy_en_sede(v_membresia.sede_venta_id)
    returning id)
  select count(*) into v_canceladas from c;

  return json_build_object('ok', true, 'clases_usadas', coalesce(v_membresia.clases_usadas, 0), 'clases_movidas', 0, 'reservas_canceladas', v_canceladas);
end $$;

-- ───────── COM-01 / COM-02 · Las colas se recuperan si un proceso se cae; marketing se revalida al enviar ─────────
alter table public.cola_mensajes add column if not exists tomado_at timestamptz;
alter table public.documentos_fiscales add column if not exists tomado_at timestamptz;

create or replace function public.cola_tomar(p_lote integer default 50)
returns table(id uuid, tenant_id uuid, canal text, destino text, asunto text, cuerpo text, intentos integer)
language plpgsql security definer set search_path to 'public' as $$
begin
  -- COM-02: una promoción ya encolada no se envía si la persona retiró su permiso.
  update public.cola_mensajes m set estado = 'cancelado', ultimo_error = 'Sin consentimiento de marketing vigente'
   where m.tipo = 'marketing' and m.estado in ('pendiente','fallido','enviando') and m.cliente_id is not null
     and not exists (select 1 from public.comunicacion_preferencias p where p.cliente_id = m.cliente_id and p.marketing_ok);
  return query
  with tomados as (
    select m.id from public.cola_mensajes m
     where ((m.estado in ('pendiente','fallido') and m.proximo_intento <= now())
            or (m.estado = 'enviando' and (m.tomado_at is null or m.tomado_at < now() - interval '15 minutes')))   -- COM-01: recupera lo abandonado por un proceso caído
       and m.intentos < 5
     order by m.proximo_intento limit least(greatest(p_lote, 1), 200) for update skip locked)
  update public.cola_mensajes m set estado = 'enviando', intentos = m.intentos + 1, tomado_at = now() from tomados t where m.id = t.id
  returning m.id, m.tenant_id, m.canal, m.destino, m.asunto, m.cuerpo, m.intentos;
end $$;
revoke all on function public.cola_tomar(integer) from public, anon, authenticated;
grant execute on function public.cola_tomar(integer) to service_role;

create or replace function public.fiscal_tomar(p_lote integer default 20)
returns table(id uuid, tenant_id uuid, nit_emisor text, razon_social text, nit_receptor text, nombre_receptor text, concepto text, monto numeric, iva numeric, regimen text)
language plpgsql security definer set search_path to 'public' as $$
begin
  return query
  with t as (select d.id from public.documentos_fiscales d
              where ((d.estado = 'pendiente') or (d.estado = 'enviando' and (d.tomado_at is null or d.tomado_at < now() - interval '15 minutes'))) and d.intentos < 5
              order by d.created_at limit least(greatest(p_lote,1),100) for update skip locked)
  update public.documentos_fiscales d set estado = 'enviando', intentos = d.intentos + 1, tomado_at = now() from t where d.id = t.id
  returning d.id, d.tenant_id, (select c.nit_emisor from public.configuracion_fiscal c where c.tenant_id = d.tenant_id), (select c.razon_social from public.configuracion_fiscal c where c.tenant_id = d.tenant_id),
    d.nit_receptor, d.nombre_receptor, d.concepto, d.monto, d.iva, (select c.regimen from public.configuracion_fiscal c where c.tenant_id = d.tenant_id);
end $$;
revoke all on function public.fiscal_tomar(integer) from public, anon, authenticated;
grant execute on function public.fiscal_tomar(integer) to service_role;

-- ───────── SAS-01 / SAS-02 · Alertas de atención: cobros parciales por su saldo y actividad de 7 días acotada ─────────
select public._parchear_funcion('_estudios_atencion',
  'select count(*) n, coalesce(sum(monto), 0) monto from public.plataforma_cobros where tenant_id = t.id and estado = ''pendiente'' and fecha_vencimiento < public.hoy_gt()',
  'select count(*) n, coalesce(sum(monto - coalesce(descuento, 0) - coalesce(monto_pagado, 0)), 0) monto from public.plataforma_cobros where tenant_id = t.id and estado in (''pendiente'', ''parcial'') and monto - coalesce(descuento, 0) - coalesce(monto_pagado, 0) > 0 and fecha_vencimiento < public.hoy_gt()',
  'estado in (''pendiente'', ''parcial'')');
select public._parchear_funcion('_estudios_atencion',
  'fecha >= public.hoy_gt() - 7)',
  'fecha between public.hoy_gt() - 7 and public.hoy_gt())',
  'fecha between public.hoy_gt() - 7 and public.hoy_gt()');

drop function public._parchear_funcion(text, text, text, text, integer);
