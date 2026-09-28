-- Módulo resto — tienda: carrito, checkout, pedidos, ventas presenciales, gift cards, reportes.
-- Simplificación deliberada: `registrar_venta_presencial` en Forma tenía un cliente_id "mostrador"
-- hardcodeado (UUID fijo) para ventas sin clienta identificada. Aquí `p_cliente_id` es obligatorio —
-- cada tenant resuelve su propio "cliente mostrador" si lo necesita (crearlo como una fila normal de
-- `clientes`), no se asume un UUID mágico global que no tendría sentido multi-tenant.

create or replace function public._mi_carrito_activo(p_tenant_id uuid, OUT v_carrito_id uuid)
returns uuid
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_cliente_id uuid;
begin
  v_cliente_id := public.mi_cliente_id(p_tenant_id);
  if v_cliente_id is null then raise exception 'No se encontró tu cuenta de clienta'; end if;

  select id into v_carrito_id from public.carritos where cliente_id = v_cliente_id and estado = 'activo';
  if v_carrito_id is null then
    insert into public.carritos (tenant_id, cliente_id) values (p_tenant_id, v_cliente_id) returning id into v_carrito_id;
  end if;
end;
$$;
revoke all on function public._mi_carrito_activo(uuid) from public;
grant execute on function public._mi_carrito_activo(uuid) to authenticated;

create or replace function public._procesar_pedido_pagado(p_pedido_id uuid)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_pedido record; v_item record; v_membresia_id uuid;
begin
  select * into v_pedido from public.pedidos where id = p_pedido_id;
  if v_pedido is null then raise exception 'Pedido no encontrado'; end if;
  if v_pedido.estado != 'pendiente_pago' then
    return json_build_object('ok', true, 'ya_procesado', true, 'membresia_id', null);
  end if;

  for v_item in select * from public.pedido_items where pedido_id = p_pedido_id loop
    if v_item.tipo = 'producto' then
      update public.producto_variantes set stock = stock - v_item.cantidad where id = v_item.variante_id;
    else
      if v_item.membresia_id is not null then
        update public.membresias set clases_totales = pq.num_clases, pagada = true, confirmado_at = now()
          from public.paquetes pq
          where membresias.id = v_item.membresia_id and pq.id = v_item.paquete_id
          returning membresias.id into v_membresia_id;
      else
        insert into public.membresias (tenant_id, cliente_id, paquete_id, cobertura_tipo, sede_venta_id, metodo_pago,
          descuento_pct, precio_final, estado, clases_totales, clases_usadas, fecha_inicio, fecha_vencimiento,
          pagada, origen, codigo_descuento_id, confirmado_at)
          select v_pedido.tenant_id, v_pedido.cliente_id, pq.id, pq.cobertura, v_pedido.sede_entrega_id, v_pedido.metodo_pago,
            v_pedido.descuento_pct, v_item.precio_unitario, 'activa', pq.num_clases, 0,
            public.hoy_en_sede(v_pedido.sede_entrega_id), public.hoy_en_sede(v_pedido.sede_entrega_id) + pq.vigencia_dias,
            true, 'compra', v_pedido.codigo_descuento_id, now()
          from public.paquetes pq where pq.id = v_item.paquete_id
          returning membresias.id into v_membresia_id;
        perform public._snapshot_cobertura_membresia(v_membresia_id, v_item.paquete_id);
      end if;
      perform public.otorgar_bono_referido_si_corresponde(v_pedido.cliente_id, v_item.paquete_id);
    end if;
  end loop;

  if v_pedido.codigo_descuento_usado_id is not null then
    update public.codigos_descuento set usos_actuales = usos_actuales + 1 where id = v_pedido.codigo_descuento_usado_id;
  end if;
  update public.pedidos set estado = 'pagado', pagado_at = now() where id = p_pedido_id;

  return json_build_object('ok', true, 'membresia_id', v_membresia_id);
end;
$$;
revoke all on function public._procesar_pedido_pagado(uuid) from public;

create or replace function public.actualizar_cantidad_carrito(p_item_id uuid, p_cantidad integer)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_carrito_id uuid;
begin
  select c.id into v_carrito_id from public.carrito_items ci
    join public.carritos c on c.id = ci.carrito_id
    join public.clientes cl on cl.id = c.cliente_id
    where ci.id = p_item_id and cl.user_id = auth.uid();
  if v_carrito_id is null then raise exception 'Ítem no encontrado en tu carrito'; end if;

  if p_cantidad <= 0 then
    delete from public.carrito_items where id = p_item_id;
  else
    update public.carrito_items set cantidad = p_cantidad where id = p_item_id;
  end if;
  update public.carritos set actualizado_at = now() where id = v_carrito_id;
  return json_build_object('ok', true);
end;
$$;
revoke all on function public.actualizar_cantidad_carrito(uuid, integer) from public;
grant execute on function public.actualizar_cantidad_carrito(uuid, integer) to authenticated;

create or replace function public.quitar_de_carrito(p_item_id uuid)
returns json
language sql security definer
set search_path to 'public'
as $$
  select public.actualizar_cantidad_carrito(p_item_id, 0);
$$;
revoke all on function public.quitar_de_carrito(uuid) from public;
grant execute on function public.quitar_de_carrito(uuid) to authenticated;

create or replace function public.actualizar_stock_variante(p_variante_id uuid, p_stock integer)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.producto_variantes where id = p_variante_id;
  if v_tenant_id is null then raise exception 'Producto no encontrado'; end if;
  if not public.tengo_rol_en_tenant(v_tenant_id, array['duena','gerente_general']) then
    raise exception 'No autorizado para editar el inventario';
  end if;
  if p_stock < 0 then raise exception 'El stock no puede ser negativo'; end if;

  update public.producto_variantes set stock = p_stock where id = p_variante_id;
  return json_build_object('ok', true);
end;
$$;
revoke all on function public.actualizar_stock_variante(uuid, integer) from public;
grant execute on function public.actualizar_stock_variante(uuid, integer) to authenticated;

create or replace function public.agregar_a_carrito(p_tenant_id uuid, p_tipo text, p_producto_id uuid default null,
  p_variante_id uuid default null, p_paquete_id uuid default null, p_cantidad integer default 1)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_carrito_id uuid; v_stock int; v_item_existente uuid;
begin
  select public._mi_carrito_activo(p_tenant_id) into v_carrito_id;

  if p_tipo = 'producto' then
    if p_producto_id is null or p_variante_id is null then raise exception 'Falta el producto o la variante'; end if;
    select stock into v_stock from public.producto_variantes where id = p_variante_id and producto_id = p_producto_id and tenant_id = p_tenant_id;
    if v_stock is null then raise exception 'Producto no válido'; end if;

    select id into v_item_existente from public.carrito_items where carrito_id = v_carrito_id and tipo = 'producto' and variante_id = p_variante_id;
    if v_item_existente is not null then
      update public.carrito_items set cantidad = cantidad + p_cantidad where id = v_item_existente;
    else
      insert into public.carrito_items (tenant_id, carrito_id, tipo, producto_id, variante_id, cantidad)
        values (p_tenant_id, v_carrito_id, 'producto', p_producto_id, p_variante_id, p_cantidad);
    end if;
  elsif p_tipo = 'paquete' then
    if p_paquete_id is null then raise exception 'Falta el paquete'; end if;
    if not exists (select 1 from public.paquetes where id = p_paquete_id and tenant_id = p_tenant_id and activo = true) then
      raise exception 'Paquete no válido';
    end if;
    delete from public.carrito_items where carrito_id = v_carrito_id and tipo = 'paquete';
    insert into public.carrito_items (tenant_id, carrito_id, tipo, paquete_id, cantidad) values (p_tenant_id, v_carrito_id, 'paquete', p_paquete_id, 1);
  else
    raise exception 'Tipo de ítem no válido';
  end if;

  update public.carritos set actualizado_at = now() where id = v_carrito_id;
  return json_build_object('ok', true);
end;
$$;
revoke all on function public.agregar_a_carrito(uuid, text, uuid, uuid, uuid, integer) from public;
grant execute on function public.agregar_a_carrito(uuid, text, uuid, uuid, uuid, integer) to authenticated;

create or replace function public.mi_carrito()
returns table(item_id uuid, tipo text, cantidad integer, producto_id uuid, producto_nombre text, imagen_url text,
  variante_id uuid, variante_nombre text, stock_disponible integer, paquete_id uuid, paquete_nombre text, precio_unitario numeric)
language sql stable security definer
set search_path to 'public'
as $$
  select ci.id, ci.tipo, ci.cantidad, pr.id, pr.nombre, coalesce(v.imagen_url, pr.imagen_url),
    v.id, v.nombre, v.stock, pq.id, pq.nombre, coalesce(pr.precio, pq.precio)
  from public.carrito_items ci
  join public.carritos c on c.id = ci.carrito_id
  join public.clientes cl on cl.id = c.cliente_id
  left join public.productos pr on pr.id = ci.producto_id
  left join public.producto_variantes v on v.id = ci.variante_id
  left join public.paquetes pq on pq.id = ci.paquete_id
  where cl.user_id = auth.uid() and c.estado = 'activo'
  order by ci.created_at;
$$;
revoke all on function public.mi_carrito() from public;
grant execute on function public.mi_carrito() to authenticated;

create or replace function public.catalogo_productos(p_tenant_id uuid)
returns table(producto_id uuid, nombre text, descripcion text, precio numeric, unidad text, imagen_url text,
  categoria text, orden integer, variante_id uuid, variante_nombre text, stock integer, variante_orden integer, variante_imagen_url text)
language sql stable security definer
set search_path to 'public'
as $$
  select p.id, p.nombre, p.descripcion, p.precio, p.unidad, p.imagen_url, p.categoria, p.orden,
    v.id, v.nombre, v.stock, v.orden, v.imagen_url
  from public.productos p join public.producto_variantes v on v.producto_id = p.id
  where p.tenant_id = p_tenant_id and p.activo = true
  order by p.orden, p.nombre, v.orden, v.nombre;
$$;
revoke all on function public.catalogo_productos(uuid) from public;
grant execute on function public.catalogo_productos(uuid) to authenticated, anon;

create or replace function public.carritos_abandonados(p_tenant_id uuid)
returns table(carrito_id uuid, cliente_id uuid, cliente_nombre text, cliente_telefono text, actualizado_at timestamptz, items text, total numeric)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then return; end if;
  return query
  select ct.id, cl.id, cl.nombre, cl.telefono, ct.actualizado_at,
    string_agg(case when ci.tipo = 'producto' then ci.cantidad || 'x ' || pr.nombre || coalesce(' (' || v.nombre || ')', '') else pq.nombre end, ', '),
    sum(case when ci.tipo = 'producto' then pr.precio * ci.cantidad else pq.precio end)
  from public.carritos ct
  join public.clientes cl on cl.id = ct.cliente_id
  join public.carrito_items ci on ci.carrito_id = ct.id
  left join public.productos pr on pr.id = ci.producto_id
  left join public.producto_variantes v on v.id = ci.variante_id
  left join public.paquetes pq on pq.id = ci.paquete_id
  where ct.tenant_id = p_tenant_id and ct.estado = 'activo' and ct.actualizado_at < now() - interval '2 hours'
  group by ct.id, cl.id, cl.nombre, cl.telefono, ct.actualizado_at
  order by ct.actualizado_at desc;
end;
$$;
revoke all on function public.carritos_abandonados(uuid) from public;
grant execute on function public.carritos_abandonados(uuid) to authenticated;

create or replace function public.marcar_carrito_perdido(p_carrito_id uuid)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.carritos where id = p_carrito_id;
  if v_tenant_id is null or not public.tengo_rol_en_tenant(v_tenant_id, array['duena','gerente_general']) then
    raise exception 'No autorizado';
  end if;
  update public.carritos set estado = 'abandonado', actualizado_at = now() where id = p_carrito_id and estado = 'activo';
  return json_build_object('ok', true);
end;
$$;
revoke all on function public.marcar_carrito_perdido(uuid) from public;
grant execute on function public.marcar_carrito_perdido(uuid) to authenticated;

create or replace function public.iniciar_checkout_carrito(p_tenant_id uuid, p_metodo_pago text, p_codigo_descuento text default null)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_cliente_id uuid; v_carrito_id uuid; v_item record; v_stock int; v_total numeric := 0;
  v_pedido_id uuid; v_descuento_generico int := 0; v_codigo_id uuid; v_aplica_a text;
  v_descuento_pct_paquete int := 0; v_codigo_id_pedido uuid; v_paquete_item record;
  v_precio_item numeric; v_descuento_pct_item int; v_transaccion_id uuid;
  v_codigo_usado boolean := false; v_membresia_capada_id uuid;
begin
  if p_metodo_pago not in ('efectivo', 'pasarela') then raise exception 'Método de pago no válido'; end if;
  v_cliente_id := public.mi_cliente_id(p_tenant_id);
  if v_cliente_id is null then raise exception 'No se encontró tu cuenta de clienta'; end if;

  select id into v_carrito_id from public.carritos where cliente_id = v_cliente_id and estado = 'activo';
  if v_carrito_id is null or not exists (select 1 from public.carrito_items where carrito_id = v_carrito_id) then
    raise exception 'Tu carrito está vacío';
  end if;

  if p_codigo_descuento is not null and trim(p_codigo_descuento) <> '' then
    select g.v_descuento_pct, g.v_codigo_id, g.v_aplica_a into v_descuento_generico, v_codigo_id, v_aplica_a
      from public._codigo_valido_generico(p_tenant_id, p_codigo_descuento) g;
  end if;

  select ci.* into v_paquete_item from public.carrito_items ci where ci.carrito_id = v_carrito_id and ci.tipo = 'paquete';
  if found and v_codigo_id is not null and v_aplica_a in ('paquetes', 'todo') then
    if exists (select 1 from public.codigos_descuento_paquetes where codigo_id = v_codigo_id)
       and not exists (select 1 from public.codigos_descuento_paquetes where codigo_id = v_codigo_id and paquete_id = v_paquete_item.paquete_id) then
      raise exception 'Este código no aplica para el paquete seleccionado';
    end if;
    v_descuento_pct_paquete := v_descuento_generico; v_codigo_id_pedido := v_codigo_id; v_codigo_usado := true;
  end if;

  insert into public.pedidos (tenant_id, cliente_id, estado, metodo_pago, total, codigo_descuento_id, descuento_pct)
    values (p_tenant_id, v_cliente_id, 'pendiente_pago', p_metodo_pago, 0, v_codigo_id_pedido, v_descuento_pct_paquete)
    returning id into v_pedido_id;

  for v_item in select * from public.carrito_items where carrito_id = v_carrito_id loop
    if v_item.tipo = 'producto' then
      select stock into v_stock from public.producto_variantes where id = v_item.variante_id for update;
      if v_stock is null or v_stock < v_item.cantidad then
        raise exception 'Ya no hay suficiente stock de %', (select nombre from public.productos where id = v_item.producto_id);
      end if;

      v_descuento_pct_item := 0;
      if v_codigo_id is not null and v_aplica_a in ('productos', 'todo') then
        if not exists (select 1 from public.codigos_descuento_productos where codigo_id = v_codigo_id)
           or exists (select 1 from public.codigos_descuento_productos where codigo_id = v_codigo_id and producto_id = v_item.producto_id) then
          v_descuento_pct_item := v_descuento_generico; v_codigo_usado := true;
        end if;
      end if;

      select round(precio * (1 - v_descuento_pct_item / 100.0), 2) into v_precio_item from public.productos where id = v_item.producto_id;
      insert into public.pedido_items (tenant_id, pedido_id, tipo, producto_id, variante_id, nombre, variante_nombre, cantidad, precio_unitario)
        select p_tenant_id, v_pedido_id, 'producto', p.id, v.id, p.nombre, v.nombre, v_item.cantidad, v_precio_item
          from public.productos p join public.producto_variantes v on v.id = v_item.variante_id where p.id = v_item.producto_id;
      v_total := v_total + (v_precio_item * v_item.cantidad);
    else
      select round(precio * (1 - v_descuento_pct_paquete / 100.0), 2) into v_precio_item from public.paquetes where id = v_item.paquete_id;
      v_membresia_capada_id := null;
      if p_metodo_pago = 'efectivo' then
        insert into public.membresias (tenant_id, cliente_id, paquete_id, cobertura_tipo, metodo_pago, descuento_pct, precio_final,
          estado, clases_totales, clases_usadas, fecha_inicio, fecha_vencimiento, pagada, origen, codigo_descuento_id)
          select p_tenant_id, v_cliente_id, pq.id, pq.cobertura, p_metodo_pago, v_descuento_pct_paquete, v_precio_item, 'activa', 1, 0,
            public.hoy_en_sede(null), public.hoy_en_sede(null) + pq.vigencia_dias, false, 'compra', v_codigo_id_pedido
          from public.paquetes pq where pq.id = v_item.paquete_id
          returning membresias.id into v_membresia_capada_id;
      end if;
      insert into public.pedido_items (tenant_id, pedido_id, tipo, paquete_id, nombre, cantidad, precio_unitario, membresia_id)
        select p_tenant_id, v_pedido_id, 'paquete', id, nombre, 1, v_precio_item, v_membresia_capada_id from public.paquetes where id = v_item.paquete_id;
      v_total := v_total + v_precio_item;
    end if;
  end loop;

  if v_codigo_id is not null and not v_codigo_usado then
    raise exception 'Este código no aplica a lo que tienes en el carrito';
  end if;

  update public.pedidos set total = v_total, codigo_descuento_usado_id = (case when v_codigo_usado then v_codigo_id else null end) where id = v_pedido_id;
  update public.carritos set estado = 'convertido', actualizado_at = now() where id = v_carrito_id;

  if p_metodo_pago = 'pasarela' then
    insert into public.pago_transacciones (tenant_id, cliente_id, tipo, pedido_id, proveedor, monto)
      values (p_tenant_id, v_cliente_id, 'carrito', v_pedido_id, 'recurrente', v_total)
      returning id into v_transaccion_id;
  end if;

  return json_build_object('pedido_id', v_pedido_id, 'transaccion_id', v_transaccion_id, 'total', v_total, 'metodo_pago', p_metodo_pago);
end;
$$;
revoke all on function public.iniciar_checkout_carrito(uuid, text, text) from public;
grant execute on function public.iniciar_checkout_carrito(uuid, text, text) to authenticated;

create or replace function public.confirmar_transaccion_carrito(p_transaccion_id uuid)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tx record; v_resultado json;
begin
  select * into v_tx from public.pago_transacciones where id = p_transaccion_id;
  if v_tx is null then raise exception 'Transacción no encontrada'; end if;
  if v_tx.estado = 'confirmado' then return json_build_object('ok', true, 'ya_procesada', true, 'pedido_id', v_tx.pedido_id); end if;

  v_resultado := public._procesar_pedido_pagado(v_tx.pedido_id);
  update public.pago_transacciones set estado = 'confirmado', actualizado_at = now() where id = p_transaccion_id;
  return json_build_object('ok', true, 'pedido_id', v_tx.pedido_id, 'membresia_id', v_resultado->>'membresia_id');
end;
$$;
revoke all on function public.confirmar_transaccion_carrito(uuid) from public;
grant execute on function public.confirmar_transaccion_carrito(uuid) to service_role;

create or replace function public.cancelar_transaccion_pasarela(p_transaccion_id uuid)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.pago_transacciones where id = p_transaccion_id;
  if v_tenant_id is null or not public.tengo_rol_en_tenant(v_tenant_id, array['duena','gerente_general']) then
    raise exception 'No autorizado';
  end if;
  update public.pago_transacciones set estado = 'rechazado', actualizado_at = now() where id = p_transaccion_id and estado = 'iniciado';
  return json_build_object('ok', true);
end;
$$;
revoke all on function public.cancelar_transaccion_pasarela(uuid) from public;
grant execute on function public.cancelar_transaccion_pasarela(uuid) to authenticated;

create or replace function public.iniciar_transaccion_pasarela(p_tenant_id uuid, p_paquete_id uuid, p_codigo_descuento text default null, p_proveedor text default 'recurrente')
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_cliente_id uuid; v_paquete record; v_descuento_pct int; v_codigo_id uuid; v_precio_final numeric; v_transaccion_id uuid;
begin
  v_cliente_id := public.mi_cliente_id(p_tenant_id);
  if v_cliente_id is null then raise exception 'No se encontró tu cuenta de clienta'; end if;

  select * into v_paquete from public.paquetes where id = p_paquete_id and tenant_id = p_tenant_id and activo = true;
  if v_paquete is null then raise exception 'Paquete no válido'; end if;

  select v.v_descuento_pct, v.v_codigo_id into v_descuento_pct, v_codigo_id from public._validar_codigo_descuento(p_tenant_id, p_codigo_descuento, p_paquete_id) v;
  v_precio_final := public._precio_con_descuento(p_paquete_id, v_paquete.precio, v_codigo_id, v_descuento_pct);

  insert into public.pago_transacciones (tenant_id, cliente_id, paquete_id, proveedor, monto, codigo_descuento_id, descuento_pct)
    values (p_tenant_id, v_cliente_id, p_paquete_id, p_proveedor, v_precio_final, v_codigo_id, v_descuento_pct)
    returning id into v_transaccion_id;

  return json_build_object('transaccion_id', v_transaccion_id, 'monto', v_precio_final, 'nombre_paquete', v_paquete.nombre);
end;
$$;
revoke all on function public.iniciar_transaccion_pasarela(uuid, uuid, text, text) from public;
grant execute on function public.iniciar_transaccion_pasarela(uuid, uuid, text, text) to authenticated;

create or replace function public.iniciar_transaccion_pasarela_admin(p_tenant_id uuid, p_cliente_id uuid, p_paquete_id uuid, p_codigo_descuento text default null)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_paquete record; v_descuento_pct int; v_codigo_id uuid; v_precio_final numeric; v_transaccion_id uuid;
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then raise exception 'No autorizado'; end if;
  if not exists (select 1 from public.clientes where id = p_cliente_id and tenant_id = p_tenant_id) then raise exception 'Clienta no encontrada'; end if;

  select * into v_paquete from public.paquetes where id = p_paquete_id and tenant_id = p_tenant_id and activo = true;
  if v_paquete is null then raise exception 'Paquete no válido'; end if;

  select v.v_descuento_pct, v.v_codigo_id into v_descuento_pct, v_codigo_id from public._validar_codigo_descuento(p_tenant_id, p_codigo_descuento, p_paquete_id) v;
  v_precio_final := public._precio_con_descuento(p_paquete_id, v_paquete.precio, v_codigo_id, v_descuento_pct);

  insert into public.pago_transacciones (tenant_id, cliente_id, paquete_id, proveedor, monto, codigo_descuento_id, descuento_pct)
    values (p_tenant_id, p_cliente_id, p_paquete_id, 'recurrente', v_precio_final, v_codigo_id, v_descuento_pct)
    returning id into v_transaccion_id;

  return json_build_object('transaccion_id', v_transaccion_id, 'monto', v_precio_final, 'nombre_paquete', v_paquete.nombre);
end;
$$;
revoke all on function public.iniciar_transaccion_pasarela_admin(uuid, uuid, uuid, text) from public;
grant execute on function public.iniciar_transaccion_pasarela_admin(uuid, uuid, uuid, text) to authenticated;

create or replace function public.confirmar_pedido_efectivo(p_pedido_id uuid)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.pedidos where id = p_pedido_id;
  if v_tenant_id is null or not public.tengo_rol_en_tenant(v_tenant_id, array['duena','gerente_general','admin_sede','recepcion']) then
    raise exception 'No autorizado';
  end if;
  return public._procesar_pedido_pagado(p_pedido_id);
end;
$$;
revoke all on function public.confirmar_pedido_efectivo(uuid) from public;
grant execute on function public.confirmar_pedido_efectivo(uuid) to authenticated;

create or replace function public.historial_pedidos(p_tenant_id uuid)
returns table(pedido_id uuid, cliente_nombre text, total numeric, metodo_pago text, pagado_at timestamptz, entregado_at timestamptz, items text)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then return; end if;
  return query
  select pd.id, c.nombre, pd.total, pd.metodo_pago, pd.pagado_at, pd.entregado_at,
    string_agg(pi.cantidad || 'x ' || pi.nombre || coalesce(' (' || pi.variante_nombre || ')', ''), ', ' order by pi.nombre)
  from public.pedidos pd join public.clientes c on c.id = pd.cliente_id join public.pedido_items pi on pi.pedido_id = pd.id
  where pd.tenant_id = p_tenant_id and pd.estado in ('pagado', 'entregado')
  group by pd.id, c.nombre, pd.total, pd.metodo_pago, pd.pagado_at, pd.entregado_at
  order by pd.pagado_at desc limit 200;
end;
$$;
revoke all on function public.historial_pedidos(uuid) from public;
grant execute on function public.historial_pedidos(uuid) to authenticated;

create or replace function public.pedidos_para_entregar(p_tenant_id uuid)
returns table(pedido_id uuid, cliente_nombre text, cliente_telefono text, total numeric, pagado_at timestamptz, items text)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','admin_sede','recepcion']) then return; end if;
  return query
  select pd.id, c.nombre, c.telefono, pd.total, pd.pagado_at,
    string_agg(pi.cantidad || 'x ' || pi.nombre || coalesce(' (' || pi.variante_nombre || ')', ''), ', ' order by pi.nombre)
  from public.pedidos pd join public.clientes c on c.id = pd.cliente_id join public.pedido_items pi on pi.pedido_id = pd.id
  where pd.tenant_id = p_tenant_id and pd.estado = 'pagado'
  group by pd.id, c.nombre, c.telefono, pd.total, pd.pagado_at
  order by pd.pagado_at asc;
end;
$$;
revoke all on function public.pedidos_para_entregar(uuid) from public;
grant execute on function public.pedidos_para_entregar(uuid) to authenticated;

create or replace function public.pedidos_pendientes_efectivo(p_tenant_id uuid)
returns table(pedido_id uuid, cliente_nombre text, cliente_telefono text, total numeric, created_at timestamptz, items text)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','admin_sede','recepcion']) then return; end if;
  return query
  select pd.id, c.nombre, c.telefono, pd.total, pd.created_at,
    string_agg(pi.cantidad || 'x ' || pi.nombre || coalesce(' (' || pi.variante_nombre || ')', ''), ', ' order by pi.nombre)
  from public.pedidos pd join public.clientes c on c.id = pd.cliente_id join public.pedido_items pi on pi.pedido_id = pd.id
  where pd.tenant_id = p_tenant_id and pd.estado = 'pendiente_pago' and pd.metodo_pago = 'efectivo'
  group by pd.id, c.nombre, c.telefono, pd.total, pd.created_at
  order by pd.created_at asc;
end;
$$;
revoke all on function public.pedidos_pendientes_efectivo(uuid) from public;
grant execute on function public.pedidos_pendientes_efectivo(uuid) to authenticated;

create or replace function public.marcar_pedido_entregado(p_pedido_id uuid)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.pedidos where id = p_pedido_id;
  if v_tenant_id is null or not public.tengo_rol_en_tenant(v_tenant_id, array['duena','gerente_general','admin_sede','recepcion']) then
    raise exception 'No autorizado';
  end if;
  update public.pedidos set estado = 'entregado', entregado_at = now(), entregado_por = auth.uid() where id = p_pedido_id and estado = 'pagado';
  return json_build_object('ok', true);
end;
$$;
revoke all on function public.marcar_pedido_entregado(uuid) from public;
grant execute on function public.marcar_pedido_entregado(uuid) to authenticated;

create or replace function public.registrar_venta_presencial(p_tenant_id uuid, p_variante_id uuid, p_cantidad integer, p_metodo_pago text, p_cliente_id uuid)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_variante record; v_producto record; v_pedido_id uuid; v_total numeric;
begin
  if not public.staff_puede_en_sede(p_tenant_id, null, array['duena','gerente_general','admin_sede','recepcion']) then
    raise exception 'No tienes permiso para registrar ventas';
  end if;
  if p_cantidad is null or p_cantidad < 1 then raise exception 'Cantidad inválida'; end if;
  if p_metodo_pago not in ('efectivo', 'tarjeta_estudio', 'transferencia', 'pasarela') then raise exception 'Método de pago no válido'; end if;
  if not exists (select 1 from public.clientes where id = p_cliente_id and tenant_id = p_tenant_id) then raise exception 'Clienta no encontrada'; end if;

  select * into v_variante from public.producto_variantes where id = p_variante_id and tenant_id = p_tenant_id for update;
  if v_variante is null then raise exception 'Producto no encontrado'; end if;
  if v_variante.stock < p_cantidad then raise exception 'No hay suficiente stock — quedan %', v_variante.stock; end if;

  select * into v_producto from public.productos where id = v_variante.producto_id;
  v_total := v_producto.precio * p_cantidad;

  insert into public.pedidos (tenant_id, cliente_id, estado, metodo_pago, total, pagado_at)
    values (p_tenant_id, p_cliente_id, 'pagado', p_metodo_pago, v_total, now()) returning id into v_pedido_id;
  insert into public.pedido_items (tenant_id, pedido_id, tipo, producto_id, variante_id, nombre, variante_nombre, cantidad, precio_unitario)
    values (p_tenant_id, v_pedido_id, 'producto', v_producto.id, v_variante.id, v_producto.nombre, v_variante.nombre, p_cantidad, v_producto.precio);
  update public.producto_variantes set stock = stock - p_cantidad where id = p_variante_id;

  return json_build_object('ok', true, 'pedido_id', v_pedido_id, 'total', v_total);
end;
$$;
revoke all on function public.registrar_venta_presencial(uuid, uuid, integer, text, uuid) from public;
grant execute on function public.registrar_venta_presencial(uuid, uuid, integer, text, uuid) to authenticated;

create or replace function public.cancelar_venta_producto(p_pedido_id uuid)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_pedido record; v_item record;
begin
  select * into v_pedido from public.pedidos where id = p_pedido_id;
  if v_pedido is null then raise exception 'Venta no encontrada'; end if;
  if not public.tengo_rol_en_tenant(v_pedido.tenant_id, array['duena','gerente_general','admin_sede','recepcion']) then
    raise exception 'No tienes permiso para cancelar ventas';
  end if;
  if v_pedido.estado = 'cancelado' then raise exception 'Esta venta ya está cancelada'; end if;
  if exists (select 1 from public.pedido_items where pedido_id = p_pedido_id and tipo <> 'producto') then
    raise exception 'Esta venta incluye un paquete — contacta al estudio para cancelarla, no solo producto.';
  end if;

  for v_item in select * from public.pedido_items where pedido_id = p_pedido_id and tipo = 'producto' loop
    update public.producto_variantes set stock = stock + v_item.cantidad where id = v_item.variante_id;
  end loop;

  if v_pedido.codigo_descuento_usado_id is not null then
    update public.codigos_descuento set usos_actuales = greatest(usos_actuales - 1, 0) where id = v_pedido.codigo_descuento_usado_id;
  end if;
  update public.pedidos set estado = 'cancelado' where id = p_pedido_id;
  return json_build_object('ok', true);
end;
$$;
revoke all on function public.cancelar_venta_producto(uuid) from public;
grant execute on function public.cancelar_venta_producto(uuid) to authenticated;

create or replace function public.editar_venta_producto(p_pedido_id uuid, p_cliente_id uuid, p_variante_id uuid, p_cantidad integer, p_metodo_pago text)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_pedido record; v_item record; v_variante record; v_producto record; v_total numeric;
begin
  select * into v_pedido from public.pedidos where id = p_pedido_id;
  if v_pedido is null then raise exception 'Venta no encontrada'; end if;
  if not public.tengo_rol_en_tenant(v_pedido.tenant_id, array['duena','gerente_general','admin_sede','recepcion']) then
    raise exception 'No tienes permiso para editar ventas';
  end if;
  if p_cantidad is null or p_cantidad < 1 then raise exception 'Cantidad inválida'; end if;
  if p_metodo_pago not in ('efectivo', 'tarjeta_estudio', 'transferencia', 'pasarela') then raise exception 'Método de pago no válido'; end if;
  if not exists (select 1 from public.clientes where id = p_cliente_id and tenant_id = v_pedido.tenant_id) then raise exception 'Clienta no encontrada'; end if;
  if v_pedido.estado = 'cancelado' then raise exception 'Esta venta está cancelada — no se puede editar'; end if;
  if (select count(*) from public.pedido_items where pedido_id = p_pedido_id) <> 1
     or exists (select 1 from public.pedido_items where pedido_id = p_pedido_id and tipo <> 'producto') then
    raise exception 'Esta venta no se puede editar aquí';
  end if;

  select * into v_item from public.pedido_items where pedido_id = p_pedido_id;
  update public.producto_variantes set stock = stock + v_item.cantidad where id = v_item.variante_id;

  select * into v_variante from public.producto_variantes where id = p_variante_id and tenant_id = v_pedido.tenant_id for update;
  if v_variante is null then
    update public.producto_variantes set stock = stock - v_item.cantidad where id = v_item.variante_id;
    raise exception 'Producto no encontrado';
  end if;
  if v_variante.stock < p_cantidad then
    update public.producto_variantes set stock = stock - v_item.cantidad where id = v_item.variante_id;
    raise exception 'No hay suficiente stock — quedan %', v_variante.stock;
  end if;

  select * into v_producto from public.productos where id = v_variante.producto_id;
  v_total := v_producto.precio * p_cantidad;
  update public.producto_variantes set stock = stock - p_cantidad where id = p_variante_id;

  update public.pedido_items set producto_id = v_producto.id, variante_id = v_variante.id, nombre = v_producto.nombre,
    variante_nombre = v_variante.nombre, cantidad = p_cantidad, precio_unitario = v_producto.precio where id = v_item.id;
  update public.pedidos set cliente_id = p_cliente_id, metodo_pago = p_metodo_pago, total = v_total where id = p_pedido_id;

  return json_build_object('ok', true, 'total', v_total);
end;
$$;
revoke all on function public.editar_venta_producto(uuid, uuid, uuid, integer, text) from public;
grant execute on function public.editar_venta_producto(uuid, uuid, uuid, integer, text) to authenticated;

create or replace function public.mis_pedidos(p_tenant_id uuid)
returns table(pedido_id uuid, estado text, metodo_pago text, total numeric, created_at timestamptz, pagado_at timestamptz, entregado_at timestamptz, items text)
language sql stable security definer
set search_path to 'public'
as $$
  select pd.id, pd.estado, pd.metodo_pago, pd.total, pd.created_at, pd.pagado_at, pd.entregado_at,
    string_agg(pi.cantidad || 'x ' || pi.nombre || coalesce(' (' || pi.variante_nombre || ')', ''), ', ' order by pi.nombre)
  from public.pedidos pd join public.pedido_items pi on pi.pedido_id = pd.id
  where pd.cliente_id = public.mi_cliente_id(p_tenant_id)
  group by pd.id, pd.estado, pd.metodo_pago, pd.total, pd.created_at, pd.pagado_at, pd.entregado_at
  order by pd.created_at desc;
$$;
revoke all on function public.mis_pedidos(uuid) from public;
grant execute on function public.mis_pedidos(uuid) to authenticated;

create or replace function public.canjear_gift_card(p_tenant_id uuid, p_codigo text)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_cliente_id uuid; v_gift record; v_paquete record; v_membresia_id uuid;
begin
  v_cliente_id := public.mi_cliente_id(p_tenant_id);
  if v_cliente_id is null then raise exception 'Primero completa tu registro'; end if;

  select * into v_gift from public.gift_cards where tenant_id = p_tenant_id and codigo = upper(trim(p_codigo)) and estado = 'activa';
  if v_gift is null then raise exception 'Código no válido o ya canjeado'; end if;

  select num_clases, vigencia_dias, cobertura into v_paquete from public.paquetes where id = v_gift.paquete_id;
  insert into public.membresias (tenant_id, cliente_id, paquete_id, cobertura_tipo, clases_totales, clases_usadas,
    fecha_inicio, fecha_vencimiento, estado, metodo_pago, pagada, origen)
    values (p_tenant_id, v_cliente_id, v_gift.paquete_id, v_paquete.cobertura, v_paquete.num_clases, 0,
      public.hoy_en_sede(null), public.hoy_en_sede(null) + v_paquete.vigencia_dias, 'activa', 'transferencia', true, 'gift_card')
    returning id into v_membresia_id;
  perform public._snapshot_cobertura_membresia(v_membresia_id, v_gift.paquete_id);

  update public.gift_cards set estado = 'canjeada', canjeada_por = v_cliente_id, canjeada_at = now() where id = v_gift.id;
  return json_build_object('ok', true, 'membresia_id', v_membresia_id);
end;
$$;
revoke all on function public.canjear_gift_card(uuid, text) from public;
grant execute on function public.canjear_gift_card(uuid, text) to authenticated;

create or replace function public.crear_gift_card(p_tenant_id uuid, p_paquete_id uuid, p_comprador_nombre text, p_destinatario_nombre text, p_destinatario_email text, p_metodo_pago text default null)
returns json
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_codigo text; v_id uuid;
begin
  if not public.staff_puede_en_sede(p_tenant_id, null, array['duena','gerente_general','admin_sede','recepcion']) then
    raise exception 'No autorizado';
  end if;
  if p_metodo_pago is not null and p_metodo_pago not in ('tarjeta', 'efectivo') then raise exception 'Método de pago no válido'; end if;

  loop
    v_codigo := 'GC-' || upper(substr(md5(random()::text), 1, 6));
    exit when not exists (select 1 from public.gift_cards where tenant_id = p_tenant_id and codigo = v_codigo);
  end loop;

  insert into public.gift_cards (tenant_id, codigo, paquete_id, comprador_nombre, destinatario_nombre, destinatario_email, metodo_pago, created_by)
    values (p_tenant_id, v_codigo, p_paquete_id, p_comprador_nombre, p_destinatario_nombre, p_destinatario_email, p_metodo_pago, auth.uid())
    returning id into v_id;

  return json_build_object('ok', true, 'id', v_id, 'codigo', v_codigo);
end;
$$;
revoke all on function public.crear_gift_card(uuid, uuid, text, text, text, text) from public;
grant execute on function public.crear_gift_card(uuid, uuid, text, text, text, text) to authenticated;

create or replace function public.gasto_productos_clienta(p_cliente_id uuid)
returns numeric
language sql stable security definer
set search_path to 'public'
as $$
  select coalesce(sum(pi.cantidad * pi.precio_unitario), 0)
  from public.pedido_items pi join public.pedidos pd on pd.id = pi.pedido_id
  where pd.cliente_id = p_cliente_id and pd.estado in ('pagado', 'entregado') and pi.tipo = 'producto';
$$;
revoke all on function public.gasto_productos_clienta(uuid) from public;
grant execute on function public.gasto_productos_clienta(uuid) to authenticated;

create or replace function public.top_clientas_gasto_productos(p_tenant_id uuid)
returns table(cliente_nombre text, pedidos bigint, gasto numeric)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then return; end if;
  return query
  select c.nombre, count(distinct pd.id), sum(pi.cantidad * pi.precio_unitario)
  from public.pedido_items pi join public.pedidos pd on pd.id = pi.pedido_id join public.clientes c on c.id = pd.cliente_id
  where pd.tenant_id = p_tenant_id and pd.estado in ('pagado', 'entregado') and pi.tipo = 'producto'
  group by c.id, c.nombre order by sum(pi.cantidad * pi.precio_unitario) desc limit 20;
end;
$$;
revoke all on function public.top_clientas_gasto_productos(uuid) from public;
grant execute on function public.top_clientas_gasto_productos(uuid) to authenticated;

create or replace function public.ventas_producto_recientes(p_tenant_id uuid)
returns table(pedido_id uuid, cliente_id uuid, cliente_nombre text, total numeric, metodo_pago text, pagado_at timestamptz,
  estado text, items text, editable boolean, variante_id uuid, cantidad integer)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','admin_sede','recepcion']) then return; end if;
  return query
  select pd.id, pd.cliente_id, c.nombre, pd.total, pd.metodo_pago, pd.pagado_at, pd.estado,
    string_agg(pi.cantidad || 'x ' || pi.nombre || coalesce(' (' || pi.variante_nombre || ')', ''), ', ' order by pi.nombre),
    count(*) = 1, (array_agg(pi.variante_id))[1], (array_agg(pi.cantidad))[1]
  from public.pedidos pd join public.clientes c on c.id = pd.cliente_id join public.pedido_items pi on pi.pedido_id = pd.id
  where pd.tenant_id = p_tenant_id and pi.tipo = 'producto' and pd.estado in ('pagado', 'entregado') and pd.pagado_at > now() - interval '30 days'
  group by pd.id, pd.cliente_id, c.nombre, pd.total, pd.metodo_pago, pd.pagado_at, pd.estado
  order by pd.pagado_at desc limit 50;
end;
$$;
revoke all on function public.ventas_producto_recientes(uuid) from public;
grant execute on function public.ventas_producto_recientes(uuid) to authenticated;

create or replace function public.ventas_por_hora_del_dia(p_tenant_id uuid)
returns table(hora integer, cantidad integer, monto numeric)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then return; end if;
  return query
  with horas as (select generate_series(0, 23) as hora),
  ventas as (
    select extract(hour from m.confirmado_at)::int as hora, coalesce(m.precio_final, pq.precio, 0) as monto
    from public.membresias m join public.paquetes pq on pq.id = m.paquete_id
    where m.tenant_id = p_tenant_id and m.pagada = true and m.confirmado_at is not null and m.origen = 'compra'
  )
  select h.hora, count(v.hora)::int, coalesce(sum(v.monto), 0) from horas h left join ventas v on v.hora = h.hora
  group by h.hora order by h.hora;
end;
$$;
revoke all on function public.ventas_por_hora_del_dia(uuid) from public;
grant execute on function public.ventas_por_hora_del_dia(uuid) to authenticated;

create or replace function public.rotacion_productos(p_tenant_id uuid)
returns table(producto_nombre text, variante_nombre text, unidades_vendidas bigint, ingresos numeric, stock_actual integer)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then return; end if;
  return query
  select p.nombre, v.nombre, coalesce(sum(pi.cantidad), 0), coalesce(sum(pi.cantidad * pi.precio_unitario), 0), v.stock
  from public.producto_variantes v join public.productos p on p.id = v.producto_id
  left join public.pedido_items pi on pi.variante_id = v.id and pi.pedido_id in (select id from public.pedidos where estado in ('pagado', 'entregado'))
  where v.tenant_id = p_tenant_id
  group by p.id, p.nombre, p.orden, v.id, v.nombre, v.orden, v.stock
  order by p.orden, p.nombre, v.orden;
end;
$$;
revoke all on function public.rotacion_productos(uuid) from public;
grant execute on function public.rotacion_productos(uuid) to authenticated;
