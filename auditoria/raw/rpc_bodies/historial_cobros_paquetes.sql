CREATE OR REPLACE FUNCTION public.historial_cobros_paquetes(p_limite integer DEFAULT 100)
 RETURNS TABLE(membresia_id uuid, paquete_id uuid, cliente_nombre text, paquete_nombre text, monto numeric, metodo_pago text, codigo text, estado text, pagada boolean, comprobante_url text, fecha timestamp with time zone, origen text, clases_totales integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return;
  end if;

  return query
  select
    m.id,
    m.paquete_id,
    c.nombre,
    p.nombre,
    coalesce(m.precio_final, p.precio),
    m.metodo_pago,
    cd.codigo,
    m.estado,
    m.pagada,
    m.comprobante_url,
    coalesce(m.confirmado_at, m.created_at),
    m.origen,
    m.clases_totales
  from membresias m
  join clientes c on c.id = m.cliente_id
  join paquetes p on p.id = m.paquete_id
  left join codigos_descuento cd on cd.id = m.codigo_descuento_id
  where m.pagada = true
  order by coalesce(m.confirmado_at, m.created_at) desc
  limit p_limite;
end;
$function$
