-- Lista de espera con el mismo alcance que el roster, y "clienta atendida" también por compras en tienda o cobros en la sede.
create or replace function public.espera_horario(p_horario_id uuid, p_fecha date)
returns table(id uuid, nombre text, created_at timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  return query select le.id, c.nombre, le.created_at from public.lista_espera le join public.horarios h on h.id = le.horario_id join public.clientes c on c.id = le.cliente_id
    where le.horario_id = p_horario_id and le.fecha = p_fecha
      and ( public._es_g(le.tenant_id)
         or (public._es_rol_sede(le.tenant_id) and h.sede_id = any(public._mis_sedes(le.tenant_id)))
         or (public._mi_rol(le.tenant_id) = 'instructora' and h.instructor_membership_id = public._mi_membership(le.tenant_id)))
    order by le.created_at;
end $$;
revoke all on function public.espera_horario(uuid, date) from public;
grant execute on function public.espera_horario(uuid, date) to authenticated;

create or replace function public._cliente_atendida(p_cliente_id uuid)
returns boolean language plpgsql stable security definer set search_path to 'public' as $$
declare c record; v_sedes uuid[];
begin
  select id, tenant_id, sede_habitual_id, creada_por, tutor_id into c from public.clientes where id = p_cliente_id;
  if c is null then return false; end if;
  if public._es_g(c.tenant_id) then return true; end if;
  if not public._es_rol_sede(c.tenant_id) then return false; end if;
  v_sedes := public._mis_sedes(c.tenant_id);
  if c.sede_habitual_id = any(v_sedes) or c.creada_por = auth.uid() then return true; end if;
  if exists (select 1 from public.reservas r where r.cliente_id = c.id and r.sede_id = any(v_sedes)) then return true; end if;
  if exists (select 1 from public.membresias m where m.cliente_id = c.id and m.sede_venta_id = any(v_sedes)) then return true; end if;
  if exists (select 1 from public.pedidos p where p.cliente_id = c.id and p.sede_entrega_id = any(v_sedes)) then return true; end if;
  if exists (select 1 from public.cobros_personalizados k where k.cliente_id = c.id and k.sede_id = any(v_sedes)) then return true; end if;
  if c.tutor_id is not null and exists (select 1 from public.clientes t where t.id = c.tutor_id and (t.sede_habitual_id = any(v_sedes) or t.creada_por = auth.uid())) then return true; end if;
  return false;
end $$;
