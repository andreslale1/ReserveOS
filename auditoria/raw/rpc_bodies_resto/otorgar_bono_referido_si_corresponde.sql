CREATE OR REPLACE FUNCTION public.otorgar_bono_referido_si_corresponde(p_cliente_id uuid, p_paquete_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_referido record;
begin
  select c.referido_por, c.credito_referido_otorgado into v_referido
    from clientes c where c.id = p_cliente_id;

  if v_referido.referido_por is not null and not v_referido.credito_referido_otorgado then
    insert into membresias (cliente_id, paquete_id, clases_totales, clases_usadas, fecha_inicio, fecha_vencimiento, estado, metodo_pago, precio_final, pagada, origen)
      values (v_referido.referido_por, p_paquete_id, 1, 0, ((now() - interval '6 hours')::date), ((now() - interval '6 hours')::date) + 90, 'activa', 'transferencia', 0, true, 'bono_referido');

    update clientes set credito_referido_otorgado = true where id = p_cliente_id;
  end if;
end;
$function$
