-- AUDITORÍA · tanda 1 de dinero y créditos: PAG-01, PAG-02 (precio), RES-01, RES-02, SEC-04/MEM-01, FIN-01, FIN-02, ESP-02.
-- Técnica segura: cada función viva se parchea a partir de su texto real (pg_get_functiondef). Si el texto no se reconoce
-- (cambió en producción), la migración se DETIENE con un mensaje y no cambia nada. Es repetible: lo ya parcheado se omite.

create or replace function public._parchear_funcion(p_nombre text, p_ancla text, p_nuevo text, p_marca text)
returns void language plpgsql as $$
declare v_oid oid; v_def text; v_n integer;
begin
  select p.oid into v_oid from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = p_nombre;
  if v_oid is null then raise exception 'Se detiene: no existe la función %', p_nombre; end if;
  v_def := pg_get_functiondef(v_oid);
  if position(p_marca in v_def) > 0 then return; end if;                     -- ya parcheada
  v_n := (length(v_def) - length(replace(v_def, p_ancla, ''))) / greatest(length(p_ancla), 1);
  if v_n <> 1 then raise exception 'Se detiene: en % se esperaba 1 coincidencia y hay % (el texto cambió)', p_nombre, v_n; end if;
  execute replace(v_def, p_ancla, p_nuevo);
end $$;

-- ───────── PAG-01 · Confirmar un pago es idempotente y nunca reactiva una compra anulada o rechazada ─────────
select public._parchear_funcion('confirmar_pago_membresia',
  'select tenant_id, cliente_id, paquete_id, sede_venta_id, descuento_pct into v_membresia from public.membresias where id = p_membresia_id;',
  'select tenant_id, cliente_id, paquete_id, sede_venta_id, descuento_pct, estado, pagada, precio_final into v_membresia from public.membresias where id = p_membresia_id for update;',
  'estado, pagada, precio_final into v_membresia');
select public._parchear_funcion('confirmar_pago_membresia',
  'select num_clases, vigencia_dias, precio into v_paquete from public.paquetes where id = v_membresia.paquete_id;',
  E'if v_membresia.pagada and v_membresia.estado = ''activa'' then\n    return json_build_object(''ok'', true, ''ya_confirmada'', true, ''precio_final'', v_membresia.precio_final);\n  end if;\n  if v_membresia.estado in (''anulada'', ''rechazada'', ''vencida'') then raise exception ''Esta compra está % y no se puede confirmar.'', v_membresia.estado; end if;\n  select num_clases, vigencia_dias, precio into v_paquete from public.paquetes where id = v_membresia.paquete_id;',
  'ya_confirmada');
-- PAG-02 (precio): el importe pactado al solicitar no cambia si el catálogo se edita antes de pagar.
select public._parchear_funcion('confirmar_pago_membresia',
  'v_precio_final := round(v_paquete.precio * (1 - coalesce(v_membresia.descuento_pct, 0) / 100.0), 2);',
  'v_precio_final := coalesce(v_membresia.precio_final, round(v_paquete.precio * (1 - coalesce(v_membresia.descuento_pct, 0) / 100.0), 2));',
  'coalesce(v_membresia.precio_final');

-- ───────── RES-01 · Una solicitud pendiente por persona (antes: cada solicitud regalaba otra clase) ─────────
select public._parchear_funcion('solicitar_membresia',
  'select * into v_paquete from public.paquetes where id = p_paquete_id;',
  E'if exists (select 1 from public.membresias where tenant_id = v_tenant_id and cliente_id = v_cliente_id and pagada = false and estado = ''activa'') then\n    raise exception ''Ya tienes un pago pendiente de confirmación. Cuando el estudio lo confirme o lo rechace podrás solicitar otro paquete.'';\n  end if;\n  select * into v_paquete from public.paquetes where id = p_paquete_id;',
  'Ya tienes un pago pendiente');
-- PAG-02: se guarda el importe al solicitar.
select public._parchear_funcion('solicitar_membresia',
  'descuento_pct, codigo_descuento_id, estado, clases_totales, clases_usadas, fecha_inicio, fecha_vencimiento, pagada)',
  'descuento_pct, codigo_descuento_id, precio_final, estado, clases_totales, clases_usadas, fecha_inicio, fecha_vencimiento, pagada)',
  'codigo_descuento_id, precio_final, estado');
select public._parchear_funcion('solicitar_membresia',
  'v_descuento_pct, v_codigo_id, ''activa'', 1, 0,',
  'v_descuento_pct, v_codigo_id, round(v_paquete.precio * (1 - v_descuento_pct / 100.0), 2), ''activa'', 1, 0,',
  'v_codigo_id, round(v_paquete.precio');

-- ───────── RES-02 · Rechazar una transferencia usa un estado que el CHECK no admitía ─────────
alter table public.membresias drop constraint if exists membresias_estado_check;
alter table public.membresias add constraint membresias_estado_check check (estado in ('pendiente_pago','activa','vencida','anulada','rechazada'));

-- ───────── SEC-04 / MEM-01 · Rechazar o eliminar un pendiente cancela SOLO las reservas de ESA compra ─────────
create or replace function public._cancelar_reservas_de_membresia_rechazada(p_membresia_id uuid, p_cliente_id uuid, p_clases_usadas integer, p_membresia_created_at timestamptz)
returns table(reserva_id uuid, fecha date, hora_inicio time, nombre_clase text)
language plpgsql security definer set search_path to 'public' as $$
declare v_reserva record;
begin
  for v_reserva in
    select r.id, r.fecha, h.hora_inicio, h.nombre_clase
      from public.reservas r join public.horarios h on h.id = r.horario_id
     where r.membresia_id = p_membresia_id and r.estado = 'confirmada' and r.asistio is null and r.fecha >= public.hoy_gt()
     order by r.fecha, h.hora_inicio
       for update of r
  loop
    update public.reservas set estado = 'cancelada' where id = v_reserva.id;
    reserva_id := v_reserva.id; fecha := v_reserva.fecha; hora_inicio := v_reserva.hora_inicio; nombre_clase := v_reserva.nombre_clase;
    return next;
  end loop;
end $$;

-- ───────── FIN-01 · Un paquete vendido por la tienda se cuenta UNA vez; FIN-02 · los cobros se imputan al día de Guatemala ─────────
create or replace function public._ingreso_confirmado(p_tenant_id uuid, p_desde date, p_hasta date, p_sedes uuid[] default null)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with paq as (
    select coalesce(sum(coalesce(m.precio_final,0)),0) v from public.membresias m
     where m.tenant_id = p_tenant_id and m.pagada and (m.confirmado_at at time zone 'America/Guatemala')::date between p_desde and p_hasta
       and (p_sedes is null or m.sede_venta_id = any(p_sedes))),
  -- La tienda aporta solo lo que NO es un paquete: los paquetes de un pedido ya entran arriba como membresías pagadas.
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
    select coalesce(sum(coalesce((select r.monto from public.reembolsos r where r.membresia_id = m.id and r.estado in ('aprobado','devuelto') limit 1), m.precio_final, 0)),0) v
      from public.membresias m
     where m.tenant_id = p_tenant_id and m.pagada and m.estado = 'anulada' and (m.anulada_at at time zone 'America/Guatemala')::date between p_desde and p_hasta
       and (p_sedes is null or m.sede_venta_id = any(p_sedes)))
  select jsonb_build_object('paquetes', paq.v, 'tienda', tie.v, 'otros', otr.v, 'bruto', paq.v + tie.v + otr.v,
                            'devoluciones', dev.v, 'neto', paq.v + tie.v + otr.v - dev.v)
    from paq, tie, otr, dev;
$$;

-- FIN-02 en el resto de reportes: el día lo marca la zona de Guatemala, no UTC.
do $$
declare r record; v_def text; v_nuevo text;
begin
  for r in select p.oid, p.proname from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
             and p.proname in ('detalle_caja_del_dia','finanzas_atribucion','ranking_clientas_valor','ventas_sin_factura') loop
    v_def := pg_get_functiondef(r.oid);
    v_nuevo := regexp_replace(v_def, '((?:[a-z_]+\.)?(?:confirmado_at|pagado_at|anulada_at))::date', '(\1 at time zone ''America/Guatemala'')::date', 'g');
    if v_nuevo <> v_def then execute v_nuevo; end if;
  end loop;
end $$;

-- ───────── ESP-02 · Una sola entrada de espera por persona, clase y fecha ─────────
delete from public.lista_espera a using public.lista_espera b
 where a.cliente_id = b.cliente_id and a.horario_id = b.horario_id and a.fecha = b.fecha
   and (a.created_at, a.id) > (b.created_at, b.id);
create unique index if not exists lista_espera_unica_idx on public.lista_espera (cliente_id, horario_id, fecha);

drop function public._parchear_funcion(text, text, text, text);
