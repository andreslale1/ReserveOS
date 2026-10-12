-- «Invitar y ganar»: el bono se otorgaba solo al pagarse un pedido de tienda; el caso principal (la referida compra su paquete) no lo disparaba.
-- Ahora se dispara cuando una membresía pasa a pagada (una sola vez por referida) y el bono queda con su cobertura de sedes (si no, no serviría en ninguna).
create or replace function public.otorgar_bono_referido_si_corresponde(p_cliente_id uuid, p_paquete_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_cliente record; v_m uuid; v_sede uuid;
begin
  select tenant_id, referido_por, credito_referido_otorgado into v_cliente from public.clientes where id = p_cliente_id;
  if v_cliente.referido_por is not null and not coalesce(v_cliente.credito_referido_otorgado, false) then
    select sede_habitual_id into v_sede from public.clientes where id = v_cliente.referido_por;
    insert into public.membresias (tenant_id, cliente_id, paquete_id, sede_venta_id, cobertura_tipo, clases_totales, clases_usadas,
      fecha_inicio, fecha_vencimiento, estado, metodo_pago, precio_final, pagada, origen)
      select v_cliente.tenant_id, v_cliente.referido_por, p_paquete_id, v_sede, pq.cobertura, 1, 0,
        public.hoy_en_sede(v_sede), public.hoy_en_sede(v_sede) + 90, 'activa', 'cortesia', 0, true, 'bono_referido'
      from public.paquetes pq where pq.id = p_paquete_id
      returning id into v_m;
    if v_m is not null then perform public._snapshot_cobertura_membresia(v_m, p_paquete_id); end if;
    update public.clientes set credito_referido_otorgado = true where id = p_cliente_id;
  end if;
end $$;

create or replace function public._bono_referido_trigger() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.pagada = true and (tg_op = 'INSERT' or old.pagada is distinct from true)
     and coalesce(new.origen, '') not in ('bono_referido', 'gift_card') and coalesce(new.precio_final, 0) > 0 then
    perform public.otorgar_bono_referido_si_corresponde(new.cliente_id, new.paquete_id);
  end if;
  return new;
end $$;
drop trigger if exists trg_bono_referido on public.membresias;
create trigger trg_bono_referido after insert or update of pagada on public.membresias for each row execute function public._bono_referido_trigger();
revoke all on function public.otorgar_bono_referido_si_corresponde(uuid, uuid) from public, anon, authenticated;
revoke all on function public._bono_referido_trigger() from public, anon, authenticated;
