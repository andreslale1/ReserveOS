-- AUTOMATIZACIONES · funciones. Cada una recibe «ahora» (para poder simular la hora) y opcionalmente un estudio (p_tenant), y devuelve cuántos
-- mensajes NUEVOS entraron a la cola (-1 si falló; el error queda en automatizaciones_ejecuciones). Nada se envía: solo se encola.

-- 1 · Recordatorio 1 hora antes de la clase --------------------------------------------------------------------------------
create or replace function public.auto_recordatorio_clase(p_ahora timestamptz default now(), p_tenant uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; k int; det jsonb := '{}'; t0 timestamptz := clock_timestamp();
begin
  for r in select rs.id, rs.tenant_id, rs.cliente_id, rs.fecha, h.nombre_clase, h.hora_inicio
      from public.reservas rs join public.horarios h on h.id = rs.horario_id join public.sedes s on s.id = rs.sede_id
     where rs.estado = 'confirmada' and h.activo and (p_tenant is null or rs.tenant_id = p_tenant)
       and (rs.fecha + h.hora_inicio) >  (p_ahora at time zone s.timezone) + interval '50 minutes'
       and (rs.fecha + h.hora_inicio) <= (p_ahora at time zone s.timezone) + interval '70 minutes'
       and not exists (select 1 from public.horario_cancelaciones hc where hc.horario_id = h.id and hc.fecha = rs.fecha) loop
    if not public._auto_activa(r.tenant_id, 'recordatorio_clase') then continue; end if;
    k := public._encolar_auto(r.tenant_id, r.cliente_id, 'recordatorio_clase', jsonb_build_object('clase', r.nombre_clase, 'hora', to_char(r.hora_inicio, 'HH24:MI'), 'fecha', to_char(r.fecha, 'DD/MM')), 'rec1h:' || r.id);
    n := n + k; if k > 0 then det := public._sumar(det, r.tenant_id, k); end if;
  end loop;
  perform public._auto_log('recordatorio_clase', t0, det, null); return n;
exception when others then perform public._auto_log('recordatorio_clase', t0, det, sqlerrm); return -1;
end $$;

-- 2 · Recordatorio de reserva agendada (entre 12 y 24 horas antes) ------------------------------------------------------------
create or replace function public.auto_reserva_agendada(p_ahora timestamptz default now(), p_tenant uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; k int; det jsonb := '{}'; t0 timestamptz := clock_timestamp();
begin
  for r in select rs.id, rs.tenant_id, rs.cliente_id, rs.fecha, h.nombre_clase, h.hora_inicio
      from public.reservas rs join public.horarios h on h.id = rs.horario_id join public.sedes s on s.id = rs.sede_id
     where rs.estado = 'confirmada' and h.activo and rs.recordatorio_agendada_enviado_at is null and (p_tenant is null or rs.tenant_id = p_tenant)
       and (rs.fecha + h.hora_inicio) >  (p_ahora at time zone s.timezone) + interval '12 hours'
       and (rs.fecha + h.hora_inicio) <= (p_ahora at time zone s.timezone) + interval '24 hours'
       and not exists (select 1 from public.horario_cancelaciones hc where hc.horario_id = h.id and hc.fecha = rs.fecha) loop
    if not public._auto_activa(r.tenant_id, 'reserva_agendada') then continue; end if;
    k := public._encolar_auto(r.tenant_id, r.cliente_id, 'reserva_agendada', jsonb_build_object('clase', r.nombre_clase, 'hora', to_char(r.hora_inicio, 'HH24:MI'), 'fecha', to_char(r.fecha, 'DD/MM')), 'agendada:' || r.id);
    update public.reservas set recordatorio_agendada_enviado_at = p_ahora where id = r.id;
    n := n + k; if k > 0 then det := public._sumar(det, r.tenant_id, k); end if;
  end loop;
  perform public._auto_log('reserva_agendada', t0, det, null); return n;
exception when others then perform public._auto_log('reserva_agendada', t0, det, sqlerrm); return -1;
end $$;

-- 3 · Confirmación de asistencia: pedido (hasta 24 h antes) y último aviso (justo antes del límite en que se libera el cupo) ------------
create or replace function public.auto_confirmacion_asistencia(p_ahora timestamptz default now(), p_tenant uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; k int; det jsonb := '{}'; t0 timestamptz := clock_timestamp(); v_ult boolean;
begin
  for r in select rs.id, rs.tenant_id, rs.cliente_id, rs.fecha, rs.confirmacion_enviada_at, rs.confirmacion_recordatorio_enviado, h.nombre_clase, h.hora_inicio,
        (rs.fecha + h.hora_inicio) as inicio, (p_ahora at time zone s.timezone) as ahora_s, coalesce(cr.horas_minimas_confirmacion, 1) as hmc
      from public.reservas rs join public.horarios h on h.id = rs.horario_id join public.sedes s on s.id = rs.sede_id
      left join public.configuracion_reservas cr on cr.tenant_id = rs.tenant_id
     where rs.estado = 'confirmada' and rs.tipo = 'regular' and rs.confirmada_por_clienta_at is null and h.activo and (p_tenant is null or rs.tenant_id = p_tenant)
       and (rs.fecha + h.hora_inicio) >  (p_ahora at time zone s.timezone)
       and (rs.fecha + h.hora_inicio) <= (p_ahora at time zone s.timezone) + interval '24 hours'
       and not exists (select 1 from public.horario_cancelaciones hc where hc.horario_id = h.id and hc.fecha = rs.fecha) loop
    if not public._auto_activa(r.tenant_id, 'confirmacion_asistencia') then continue; end if;
    v_ult := r.inicio <= r.ahora_s + ((r.hmc + 1) || ' hours')::interval;
    if not v_ult and r.confirmacion_enviada_at is null then
      k := public._encolar_auto(r.tenant_id, r.cliente_id, 'confirmar_asistencia', jsonb_build_object('clase', r.nombre_clase, 'hora', to_char(r.hora_inicio, 'HH24:MI'), 'fecha', to_char(r.fecha, 'DD/MM')), 'confirmar:' || r.id);
      update public.reservas set confirmacion_enviada_at = p_ahora where id = r.id;
      n := n + k; if k > 0 then det := public._sumar(det, r.tenant_id, k); end if;
    elsif v_ult and not r.confirmacion_recordatorio_enviado then
      k := public._encolar_auto(r.tenant_id, r.cliente_id, 'confirmar_asistencia_ultimo', jsonb_build_object('clase', r.nombre_clase, 'hora', to_char(r.hora_inicio, 'HH24:MI'), 'fecha', to_char(r.fecha, 'DD/MM')), 'confirmar_ultimo:' || r.id);
      update public.reservas set confirmacion_recordatorio_enviado = true, confirmacion_enviada_at = coalesce(confirmacion_enviada_at, p_ahora) where id = r.id;
      n := n + k; if k > 0 then det := public._sumar(det, r.tenant_id, k); end if;
    end if;
  end loop;
  perform public._auto_log('confirmacion_asistencia', t0, det, null); return n;
exception when others then perform public._auto_log('confirmacion_asistencia', t0, det, sqlerrm); return -1;
end $$;

-- 4 · Horario fijo: suele ir a este horario (3 de las últimas 4 semanas) y no ha reservado la próxima fecha ---------------------------
create or replace function public.auto_horario_fijo(p_ahora timestamptz default now(), p_tenant uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; k int; det jsonb := '{}'; t0 timestamptz := clock_timestamp(); v_ahora_s timestamp; v_inicio timestamp;
begin
  for r in
    with hist as (
      select rs.tenant_id, rs.cliente_id, rs.horario_id from public.reservas rs
        join public.horarios h on h.id = rs.horario_id and h.fecha_especifica is null and h.activo join public.sedes s on s.id = h.sede_id
       where rs.estado = 'confirmada' and (p_tenant is null or rs.tenant_id = p_tenant)
         and rs.fecha >= (p_ahora at time zone s.timezone)::date - 28 and rs.fecha < (p_ahora at time zone s.timezone)::date
       group by 1, 2, 3 having count(distinct rs.fecha) >= 3),
    prox as (
      select hs.*, h.nombre_clase, h.hora_inicio, s.timezone,
             (p_ahora at time zone s.timezone)::date + ((h.dia_semana - extract(dow from (p_ahora at time zone s.timezone)::date)::int + 7) % 7) as f0
        from hist hs join public.horarios h on h.id = hs.horario_id join public.sedes s on s.id = h.sede_id)
    select pr.*, case when (pr.f0 + pr.hora_inicio) > (p_ahora at time zone pr.timezone) then pr.f0 else pr.f0 + 7 end as fecha_prox from prox pr loop
    if not public._auto_activa(r.tenant_id, 'horario_fijo') then continue; end if;
    v_ahora_s := p_ahora at time zone r.timezone; v_inicio := r.fecha_prox + r.hora_inicio;
    if v_inicio <= v_ahora_s + interval '12 hours' or v_inicio > v_ahora_s + interval '36 hours' then continue; end if;
    if exists (select 1 from public.reservas x where x.cliente_id = r.cliente_id and x.horario_id = r.horario_id and x.fecha = r.fecha_prox and x.estado = 'confirmada') then continue; end if;
    if exists (select 1 from public.horario_cancelaciones hc where hc.horario_id = r.horario_id and hc.fecha = r.fecha_prox) then continue; end if;
    if not exists (select 1 from public.membresias m where m.cliente_id = r.cliente_id and m.estado = 'activa' and (m.fecha_vencimiento is null or m.fecha_vencimiento >= r.fecha_prox)
                   and (m.clases_totales is null or m.clases_usadas < m.clases_totales)) then continue; end if;
    k := public._encolar_auto(r.tenant_id, r.cliente_id, 'horario_fijo', jsonb_build_object('clase', r.nombre_clase, 'hora', to_char(r.hora_inicio, 'HH24:MI'), 'fecha', to_char(r.fecha_prox, 'DD/MM')),
         'fijo:' || r.cliente_id || ':' || r.horario_id || ':' || r.fecha_prox);
    n := n + k; if k > 0 then det := public._sumar(det, r.tenant_id, k); end if;
  end loop;
  perform public._auto_log('horario_fijo', t0, det, null); return n;
exception when others then perform public._auto_log('horario_fijo', t0, det, sqlerrm); return -1;
end $$;

-- 5 · Aviso de inasistencia ---------------------------------------------------------------------------------------------------
create or replace function public.auto_aviso_inasistencia(p_ahora timestamptz default now(), p_tenant uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; k int; det jsonb := '{}'; t0 timestamptz := clock_timestamp();
begin
  for r in select rs.id, rs.tenant_id, rs.cliente_id, rs.fecha, h.nombre_clase, h.hora_inicio
      from public.reservas rs join public.horarios h on h.id = rs.horario_id join public.sedes s on s.id = rs.sede_id
     where rs.estado = 'confirmada' and rs.asistio is false and (p_tenant is null or rs.tenant_id = p_tenant)
       and rs.fecha >= (p_ahora at time zone s.timezone)::date - 1 and (rs.fecha + h.hora_fin) <= (p_ahora at time zone s.timezone) loop
    if not public._auto_activa(r.tenant_id, 'aviso_inasistencia') then continue; end if;
    k := public._encolar_auto(r.tenant_id, r.cliente_id, 'inasistencia', jsonb_build_object('clase', r.nombre_clase, 'hora', to_char(r.hora_inicio, 'HH24:MI'), 'fecha', to_char(r.fecha, 'DD/MM')), 'noshow:' || r.id);
    n := n + k; if k > 0 then det := public._sumar(det, r.tenant_id, k); end if;
  end loop;
  perform public._auto_log('aviso_inasistencia', t0, det, null); return n;
exception when others then perform public._auto_log('aviso_inasistencia', t0, det, sqlerrm); return -1;
end $$;

-- 6 · Aviso de asistencia confirmada ------------------------------------------------------------------------------------------------
create or replace function public.auto_aviso_asistencia(p_ahora timestamptz default now(), p_tenant uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; k int; det jsonb := '{}'; t0 timestamptz := clock_timestamp(); v_rest text;
begin
  for r in select rs.id, rs.tenant_id, rs.cliente_id, rs.fecha, rs.membresia_id, h.nombre_clase, h.hora_inicio
      from public.reservas rs join public.horarios h on h.id = rs.horario_id join public.sedes s on s.id = rs.sede_id
     where rs.estado = 'confirmada' and rs.asistio is true and not rs.asistencia_notificada and (p_tenant is null or rs.tenant_id = p_tenant)
       and rs.fecha >= (p_ahora at time zone s.timezone)::date - 2 loop
    if not public._auto_activa(r.tenant_id, 'aviso_asistencia') then continue; end if;
    select case when m.clases_totales is null then 'ilimitadas' else greatest(m.clases_totales - m.clases_usadas, 0)::text end into v_rest from public.membresias m where m.id = r.membresia_id;
    k := public._encolar_auto(r.tenant_id, r.cliente_id, 'asistencia_confirmada', jsonb_build_object('clase', r.nombre_clase, 'hora', to_char(r.hora_inicio, 'HH24:MI'), 'fecha', to_char(r.fecha, 'DD/MM'), 'restantes', coalesce(v_rest, '—')), 'asistio:' || r.id);
    update public.reservas set asistencia_notificada = true where id = r.id;
    n := n + k; if k > 0 then det := public._sumar(det, r.tenant_id, k); end if;
  end loop;
  perform public._auto_log('aviso_asistencia', t0, det, null); return n;
exception when others then perform public._auto_log('aviso_asistencia', t0, det, sqlerrm); return -1;
end $$;

-- 7 · Avisos operativos a la instructora: clase por comenzar (15 min) y clase terminada (marcar asistencia) --------------------------------
create or replace function public.auto_avisos_operativos(p_ahora timestamptz default now(), p_tenant uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; k int; det jsonb := '{}'; t0 timestamptz := clock_timestamp(); v_tipo text; v_ins int; v_email text; v_res int; v_hoy date; v_ahora_s timestamp;
begin
  for r in select h.id, h.tenant_id, h.nombre_clase, h.hora_inicio, h.hora_fin, h.instructor_membership_id, h.fecha_especifica, h.dia_semana, s.timezone
      from public.horarios h join public.sedes s on s.id = h.sede_id
     where h.activo and h.instructor_membership_id is not null and (p_tenant is null or h.tenant_id = p_tenant) loop
    if not public._auto_activa(r.tenant_id, 'avisos_operativos') then continue; end if;
    v_ahora_s := p_ahora at time zone r.timezone; v_hoy := v_ahora_s::date;
    if not ((r.fecha_especifica = v_hoy) or (r.fecha_especifica is null and r.dia_semana = extract(dow from v_hoy)::int)) then continue; end if;
    if exists (select 1 from public.horario_cancelaciones hc where hc.horario_id = r.id and hc.fecha = v_hoy) then continue; end if;
    select count(*) into v_res from public.reservas x where x.horario_id = r.id and x.fecha = v_hoy and x.estado = 'confirmada';
    if v_res = 0 then continue; end if;
    v_tipo := case when (v_hoy + r.hora_inicio) between v_ahora_s and v_ahora_s + interval '15 minutes' then 'inicio'
                   when (v_hoy + r.hora_fin) between v_ahora_s - interval '20 minutes' and v_ahora_s then 'fin' end;
    if v_tipo is null then continue; end if;
    insert into public.avisos_operativos_enviados (tenant_id, horario_id, fecha, tipo) values (r.tenant_id, r.id, v_hoy, v_tipo) on conflict do nothing;
    get diagnostics v_ins = row_count;
    if v_ins = 0 then continue; end if;
    select lower(u.email) into v_email from public.tenant_memberships m join auth.users u on u.id = m.user_id where m.id = r.instructor_membership_id;
    if v_email is null then continue; end if;
    k := public._encolar_equipo(r.tenant_id, array[v_email],
      case v_tipo when 'inicio' then 'Tu clase de ' || r.nombre_clase || ' empieza pronto' else 'Terminó ' || r.nombre_clase || ': marca la asistencia' end,
      case v_tipo when 'inicio' then format('Tu clase de %s empieza a las %s con %s reservas confirmadas.', r.nombre_clase, to_char(r.hora_inicio, 'HH24:MI'), v_res)
                  else format('La clase de %s terminó. Marca quién asistió (%s reservas) para que los reportes y los paquetes queden al día.', r.nombre_clase, v_res) end,
      'op:' || r.id || ':' || v_hoy || ':' || v_tipo);
    n := n + k; if k > 0 then det := public._sumar(det, r.tenant_id, k); end if;
  end loop;
  perform public._auto_log('avisos_operativos', t0, det, null); return n;
exception when others then perform public._auto_log('avisos_operativos', t0, det, sqlerrm); return -1;
end $$;

-- 8 · Liberar cupos no confirmados (envuelve la función existente y avisa a la clienta) y lista de espera vencida -------------------------
create or replace function public.auto_liberar_cupos() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; k int; det jsonb := '{}'; t0 timestamptz := clock_timestamp(); v_cli uuid;
begin
  for r in select * from public.liberar_cupos_no_confirmados() loop
    select cliente_id into v_cli from public.reservas where id = r.reserva_id;
    k := public._encolar_auto(r.tenant_id, v_cli, 'cupo_liberado', jsonb_build_object('clase', r.nombre_clase, 'hora', to_char(r.hora_inicio, 'HH24:MI'), 'fecha', to_char(r.fecha, 'DD/MM')), 'liberada:' || r.reserva_id);
    n := n + 1; det := public._sumar(det, r.tenant_id, 1);
  end loop;
  perform public._auto_log('liberar_cupos', t0, det, null); return n;
exception when others then perform public._auto_log('liberar_cupos', t0, det, sqlerrm); return -1;
end $$;
create or replace function public.auto_lista_espera_vencida() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; det jsonb := '{}'; t0 timestamptz := clock_timestamp();
begin
  for r in select * from public.lista_espera_vencida() loop n := n + 1; det := public._sumar(det, r.tenant_id, 1); end loop;
  perform public._auto_log('lista_espera_vencida', t0, det, null); return n;
exception when others then perform public._auto_log('lista_espera_vencida', t0, det, sqlerrm); return -1;
end $$;

-- 9 · Reconciliación de pagos en línea: los «iniciado» de más de 2 horas pasan a revisión (sin llamar a ningún proveedor) ------------------
create or replace function public.auto_reconciliar_pagos(p_ahora timestamptz default now(), p_tenant uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; k int; det jsonb := '{}'; t0 timestamptz := clock_timestamp();
begin
  for r in select distinct t.tenant_id from public.pago_transacciones t where t.estado = 'iniciado' and t.created_at < p_ahora - interval '2 hours' and (p_tenant is null or t.tenant_id = p_tenant) loop
    if not public._auto_activa(r.tenant_id, 'reconciliar_pagos') then continue; end if;
    with u as (update public.pago_transacciones set estado = 'revision', actualizado_at = p_ahora,
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('reconciliacion', jsonb_build_object('marcado_at', p_ahora, 'motivo', 'Sin confirmación del proveedor tras 2 horas'))
      where tenant_id = r.tenant_id and estado = 'iniciado' and created_at < p_ahora - interval '2 hours' returning 1)
    select count(*) into k from u;
    n := n + k; if k > 0 then det := public._sumar(det, r.tenant_id, k); end if;
  end loop;
  perform public._auto_log('reconciliar_pagos', t0, det, null); return n;
exception when others then perform public._auto_log('reconciliar_pagos', t0, det, sqlerrm); return -1;
end $$;

-- 10 · Salud del sistema, por estudio, a las 8 a. m. de su sede ---------------------------------------------------------------------------
create or replace function public.auto_salud_sistema(p_ahora timestamptz default now(), p_tenant uuid default null, p_forzar boolean default false) returns int
language plpgsql security definer set search_path = public as $$
declare t record; n int := 0; k int; det jsonb := '{}'; t0 timestamptz := clock_timestamp(); v_fecha date; v_res jsonb; v_prob int; c jsonb; v_cuerpo text; v_nom text;
  chequeos text[] := array['reservas_duplicadas','reservas_fecha_invalida','membresias_excedidas','inventario_negativo','pagos_sin_resolver','cupos_excedidos'];
  etiquetas text[] := array['Reservas duplicadas','Reservas con fecha inválida','Paquetes con más clases usadas que las que tienen','Inventario negativo','Pagos en línea sin resolver (más de 24 h)','Clases con más reservas que cupo'];
  i int;
begin
  for t in select id, name from public.tenants where (p_tenant is null or id = p_tenant) loop
    if not public._auto_activa(t.id, 'salud_sistema') then continue; end if;
    if not p_forzar and public._hora_local(t.id, p_ahora) <> 8 then continue; end if;
    v_fecha := public._fecha_local(t.id, p_ahora);
    if not p_forzar and exists (select 1 from public.salud_chequeos where tenant_id = t.id and fecha_local = v_fecha) then continue; end if;
    v_res := '{}'::jsonb;
    with q as (select cliente_id, horario_id, fecha, count(*) veces from public.reservas where tenant_id = t.id and estado = 'confirmada' group by 1, 2, 3 having count(*) > 1)
      select jsonb_build_object('n', (select count(*) from q), 'ejemplos', coalesce((select jsonb_agg(to_jsonb(x)) from (select * from q limit 5) x), '[]'::jsonb)) into c;
    v_res := v_res || jsonb_build_object('reservas_duplicadas', c);
    with q as (select rs.id, rs.fecha from public.reservas rs join public.horarios h on h.id = rs.horario_id where rs.tenant_id = t.id and rs.estado = 'confirmada'
        and (rs.fecha < date '2020-01-01' or rs.fecha > v_fecha + 400 or (h.fecha_especifica is null and extract(dow from rs.fecha)::int <> h.dia_semana) or (h.fecha_especifica is not null and rs.fecha <> h.fecha_especifica)))
      select jsonb_build_object('n', (select count(*) from q), 'ejemplos', coalesce((select jsonb_agg(to_jsonb(x)) from (select * from q limit 5) x), '[]'::jsonb)) into c;
    v_res := v_res || jsonb_build_object('reservas_fecha_invalida', c);
    with q as (select id, clases_totales, clases_usadas from public.membresias where tenant_id = t.id and estado = 'activa' and clases_totales is not null and clases_usadas > clases_totales)
      select jsonb_build_object('n', (select count(*) from q), 'ejemplos', coalesce((select jsonb_agg(to_jsonb(x)) from (select * from q limit 5) x), '[]'::jsonb)) into c;
    v_res := v_res || jsonb_build_object('membresias_excedidas', c);
    with q as (select id, stock from public.producto_variantes where tenant_id = t.id and stock < 0)
      select jsonb_build_object('n', (select count(*) from q), 'ejemplos', coalesce((select jsonb_agg(to_jsonb(x)) from (select * from q limit 5) x), '[]'::jsonb)) into c;
    v_res := v_res || jsonb_build_object('inventario_negativo', c);
    with q as (select id, estado, created_at from public.pago_transacciones where tenant_id = t.id and estado in ('iniciado','revision') and created_at < p_ahora - interval '24 hours')
      select jsonb_build_object('n', (select count(*) from q), 'ejemplos', coalesce((select jsonb_agg(to_jsonb(x)) from (select * from q limit 5) x), '[]'::jsonb)) into c;
    v_res := v_res || jsonb_build_object('pagos_sin_resolver', c);
    with q as (select rs.horario_id, rs.fecha, count(*) reservas, h.cupo_maximo from public.reservas rs join public.horarios h on h.id = rs.horario_id
        where rs.tenant_id = t.id and rs.estado = 'confirmada' group by rs.horario_id, rs.fecha, h.cupo_maximo having count(*) > h.cupo_maximo)
      select jsonb_build_object('n', (select count(*) from q), 'ejemplos', coalesce((select jsonb_agg(to_jsonb(x)) from (select * from q limit 5) x), '[]'::jsonb)) into c;
    v_res := v_res || jsonb_build_object('cupos_excedidos', c);
    v_prob := (select coalesce(sum((value->>'n')::int), 0) from jsonb_each(v_res));
    insert into public.salud_chequeos (tenant_id, fecha_local, ejecutado_at, problemas, resultados) values (t.id, v_fecha, p_ahora, v_prob, v_res)
      on conflict (tenant_id, fecha_local) do update set ejecutado_at = excluded.ejecutado_at, problemas = excluded.problemas, resultados = excluded.resultados;
    if v_prob > 0 then
      v_cuerpo := 'Revisión diaria de ' || t.name || E':\n';
      for i in 1..array_length(chequeos, 1) loop
        if (v_res->chequeos[i]->>'n')::int > 0 then v_cuerpo := v_cuerpo || '• ' || etiquetas[i] || ': ' || (v_res->chequeos[i]->>'n') || E'\n'; end if;
      end loop;
      k := public._encolar_equipo(t.id, public._emails_duenas(t.id), 'Salud del sistema: ' || v_prob || ' cosa(s) por revisar', v_cuerpo || 'Revisa el detalle en Automatizaciones.', 'salud:' || t.id || ':' || v_fecha);
      n := n + k; if k > 0 then det := public._sumar(det, t.id, k); end if;
    end if;
  end loop;
  perform public._auto_log('salud_sistema', t0, det, null); return n;
exception when others then perform public._auto_log('salud_sistema', t0, det, sqlerrm); return -1;
end $$;

-- 11 · Paquetes por vencer (3 días, según el día de la sede) ------------------------------------------------------------------------------
create or replace function public.auto_paquetes_por_vencer(p_ahora timestamptz default now(), p_tenant uuid default null, p_forzar boolean default false) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; k int; det jsonb := '{}'; t0 timestamptz := clock_timestamp();
begin
  for r in select m.id, m.tenant_id, m.cliente_id, m.fecha_vencimiento, p.nombre as paquete from public.membresias m join public.paquetes p on p.id = m.paquete_id
     where m.estado = 'activa' and m.fecha_vencimiento is not null and (p_tenant is null or m.tenant_id = p_tenant)
       and m.fecha_vencimiento = public._fecha_local(m.tenant_id, p_ahora) + 3 loop
    if not public._auto_activa(r.tenant_id, 'paquetes_por_vencer') then continue; end if;
    if not p_forzar and public._hora_local(r.tenant_id, p_ahora) <> 9 then continue; end if;
    k := public._encolar_auto(r.tenant_id, r.cliente_id, 'paquete_por_vencer', jsonb_build_object('paquete', r.paquete, 'vence', to_char(r.fecha_vencimiento, 'DD/MM')), 'vence:' || r.id);
    update public.membresias set recordatorio_vencimiento_enviado = true where id = r.id;
    n := n + k; if k > 0 then det := public._sumar(det, r.tenant_id, k); end if;
  end loop;
  perform public._auto_log('paquetes_por_vencer', t0, det, null); return n;
exception when others then perform public._auto_log('paquetes_por_vencer', t0, det, sqlerrm); return -1;
end $$;
create or replace function public.encolar_recordatorios() returns integer language sql security definer set search_path = public as $$ select public.auto_paquetes_por_vencer(now(), null, true) $$;

-- 12 · Clientas inactivas: paquete activo y 14 días o más sin venir (ni tener reserva próxima); máximo un aviso cada 30 días -------------------
create or replace function public.auto_clientas_inactivas(p_ahora timestamptz default now(), p_tenant uuid default null, p_forzar boolean default false) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; k int; det jsonb := '{}'; t0 timestamptz := clock_timestamp(); v_hoy date;
begin
  for r in select c.id as cliente_id, c.tenant_id, m.id as membresia_id from public.clientes c
      join lateral (select x.id from public.membresias x where x.cliente_id = c.id and x.estado = 'activa'
          and (x.fecha_vencimiento is null or x.fecha_vencimiento >= public._fecha_local(c.tenant_id, p_ahora))
          and (x.recordatorio_inactividad_enviado_at is null or x.recordatorio_inactividad_enviado_at < p_ahora - interval '30 days') order by x.fecha_vencimiento nulls last limit 1) m on true
     where (p_tenant is null or c.tenant_id = p_tenant) and not coalesce(c.es_mostrador, false)
       and exists (select 1 from public.reservas h where h.cliente_id = c.id and h.asistio is true)
       and not exists (select 1 from public.reservas h where h.cliente_id = c.id and h.estado = 'confirmada' and h.fecha >= public._fecha_local(c.tenant_id, p_ahora) - 14) loop
    if not public._auto_activa(r.tenant_id, 'clientas_inactivas') then continue; end if;
    if not p_forzar and public._hora_local(r.tenant_id, p_ahora) <> 10 then continue; end if;
    v_hoy := public._fecha_local(r.tenant_id, p_ahora);
    k := public._encolar_auto(r.tenant_id, r.cliente_id, 'te_extrañamos', '{}'::jsonb, 'inactiva:' || r.cliente_id || ':' || v_hoy);
    update public.membresias set recordatorio_inactividad_enviado_at = p_ahora where id = r.membresia_id;
    n := n + k; if k > 0 then det := public._sumar(det, r.tenant_id, k); end if;
  end loop;
  perform public._auto_log('clientas_inactivas', t0, det, null); return n;
exception when others then perform public._auto_log('clientas_inactivas', t0, det, sqlerrm); return -1;
end $$;

-- 13 · Cuentas sin contraseña: alta hecha por el estudio, invitación sin usar hace más de un día; un recordatorio por semana --------------------
create or replace function public.auto_cuentas_sin_password(p_ahora timestamptz default now(), p_tenant uuid default null, p_forzar boolean default false) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; k int; det jsonb := '{}'; t0 timestamptz := clock_timestamp();
begin
  for r in select c.id as cliente_id, c.tenant_id, i.token from public.clientes c
      join lateral (select x.token from public.invitaciones_clienta x where x.cliente_id = c.id and not x.usado and x.created_at < p_ahora - interval '1 day' order by x.created_at desc limit 1) i on true
     where c.user_id is null and (p_tenant is null or c.tenant_id = p_tenant) and nullif(trim(coalesce(c.email,'')),'') is not null
       and (c.recordatorio_password_enviado_at is null or c.recordatorio_password_enviado_at < p_ahora - interval '7 days') loop
    if not public._auto_activa(r.tenant_id, 'cuentas_sin_password') then continue; end if;
    if not p_forzar and public._hora_local(r.tenant_id, p_ahora) <> 11 then continue; end if;
    k := public._encolar_auto(r.tenant_id, r.cliente_id, 'cuenta_sin_password', jsonb_build_object('enlace', 'https://reserveos.app/invitar/clienta/' || r.token), 'pass:' || r.cliente_id || ':' || public._fecha_local(r.tenant_id, p_ahora));
    update public.clientes set recordatorio_password_enviado_at = p_ahora where id = r.cliente_id;
    n := n + k; if k > 0 then det := public._sumar(det, r.tenant_id, k); end if;
  end loop;
  perform public._auto_log('cuentas_sin_password', t0, det, null); return n;
exception when others then perform public._auto_log('cuentas_sin_password', t0, det, sqlerrm); return -1;
end $$;

-- 14 · Análisis semanal: lunes 7 a. m. de la sede, cómo cerró la semana y cómo arranca la siguiente -----------------------------------------
create or replace function public.auto_analisis_semanal(p_ahora timestamptz default now(), p_tenant uuid default null, p_forzar boolean default false) returns int
language plpgsql security definer set search_path = public as $$
declare t record; n int := 0; k int; det jsonb := '{}'; t0 timestamptz := clock_timestamp(); v_hoy date; v_ini date; v_fin date; v_conf int; v_asis int; v_no int; v_sin int; v_ing numeric; v_nuevas int; v_prox int; v_vencen int; v_prob int; v_cuerpo text;
begin
  for t in select id, name from public.tenants where (p_tenant is null or id = p_tenant) loop
    if not public._auto_activa(t.id, 'analisis_semanal') then continue; end if;
    v_hoy := public._fecha_local(t.id, p_ahora);
    if not p_forzar and (extract(dow from v_hoy)::int <> 1 or public._hora_local(t.id, p_ahora) <> 7) then continue; end if;
    v_fin := v_hoy - (case when extract(dow from v_hoy)::int = 0 then 7 else extract(dow from v_hoy)::int end) + 0;  -- domingo anterior (o el mismo día si p_forzar un domingo)
    v_fin := v_hoy - ((extract(dow from v_hoy)::int + 6) % 7) - 1; v_ini := v_fin - 6;
    select count(*) filter (where estado = 'confirmada'), count(*) filter (where estado = 'confirmada' and asistio is true), count(*) filter (where estado = 'confirmada' and asistio is false),
           count(*) filter (where estado = 'confirmada' and asistio is null) into v_conf, v_asis, v_no, v_sin from public.reservas where tenant_id = t.id and fecha between v_ini and v_fin;
    select coalesce(sum(precio_final), 0) into v_ing from public.membresias where tenant_id = t.id and pagada and estado <> 'anulada'
      and (coalesce(confirmado_at, created_at) at time zone public._tenant_tz(t.id))::date between v_ini and v_fin;
    select count(*) into v_nuevas from public.clientes where tenant_id = t.id and (created_at at time zone public._tenant_tz(t.id))::date between v_ini and v_fin;
    select count(*) into v_prox from public.reservas where tenant_id = t.id and estado = 'confirmada' and fecha between v_hoy and v_hoy + 6;
    select count(*) into v_vencen from public.membresias where tenant_id = t.id and estado = 'activa' and fecha_vencimiento between v_hoy and v_hoy + 6;
    select coalesce(problemas, 0) into v_prob from public.salud_chequeos where tenant_id = t.id order by fecha_local desc limit 1;
    v_cuerpo := format(E'Resumen de la semana del %s al %s de %s\n\nCómo cerró:\n• Reservas confirmadas: %s\n• Asistieron: %s · No vinieron: %s · Sin marcar: %s\n• Asistencia: %s%%\n• Paquetes cobrados: Q%s\n• Clientas nuevas: %s\n\nCómo arranca:\n• Reservas ya confirmadas esta semana: %s\n• Paquetes que vencen esta semana: %s\n• Último chequeo de salud: %s',
      to_char(v_ini, 'DD/MM'), to_char(v_fin, 'DD/MM'), t.name, v_conf, v_asis, v_no, v_sin, case when v_asis + v_no > 0 then round(100.0 * v_asis / (v_asis + v_no)) else 0 end, to_char(v_ing, 'FM999,999,990.00'), v_nuevas, v_prox, v_vencen,
      case when v_prob is null then 'sin datos' when v_prob = 0 then 'todo en orden' else v_prob || ' cosa(s) por revisar' end);
    k := public._encolar_equipo(t.id, public._emails_duenas(t.id), 'Tu semana en ' || t.name, v_cuerpo, 'semanal:' || t.id || ':' || v_hoy);
    n := n + k; if k > 0 then det := public._sumar(det, t.id, k); end if;
  end loop;
  perform public._auto_log('analisis_semanal', t0, det, null); return n;
exception when others then perform public._auto_log('analisis_semanal', t0, det, sqlerrm); return -1;
end $$;

-- Ninguna de estas funciones es para el navegador: solo las ejecutan pg_cron (postgres) y las pruebas.
do $$ declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'public'::regnamespace and (p.proname like 'auto\_%' or p.proname in ('_auto_log','_auto_activa','_encolar_auto','_encolar_equipo','_emails_duenas','_asegurar_plantilla_auto','_tenant_tz','_hora_local','_fecha_local','_sumar','encolar_recordatorios')) loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;
