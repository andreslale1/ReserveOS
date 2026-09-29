-- Cierra los dos pendientes reales que quedaron de la sesión anterior:
--   1. Códigos de descuento existían (tablas + validación) pero ningún flujo de compra real los
--      aceptaba todavía — se conectan aquí en solicitar_membresia, agregar_membresia_manual,
--      confirmar_pago_membresia (que ignoraba el descuento guardado al confirmar precio) y
--      confirmar_pago_transaccion (que nunca incrementaba el uso del código al pagar de verdad).
--   2. "Cliente mostrador" para ventas sin identificar — se había quitado el UUID mágico de Forma sin
--      dar alternativa. Ahora cada tenant tiene su propio cliente mostrador (una fila normal de
--      clientes, marcada con es_mostrador), resuelto por obtener_cliente_mostrador().

alter table public.clientes add column if not exists es_mostrador boolean not null default false;
create unique index if not exists clientes_un_mostrador_por_tenant on public.clientes (tenant_id) where es_mostrador;

create or replace function public.obtener_cliente_mostrador(p_tenant_id uuid)
returns uuid
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.clientes where tenant_id = p_tenant_id and es_mostrador = true;
  if v_id is null then
    insert into public.clientes (tenant_id, nombre, telefono, es_mostrador)
      values (p_tenant_id, 'Venta al público', '00000000', true)
      returning id into v_id;
  end if;
  return v_id;
end;
$$;
revoke all on function public.obtener_cliente_mostrador(uuid) from public;
grant execute on function public.obtener_cliente_mostrador(uuid) to authenticated;

create or replace function public.registrar_venta_presencial(p_tenant_id uuid, p_variante_id uuid, p_cantidad integer, p_metodo_pago text, p_cliente_id uuid default null)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_cliente_id uuid;
  v_variante record; v_producto record; v_pedido_id uuid; v_total numeric;
begin
  if not public.staff_puede_en_sede(p_tenant_id, null, array['duena','gerente_general','admin_sede','recepcion']) then
    raise exception 'No tienes permiso para registrar ventas';
  end if;
  if p_cantidad is null or p_cantidad < 1 then raise exception 'Cantidad inválida'; end if;
  if p_metodo_pago not in ('efectivo', 'tarjeta_estudio', 'transferencia', 'pasarela') then raise exception 'Método de pago no válido'; end if;

  v_cliente_id := coalesce(p_cliente_id, public.obtener_cliente_mostrador(p_tenant_id));
  if not exists (select 1 from public.clientes where id = v_cliente_id and tenant_id = p_tenant_id) then raise exception 'Clienta no encontrada'; end if;

  select * into v_variante from public.producto_variantes where id = p_variante_id and tenant_id = p_tenant_id for update;
  if v_variante is null then raise exception 'Producto no encontrado'; end if;
  if v_variante.stock < p_cantidad then raise exception 'No hay suficiente stock — quedan %', v_variante.stock; end if;

  select * into v_producto from public.productos where id = v_variante.producto_id;
  v_total := v_producto.precio * p_cantidad;

  insert into public.pedidos (tenant_id, cliente_id, estado, metodo_pago, total, pagado_at)
    values (p_tenant_id, v_cliente_id, 'pagado', p_metodo_pago, v_total, now()) returning id into v_pedido_id;
  insert into public.pedido_items (tenant_id, pedido_id, tipo, producto_id, variante_id, nombre, variante_nombre, cantidad, precio_unitario)
    values (p_tenant_id, v_pedido_id, 'producto', v_producto.id, v_variante.id, v_producto.nombre, v_variante.nombre, p_cantidad, v_producto.precio);
  update public.producto_variantes set stock = stock - p_cantidad where id = p_variante_id;

  return json_build_object('ok', true, 'pedido_id', v_pedido_id, 'total', v_total, 'cliente_id', v_cliente_id);
end;
$$;

-- === Descuentos conectados a los flujos reales de compra ===

create or replace function public.solicitar_membresia(
  p_paquete_id uuid, p_referencia_pago text, p_metodo_pago text default 'transferencia',
  p_comprobante_url text default null, p_cliente_id uuid default null, p_codigo_descuento text default null
)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid; v_propio_id uuid; v_cliente_id uuid; v_paquete record; v_membresia_id uuid;
  v_descuento_pct int := 0; v_codigo_id uuid;
begin
  select tenant_id into v_tenant_id from public.paquetes where id = p_paquete_id and activo = true;
  if v_tenant_id is null then raise exception 'Paquete no válido'; end if;

  v_propio_id := public.mi_cliente_id(v_tenant_id);
  if v_propio_id is null then raise exception 'Primero completa tu registro'; end if;

  v_cliente_id := v_propio_id;
  if p_cliente_id is not null and p_cliente_id <> v_propio_id then
    if not exists (select 1 from public.clientes where id = p_cliente_id and tutor_id = v_propio_id and tenant_id = v_tenant_id) then
      raise exception 'No tienes permiso para comprar un paquete para esa persona.';
    end if;
    v_cliente_id := p_cliente_id;
  end if;

  select * into v_paquete from public.paquetes where id = p_paquete_id;

  if p_metodo_pago not in ('transferencia','tarjeta_estudio') then
    raise exception 'Método de pago no válido';
  end if;

  if p_metodo_pago = 'transferencia' then
    p_referencia_pago := trim(p_referencia_pago);
    if coalesce(p_referencia_pago, '') = '' then
      raise exception 'Ingresa el número de referencia de tu transferencia';
    end if;
    if length(regexp_replace(p_referencia_pago, '\s', '', 'g')) < 6 then
      raise exception 'Ese número de referencia se ve incompleto — cópialo tal cual aparece en tu comprobante de transferencia.';
    end if;
    if p_referencia_pago ~ '^(.)\1*$' then
      raise exception 'Ese número de referencia no parece real — cópialo tal cual aparece en tu comprobante de transferencia.';
    end if;
    if exists (
      select 1 from public.membresias
        where tenant_id = v_tenant_id and metodo_pago = 'transferencia' and estado <> 'anulada'
          and referencia_pago = p_referencia_pago
    ) then
      raise exception 'Ese número de referencia ya se usó antes en otra solicitud. Si crees que es un error, contacta al estudio directamente.';
    end if;
  end if;

  if p_codigo_descuento is not null and trim(p_codigo_descuento) <> '' then
    select v.v_descuento_pct, v.v_codigo_id into v_descuento_pct, v_codigo_id
      from public._aplicar_codigo_descuento(v_tenant_id, p_codigo_descuento, p_paquete_id) v;
  end if;

  insert into public.membresias
    (tenant_id, cliente_id, paquete_id, cobertura_tipo, referencia_pago, metodo_pago, comprobante_url,
     descuento_pct, codigo_descuento_id, estado, clases_totales, clases_usadas, fecha_inicio, fecha_vencimiento, pagada)
    values
    (v_tenant_id, v_cliente_id, p_paquete_id, v_paquete.cobertura, nullif(trim(p_referencia_pago), ''), p_metodo_pago, p_comprobante_url,
     v_descuento_pct, v_codigo_id, 'activa', 1, 0, public.hoy_en_sede(null), public.hoy_en_sede(null) + v_paquete.vigencia_dias, false)
    returning id into v_membresia_id;

  perform public._snapshot_cobertura_membresia(v_membresia_id, p_paquete_id);

  return json_build_object('ok', true, 'membresia_id', v_membresia_id, 'activa_al_instante', true, 'capada_a_una_clase', true, 'descuento_pct', v_descuento_pct);
end;
$$;
revoke all on function public.solicitar_membresia(uuid, text, text, text, uuid, text) from public;
grant execute on function public.solicitar_membresia(uuid, text, text, text, uuid, text) to authenticated;

create or replace function public.agregar_membresia_manual(
  p_cliente_id uuid, p_paquete_id uuid, p_sede_venta_id uuid,
  p_metodo_pago text default 'tarjeta_estudio', p_fecha_cobro date default null, p_codigo_descuento text default null
)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_paquete record; v_tenant_id uuid; v_membresia_id uuid; v_origen text := 'compra';
  v_precio_final numeric; v_confirmado_at timestamptz := now(); v_roles_permitidos text[];
  v_descuento_pct int := 0; v_codigo_id uuid;
begin
  select * into v_paquete from public.paquetes where id = p_paquete_id and activo = true;
  if v_paquete is null then raise exception 'Paquete no válido'; end if;
  v_tenant_id := v_paquete.tenant_id;

  if not exists (select 1 from public.clientes where id = p_cliente_id and tenant_id = v_tenant_id) then
    raise exception 'Clienta no encontrada';
  end if;
  if not exists (select 1 from public.sedes where id = p_sede_venta_id and tenant_id = v_tenant_id) then
    raise exception 'Sede no válida';
  end if;

  if p_metodo_pago not in ('transferencia', 'tarjeta_estudio', 'efectivo', 'cortesia', 'pasarela') then
    raise exception 'Método de pago no válido';
  end if;

  v_roles_permitidos := case when p_metodo_pago = 'cortesia' then array['duena','gerente_general'] else array['duena','gerente_general','admin_sede','recepcion'] end;
  if not public.staff_puede_en_sede(v_tenant_id, p_sede_venta_id, v_roles_permitidos) then
    raise exception 'No autorizado';
  end if;

  if p_fecha_cobro is not null then
    if not public.staff_puede_en_sede(v_tenant_id, p_sede_venta_id, array['duena','gerente_general','admin_sede']) then
      raise exception 'No autorizado a registrar un cobro con fecha atrasada';
    end if;
    if p_fecha_cobro > public.hoy_en_sede(p_sede_venta_id) then
      raise exception 'La fecha del cobro no puede ser a futuro';
    end if;
    if p_fecha_cobro < public.hoy_en_sede(p_sede_venta_id) - 14 then
      raise exception 'Esa fecha es de hace más de 14 días — corrígelo manualmente si el atraso es mayor.';
    end if;
    v_confirmado_at := (p_fecha_cobro::timestamp + interval '12 hours');
  end if;

  if p_metodo_pago = 'cortesia' then
    v_origen := 'cortesia';
    v_precio_final := 0;
  else
    if p_codigo_descuento is not null and trim(p_codigo_descuento) <> '' then
      select v.v_descuento_pct, v.v_codigo_id into v_descuento_pct, v_codigo_id
        from public._aplicar_codigo_descuento(v_tenant_id, p_codigo_descuento, p_paquete_id) v;
    end if;
    v_precio_final := public._precio_con_descuento(p_paquete_id, v_paquete.precio, v_codigo_id, v_descuento_pct);
  end if;

  insert into public.membresias
    (tenant_id, cliente_id, paquete_id, sede_venta_id, cobertura_tipo, metodo_pago, descuento_pct, codigo_descuento_id, precio_final, estado,
     clases_totales, clases_usadas, fecha_inicio, fecha_vencimiento, pagada, origen, confirmado_at, confirmado_por)
    values
    (v_tenant_id, p_cliente_id, p_paquete_id, p_sede_venta_id, v_paquete.cobertura,
     p_metodo_pago, v_descuento_pct, v_codigo_id, v_precio_final, 'activa', v_paquete.num_clases, 0,
     public.hoy_en_sede(p_sede_venta_id), public.hoy_en_sede(p_sede_venta_id) + v_paquete.vigencia_dias,
     true, v_origen, v_confirmado_at, auth.uid())
    returning id into v_membresia_id;

  perform public._snapshot_cobertura_membresia(v_membresia_id, p_paquete_id);

  return json_build_object('ok', true, 'membresia_id', v_membresia_id, 'precio_final', v_precio_final);
end;
$$;
revoke all on function public.agregar_membresia_manual(uuid, uuid, uuid, text, date, text) from public;
grant execute on function public.agregar_membresia_manual(uuid, uuid, uuid, text, date, text) to authenticated;

-- Antes ignoraba el descuento_pct/codigo_descuento_id ya guardados en la solicitud (los fijaba en 0
-- silenciosamente al confirmar el pago) — ahora respeta lo que se aplicó en solicitar_membresia.
create or replace function public.confirmar_pago_membresia(p_membresia_id uuid)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_membresia record; v_paquete record; v_precio_final numeric;
begin
  select tenant_id, cliente_id, paquete_id, sede_venta_id, descuento_pct into v_membresia from public.membresias where id = p_membresia_id;
  if v_membresia is null then raise exception 'Membresía no encontrada'; end if;

  if not public.staff_puede_en_sede(v_membresia.tenant_id, v_membresia.sede_venta_id, array['duena','gerente_general','admin_sede','recepcion']) then
    raise exception 'No autorizado';
  end if;

  select num_clases, vigencia_dias, precio into v_paquete from public.paquetes where id = v_membresia.paquete_id;
  v_precio_final := round(v_paquete.precio * (1 - coalesce(v_membresia.descuento_pct, 0) / 100.0), 2);

  update public.membresias set
    estado = 'activa',
    clases_totales = v_paquete.num_clases,
    fecha_inicio = public.hoy_en_sede(v_membresia.sede_venta_id),
    fecha_vencimiento = public.hoy_en_sede(v_membresia.sede_venta_id) + v_paquete.vigencia_dias,
    confirmado_at = now(),
    confirmado_por = auth.uid(),
    precio_final = v_precio_final,
    pagada = true
  where id = p_membresia_id;

  return json_build_object('ok', true, 'precio_final', v_precio_final);
end;
$$;

-- editar_cobro_membresia: ahora acepta un código real además del override manual (mutuamente
-- excluyentes). Un código nuevo se valida (no se incrementa uso de nuevo si la membresía ya lo tenía
-- — evita inflar usos_actuales al simplemente volver a guardar el mismo cobro).
create or replace function public.editar_cobro_membresia(p_membresia_id uuid, p_codigo_descuento text default null, p_descuento_pct_manual numeric default null)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_membresia record; v_paquete numeric; v_descuento_pct numeric; v_codigo_id uuid; v_precio_final numeric;
begin
  select id, tenant_id, sede_venta_id, paquete_id, codigo_descuento_id into v_membresia from public.membresias where id = p_membresia_id;
  if v_membresia is null then raise exception 'Membresía no encontrada'; end if;

  if not public.staff_puede_en_sede(v_membresia.tenant_id, v_membresia.sede_venta_id, array['duena','gerente_general']) then
    raise exception 'No autorizado para editar un cobro';
  end if;

  select precio into v_paquete from public.paquetes where id = v_membresia.paquete_id;
  if v_paquete is null then raise exception 'Paquete no encontrado'; end if;

  if p_codigo_descuento is not null and trim(p_codigo_descuento) <> '' then
    select v.v_descuento_pct, v.v_codigo_id into v_descuento_pct, v_codigo_id
      from public._validar_codigo_descuento(v_membresia.tenant_id, p_codigo_descuento, v_membresia.paquete_id) v;
    if v_codigo_id is distinct from v_membresia.codigo_descuento_id then
      update public.codigos_descuento set usos_actuales = usos_actuales + 1 where id = v_codigo_id;
      if v_membresia.codigo_descuento_id is not null then
        update public.codigos_descuento set usos_actuales = greatest(usos_actuales - 1, 0) where id = v_membresia.codigo_descuento_id;
      end if;
    end if;
  else
    v_descuento_pct := coalesce(p_descuento_pct_manual, 0);
    v_codigo_id := null;
    if v_descuento_pct < 0 or v_descuento_pct > 100 then
      raise exception 'El descuento debe estar entre 0 y 100%%';
    end if;
    if v_membresia.codigo_descuento_id is not null then
      update public.codigos_descuento set usos_actuales = greatest(usos_actuales - 1, 0) where id = v_membresia.codigo_descuento_id;
    end if;
  end if;

  v_precio_final := round(v_paquete * (1 - v_descuento_pct / 100.0), 2);
  update public.membresias set descuento_pct = v_descuento_pct, precio_final = v_precio_final, codigo_descuento_id = v_codigo_id where id = p_membresia_id;

  return json_build_object('ok', true, 'precio_final', v_precio_final, 'descuento_pct', v_descuento_pct);
end;
$$;

-- confirmar_pago_transaccion: ahora sí incrementa el uso del código al confirmarse el pago de
-- verdad (antes se validaba/aplicaba al iniciar la transacción, pero nunca al confirmarla).
create or replace function public.confirmar_pago_transaccion(p_transaccion_id uuid)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tx record; v_paquete record; v_membresia_id uuid;
begin
  select * into v_tx from public.pago_transacciones where id = p_transaccion_id;
  if v_tx is null then raise exception 'Transacción no encontrada'; end if;
  if v_tx.membresia_id is not null then
    return json_build_object('ok', true, 'membresia_id', v_tx.membresia_id, 'ya_procesada', true);
  end if;

  select * into v_paquete from public.paquetes where id = v_tx.paquete_id;
  if v_paquete is null then raise exception 'Paquete no encontrado'; end if;

  insert into public.membresias
    (tenant_id, cliente_id, paquete_id, sede_venta_id, cobertura_tipo, metodo_pago, descuento_pct, codigo_descuento_id, precio_final, estado,
     clases_totales, clases_usadas, fecha_inicio, fecha_vencimiento, pagada, origen, confirmado_at)
    values
    (v_tx.tenant_id, v_tx.cliente_id, v_tx.paquete_id, v_tx.sede_venta_id, v_paquete.cobertura, 'pasarela', v_tx.descuento_pct, v_tx.codigo_descuento_id, v_tx.monto, 'activa',
     v_paquete.num_clases, 0, public.hoy_en_sede(v_tx.sede_venta_id), public.hoy_en_sede(v_tx.sede_venta_id) + v_paquete.vigencia_dias,
     true, 'compra', now())
    returning id into v_membresia_id;

  perform public._snapshot_cobertura_membresia(v_membresia_id, v_tx.paquete_id);

  if v_tx.codigo_descuento_id is not null then
    update public.codigos_descuento set usos_actuales = usos_actuales + 1 where id = v_tx.codigo_descuento_id;
  end if;

  update public.pago_transacciones
    set estado = 'confirmado', membresia_id = v_membresia_id, actualizado_at = now()
    where id = p_transaccion_id;

  return json_build_object('ok', true, 'membresia_id', v_membresia_id);
end;
$$;
