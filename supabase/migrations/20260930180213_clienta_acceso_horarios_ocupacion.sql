-- Cierra un hueco real de RLS: current_tenant_ids() solo lee tenant_memberships
-- (staff), nunca la tabla clientes. Una clienta nunca pudo leer horarios
-- directamente -- necesario para construir la pantalla de booking del cliente
-- (/reservar). reservas_propia_select ya limita a una clienta a ver solo sus
-- propias reservas, así que la ocupación total (cuántas personas hay en una
-- clase) se expone solo como conteo agregado vía RPC, nunca como filas crudas
-- de reservas de otras clientas -- mismo criterio de privacidad que el resto
-- del proyecto.

create policy horarios_clienta_select on public.horarios for select using (
  tenant_id in (select tenant_id from public.clientes where user_id = auth.uid())
);

create or replace function public.ocupacion_horarios(p_horario_ids uuid[], p_fecha_inicio date, p_fecha_fin date)
returns table(horario_id uuid, fecha date, ocupados int)
language sql stable security definer
set search_path to 'public'
as $$
  select r.horario_id, r.fecha, count(*)::int
    from public.reservas r
    where r.horario_id = any(p_horario_ids)
      and r.fecha between p_fecha_inicio and p_fecha_fin
      and r.estado = 'confirmada'
    group by r.horario_id, r.fecha;
$$;
revoke all on function public.ocupacion_horarios(uuid[], date, date) from public;
grant execute on function public.ocupacion_horarios(uuid[], date, date) to authenticated;
