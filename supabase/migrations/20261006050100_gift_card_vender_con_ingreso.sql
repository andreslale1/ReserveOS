-- Vender una gift card es un ingreso: se registra como cobro de la sede (caja y finanzas), atómicamente con la tarjeta.
-- (crear_gift_card seguía creando la tarjeta sin cobro, así que la venta nunca aparecía en caja ni en finanzas.)
create or replace function public.gift_card_vender(p_tenant_id uuid, p_sede_id uuid, p_paquete_id uuid, p_comprador text, p_destinatario text, p_email text, p_metodo text)
returns json language plpgsql security definer set search_path to 'public' as $$
declare v_p record; v_codigo text; v_id uuid; v_mostrador uuid;
begin
  perform public._exigir_modulo(p_tenant_id, 'descuentos_gift_cards');
  if not public.staff_puede_en_sede(p_tenant_id, p_sede_id, array['duena','gerente_general','admin_sede','recepcion']) then raise exception 'No autorizado'; end if;
  if p_metodo not in ('efectivo','tarjeta_estudio','transferencia') then raise exception 'Método de pago no válido'; end if;
  if p_destinatario is null or length(trim(p_destinatario)) < 2 then raise exception 'Escribe para quién es la tarjeta'; end if;
  select * into v_p from public.paquetes where id = p_paquete_id and tenant_id = p_tenant_id and activo;
  if v_p is null then raise exception 'Paquete no válido'; end if;
  if not exists (select 1 from public.sedes where id = p_sede_id and tenant_id = p_tenant_id) then raise exception 'Sede no válida'; end if;
  loop
    v_codigo := 'GC-' || upper(substr(md5(random()::text), 1, 6));
    exit when not exists (select 1 from public.gift_cards where tenant_id = p_tenant_id and codigo = v_codigo);
  end loop;
  insert into public.gift_cards (tenant_id, codigo, paquete_id, comprador_nombre, destinatario_nombre, destinatario_email, metodo_pago, created_by)
    values (p_tenant_id, v_codigo, p_paquete_id, nullif(trim(coalesce(p_comprador,'')),''), trim(p_destinatario), nullif(trim(coalesce(p_email,'')),''), p_metodo, auth.uid()) returning id into v_id;
  v_mostrador := public.obtener_cliente_mostrador(p_tenant_id);
  insert into public.cobros_personalizados (tenant_id, sede_id, cliente_id, concepto, monto, metodo_pago, confirmado_at, confirmado_por)
    values (p_tenant_id, p_sede_id, v_mostrador, 'Gift card ' || v_codigo || ' · ' || v_p.nombre, v_p.precio, p_metodo, now(), auth.uid());
  return json_build_object('ok', true, 'id', v_id, 'codigo', v_codigo, 'monto', v_p.precio);
end $$;
revoke all on function public.gift_card_vender(uuid, uuid, uuid, text, text, text, text) from public;
grant execute on function public.gift_card_vender(uuid, uuid, uuid, text, text, text, text) to authenticated;
