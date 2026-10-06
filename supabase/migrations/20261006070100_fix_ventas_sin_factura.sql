-- Corrección: las columnas de la unión necesitan nombre para poder filtrar por origen.
create or replace function public.ventas_sin_factura(p_tenant_id uuid)
returns table(origen_tipo text, origen_id uuid, fecha date, sede_id uuid, sede text, cliente_id uuid, cliente text, concepto text, monto numeric)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','contadora','admin_sede','recepcion']) then raise exception 'No autorizado'; end if;
  return query
  select * from (
    select 'membresia'::text as origen_tipo, m.id as origen_id, m.confirmado_at::date as fecha, m.sede_venta_id as sede_id, s.name as sede, m.cliente_id as cliente_id, c.nombre as cliente, ('Paquete ' || p.nombre)::text as concepto, m.precio_final as monto
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
