-- ST-07: tienda e inventario completos. Productos y variantes gestionables, stock que nunca queda negativo (aunque dos
-- compras coincidan), historial de movimientos de inventario con motivo, y gift cards con vencimiento, anulación y canje
-- atómico (un código solo se canjea una vez, incluso bajo concurrencia).

-- ---------- Inventario ----------
create or replace function public._stock_no_negativo()
returns trigger language plpgsql as $$
begin
  if new.stock < 0 then
    raise exception 'No hay stock suficiente de "%".', (select p.nombre || coalesce(' - ' || new.nombre, '') from public.productos p where p.id = new.producto_id);
  end if;
  return new;
end $$;
drop trigger if exists variantes_stock_no_negativo on public.producto_variantes;
create trigger variantes_stock_no_negativo before insert or update of stock on public.producto_variantes for each row execute function public._stock_no_negativo();

create table if not exists public.movimientos_inventario (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  variante_id uuid not null references public.producto_variantes(id) on delete cascade,
  delta integer not null,
  saldo integer not null,
  tipo text not null check (tipo in ('entrada','salida','ajuste','venta','devolucion','inicial')),
  motivo text,
  actor_id uuid default auth.uid(),
  actor_nombre text,
  created_at timestamptz not null default now()
);
create index if not exists movimientos_inventario_variante_idx on public.movimientos_inventario (variante_id, created_at desc);
alter table public.movimientos_inventario enable row level security;
revoke all on public.movimientos_inventario from anon, authenticated;

-- Todo cambio de stock queda registrado, venga del flujo que venga (venta, ajuste manual, devolución…).
create or replace function public._registrar_movimiento_stock()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_delta integer; v_tipo text; v_motivo text;
begin
  if tg_op = 'INSERT' then v_delta := new.stock; v_tipo := 'inicial';
  else
    v_delta := new.stock - old.stock;
    if v_delta = 0 then return new; end if;
  end if;
  v_motivo := nullif(current_setting('app.motivo_stock', true), '');
  v_tipo := coalesce(nullif(current_setting('app.tipo_stock', true), ''), case when tg_op = 'INSERT' then 'inicial' when v_delta < 0 then 'venta' else 'ajuste' end);
  insert into public.movimientos_inventario (tenant_id, variante_id, delta, saldo, tipo, motivo, actor_nombre)
    values (new.tenant_id, new.id, v_delta, new.stock, v_tipo, v_motivo, public._nombre_actor(new.tenant_id));
  return new;
end $$;
drop trigger if exists variantes_registrar_movimiento on public.producto_variantes;
create trigger variantes_registrar_movimiento after insert or update of stock on public.producto_variantes for each row execute function public._registrar_movimiento_stock();

create or replace function public.inventario_ajustar(p_variante_id uuid, p_delta integer, p_tipo text, p_motivo text)
returns json language plpgsql security definer set search_path to 'public' as $$
declare v_t uuid;
begin
  select tenant_id into v_t from public.producto_variantes where id = p_variante_id;
  if v_t is null then raise exception 'Producto no encontrado'; end if;
  perform public._exigir_modulo(v_t, 'tienda_inventario');
  if not public.tengo_rol_en_tenant(v_t, array['duena','gerente_general','admin_sede','recepcion']) then raise exception 'No autorizado'; end if;
  if p_delta = 0 then raise exception 'El ajuste no puede ser 0'; end if;
  if p_tipo not in ('entrada','salida','ajuste','devolucion') then raise exception 'Tipo de movimiento no válido'; end if;
  if p_motivo is null or length(trim(p_motivo)) < 3 then raise exception 'Escribe el motivo del movimiento'; end if;
  perform set_config('app.motivo_stock', trim(p_motivo), true);
  perform set_config('app.tipo_stock', p_tipo, true);
  update public.producto_variantes set stock = stock + p_delta where id = p_variante_id;
  return json_build_object('ok', true, 'stock', (select stock from public.producto_variantes where id = p_variante_id));
end $$;
revoke all on function public.inventario_ajustar(uuid, integer, text, text) from public;
grant execute on function public.inventario_ajustar(uuid, integer, text, text) to authenticated;

create or replace function public.movimientos_listar(p_tenant_id uuid, p_variante_id uuid default null)
returns table(created_at timestamptz, producto text, variante text, delta integer, saldo integer, tipo text, motivo text, actor text)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','admin_sede','recepcion','contadora']) then raise exception 'No autorizado'; end if;
  return query select m.created_at, p.nombre, v.nombre, m.delta, m.saldo, m.tipo, m.motivo, m.actor_nombre
    from public.movimientos_inventario m join public.producto_variantes v on v.id = m.variante_id join public.productos p on p.id = v.producto_id
    where m.tenant_id = p_tenant_id and (p_variante_id is null or m.variante_id = p_variante_id) order by m.created_at desc limit 80;
end $$;
revoke all on function public.movimientos_listar(uuid, uuid) from public;
grant execute on function public.movimientos_listar(uuid, uuid) to authenticated;

-- ---------- Catálogo ----------
create or replace function public.producto_guardar(p_id uuid, p_tenant_id uuid, p_nombre text, p_descripcion text, p_precio numeric, p_categoria text, p_imagen_url text, p_activo boolean)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; v_variante uuid;
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then raise exception 'No autorizado'; end if;
  perform public._exigir_modulo(p_tenant_id, 'tienda_inventario');
  if p_nombre is null or length(trim(p_nombre)) < 2 then raise exception 'El nombre es obligatorio'; end if;
  if p_precio is null or p_precio < 0 then raise exception 'El precio no es válido'; end if;
  if p_id is null then
    insert into public.productos (tenant_id, nombre, descripcion, precio, categoria, imagen_url, activo)
      values (p_tenant_id, trim(p_nombre), p_descripcion, p_precio, nullif(trim(coalesce(p_categoria,'')),''), nullif(trim(coalesce(p_imagen_url,'')),''), coalesce(p_activo,true)) returning id into v_id;
    insert into public.producto_variantes (tenant_id, producto_id, nombre, stock) values (p_tenant_id, v_id, 'Única', 0) returning id into v_variante;
  else
    update public.productos set nombre = trim(p_nombre), descripcion = p_descripcion, precio = p_precio, categoria = nullif(trim(coalesce(p_categoria,'')),''),
      imagen_url = nullif(trim(coalesce(p_imagen_url,'')),''), activo = coalesce(p_activo, activo) where id = p_id and tenant_id = p_tenant_id returning id into v_id;
    if v_id is null then raise exception 'Producto no encontrado'; end if;
  end if;
  return v_id;
end $$;
revoke all on function public.producto_guardar(uuid, uuid, text, text, numeric, text, text, boolean) from public;
grant execute on function public.producto_guardar(uuid, uuid, text, text, numeric, text, text, boolean) to authenticated;

create or replace function public.variante_guardar(p_producto_id uuid, p_nombre text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_t uuid; v_id uuid;
begin
  select tenant_id into v_t from public.productos where id = p_producto_id;
  if v_t is null or not public.tengo_rol_en_tenant(v_t, array['duena','gerente_general']) then raise exception 'No autorizado'; end if;
  if p_nombre is null or length(trim(p_nombre)) < 1 then raise exception 'El nombre de la variante es obligatorio'; end if;
  insert into public.producto_variantes (tenant_id, producto_id, nombre, stock) values (v_t, p_producto_id, trim(p_nombre), 0) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.variante_guardar(uuid, text) from public;
grant execute on function public.variante_guardar(uuid, text) to authenticated;

-- ---------- Gift cards ----------
alter table public.gift_cards add column if not exists vence date;
update public.gift_cards set vence = (created_at + interval '12 months')::date where vence is null;
alter table public.gift_cards alter column vence set default (current_date + 365);

create or replace function public.canjear_gift_card(p_tenant_id uuid, p_codigo text)
returns json language plpgsql security definer set search_path to 'public' as $$
declare v_cliente_id uuid; v_gift record; v_paquete record; v_membresia_id uuid; v_sede uuid;
begin
  v_cliente_id := public.mi_cliente_id(p_tenant_id);
  if v_cliente_id is null then raise exception 'Primero completa tu registro'; end if;
  -- Bloqueo de la fila: si dos personas canjean el mismo código a la vez, la segunda espera y ve que ya fue canjeado.
  select * into v_gift from public.gift_cards where tenant_id = p_tenant_id and codigo = upper(trim(p_codigo)) for update;
  if v_gift is null then raise exception 'Código no válido'; end if;
  if v_gift.estado = 'canjeada' then raise exception 'Este código ya fue canjeado'; end if;
  if v_gift.estado = 'cancelada' then raise exception 'Esta tarjeta fue anulada por el estudio'; end if;
  if v_gift.vence is not null and v_gift.vence < current_date then raise exception 'Esta tarjeta venció el %', to_char(v_gift.vence, 'DD/MM/YYYY'); end if;
  select sede_habitual_id into v_sede from public.clientes where id = v_cliente_id;
  v_sede := coalesce(v_sede, (select id from public.sedes where tenant_id = p_tenant_id and status = 'activa' order by created_at limit 1));
  select num_clases, vigencia_dias, cobertura into v_paquete from public.paquetes where id = v_gift.paquete_id;
  insert into public.membresias (tenant_id, cliente_id, paquete_id, sede_venta_id, cobertura_tipo, clases_totales, clases_usadas, fecha_inicio, fecha_vencimiento,
      estado, metodo_pago, precio_final, pagada, origen, confirmado_at)
    values (p_tenant_id, v_cliente_id, v_gift.paquete_id, v_sede, v_paquete.cobertura, v_paquete.num_clases, 0, public.hoy_en_sede(v_sede),
      public.hoy_en_sede(v_sede) + v_paquete.vigencia_dias, 'activa', 'cortesia', 0, true, 'gift_card', now())
    returning id into v_membresia_id;
  perform public._snapshot_cobertura_membresia(v_membresia_id, v_gift.paquete_id);
  update public.gift_cards set estado = 'canjeada', canjeada_por = v_cliente_id, canjeada_at = now() where id = v_gift.id;
  return json_build_object('ok', true, 'membresia_id', v_membresia_id);
end $$;

create or replace function public.gift_card_anular(p_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v record;
begin
  select * into v from public.gift_cards where id = p_id for update;
  if v is null then raise exception 'Tarjeta no encontrada'; end if;
  if not public.tengo_rol_en_tenant(v.tenant_id, array['duena','gerente_general']) then raise exception 'No autorizado'; end if;
  if v.estado <> 'activa' then raise exception 'Solo se anula una tarjeta que sigue activa (ya está %).', v.estado; end if;
  if p_motivo is null or length(trim(p_motivo)) < 3 then raise exception 'Escribe el motivo'; end if;
  update public.gift_cards set estado = 'cancelada' where id = p_id;
  insert into public.admin_acciones_log (tenant_id, actor_id, actor_nombre, tabla, operacion, registro_id, detalle)
    values (v.tenant_id, auth.uid(), public._nombre_actor(v.tenant_id), 'gift_cards', 'anular', p_id::text, jsonb_build_object('motivo', p_motivo, 'codigo', v.codigo));
end $$;
revoke all on function public.gift_card_anular(uuid, text) from public;
grant execute on function public.gift_card_anular(uuid, text) to authenticated;

create or replace function public.gift_cards_listar(p_tenant_id uuid)
returns table(id uuid, codigo text, paquete text, comprador text, destinatario text, email text, estado text, vence date, created_at timestamptz, canjeada_at timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','admin_sede','recepcion']) then raise exception 'No autorizado'; end if;
  return query select g.id, g.codigo, p.nombre, g.comprador_nombre, g.destinatario_nombre, g.destinatario_email,
      case when g.estado = 'activa' and g.vence < current_date then 'vencida' else g.estado end, g.vence, g.created_at, g.canjeada_at
    from public.gift_cards g join public.paquetes p on p.id = g.paquete_id where g.tenant_id = p_tenant_id order by g.created_at desc limit 100;
end $$;
revoke all on function public.gift_cards_listar(uuid) from public;
grant execute on function public.gift_cards_listar(uuid) to authenticated;
