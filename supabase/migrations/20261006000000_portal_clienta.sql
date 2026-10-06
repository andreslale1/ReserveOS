-- WEB-02 / WEB-03: portal de la clienta. Una identidad con varios contextos (estudios) y reglas de elegibilidad
-- explicadas: la app dice POR QUÉ una clase no se puede reservar (sede no cubierta, sin créditos, llena, cerrada…).

create or replace function public.mis_contextos()
returns table(tenant_id uuid, estudio text, slug text, es_clienta boolean, cliente_id uuid, rol_staff text)
language sql stable security definer set search_path to 'public' as $$
  select t.id, t.name, t.slug,
    exists (select 1 from public.clientes c where c.user_id = auth.uid() and c.tenant_id = t.id),
    (select c.id from public.clientes c where c.user_id = auth.uid() and c.tenant_id = t.id limit 1),
    (select m.role from public.tenant_memberships m where m.user_id = auth.uid() and m.tenant_id = t.id limit 1)
  from public.tenants t
  where t.id in (select c.tenant_id from public.clientes c where c.user_id = auth.uid())
     or t.id in (select m.tenant_id from public.tenant_memberships m where m.user_id = auth.uid())
  order by t.name;
$$;
revoke all on function public.mis_contextos() from public;
grant execute on function public.mis_contextos() to authenticated;

-- ¿Puede esta clienta (o su dependiente) reservar esta clase? Siempre devuelve una razón entendible.
create or replace function public.elegibilidad_clase(p_horario_id uuid, p_fecha date, p_cliente_id uuid default null)
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare
  h record; v_propio uuid; v_cli uuid; v_cfg record; v_inicio timestamp; v_ocup int; v_cupo int; v_m record; v_tutor uuid;
  v_hay_activa boolean; v_pend boolean; v_cubre_sedes text; v_en_espera boolean; v_mod_espera boolean;
begin
  select * into h from public.horarios where id = p_horario_id and activo;
  if h is null then return json_build_object('puede', false, 'codigo', 'no_existe', 'motivo', 'Esa clase ya no está disponible.'); end if;
  v_propio := public.mi_cliente_id(h.tenant_id);
  v_cli := coalesce(p_cliente_id, v_propio);
  if v_propio is null or v_cli is null or (v_cli <> v_propio and not exists (select 1 from public.clientes where id = v_cli and tutor_id = v_propio and tenant_id = h.tenant_id)) then
    return json_build_object('puede', false, 'codigo', 'no_autorizado', 'motivo', 'No tienes acceso a esta clase.');
  end if;
  if not public._fecha_coincide_horario(p_horario_id, p_fecha) then return json_build_object('puede', false, 'codigo', 'fecha_invalida', 'motivo', 'Esa fecha no corresponde a esa clase.'); end if;
  if exists (select 1 from public.horario_cancelaciones where horario_id = p_horario_id and fecha = p_fecha) then
    return json_build_object('puede', false, 'codigo', 'clase_cancelada', 'motivo', 'Esta clase fue cancelada ese día.'); end if;
  if exists (select 1 from public.sede_cierres c where c.tenant_id = h.tenant_id and (c.sede_id is null or c.sede_id = h.sede_id) and p_fecha between c.desde and c.hasta) then
    return json_build_object('puede', false, 'codigo', 'sede_cerrada', 'motivo', 'La sede está cerrada ese día.'); end if;
  if exists (select 1 from public.horario_fechas_privadas where horario_id = p_horario_id and fecha = p_fecha) then
    return json_build_object('puede', false, 'codigo', 'clase_privada', 'motivo', 'Esa fecha es una clase privada.'); end if;
  v_inicio := p_fecha + h.hora_inicio;
  if v_inicio <= public.ahora_en_sede(h.sede_id) then return json_build_object('puede', false, 'codigo', 'ya_empezo', 'motivo', 'La clase ya empezó o terminó.'); end if;
  if exists (select 1 from public.reservas where cliente_id = v_cli and horario_id = p_horario_id and fecha = p_fecha and estado = 'confirmada') then
    return json_build_object('puede', false, 'codigo', 'ya_reservada', 'motivo', 'Ya tienes lugar en esta clase.'); end if;
  select * into v_cfg from public.configuracion_reservas where tenant_id = h.tenant_id;
  if v_cfg.anticipacion_maxima_dias is not null and p_fecha > public.hoy_en_sede(h.sede_id) + v_cfg.anticipacion_maxima_dias then
    return json_build_object('puede', false, 'codigo', 'muy_adelante', 'motivo', format('Puedes reservar con hasta %s días de anticipación.', v_cfg.anticipacion_maxima_dias)); end if;
  if v_cfg.max_reservas_dia_por_clienta is not null and (select count(*) from public.reservas where cliente_id = v_cli and fecha = p_fecha and estado = 'confirmada' and tipo = 'regular') >= v_cfg.max_reservas_dia_por_clienta then
    return json_build_object('puede', false, 'codigo', 'tope_diario', 'motivo', format('Ya alcanzaste el máximo de %s clase(s) por día.', v_cfg.max_reservas_dia_por_clienta)); end if;

  -- Paquete: vigente, con créditos y que cubra esta sede.
  select m.id into v_m from public.membresias m where m.cliente_id = v_cli and m.estado = 'activa' and m.congelada_desde is null
    and m.fecha_vencimiento >= p_fecha and (m.clases_totales is null or m.clases_usadas < m.clases_totales) and public.membresia_cubre_sede(m.id, h.sede_id) limit 1;
  if v_m.id is null then
    select coalesce(tutor_id, id) into v_tutor from public.clientes where id = v_cli;
    select m.id into v_m from public.membresias m join public.paquetes pq on pq.id = m.paquete_id
      where m.cliente_id = v_tutor and pq.compartido_familiar and m.estado = 'activa' and m.congelada_desde is null and m.fecha_vencimiento >= p_fecha
        and (m.clases_totales is null or m.clases_usadas < m.clases_totales) and public.membresia_cubre_sede(m.id, h.sede_id) limit 1;
  end if;
  if v_m.id is null then
    select exists (select 1 from public.membresias where cliente_id = v_cli and estado = 'activa') into v_hay_activa;
    select exists (select 1 from public.membresias where cliente_id = v_cli and estado = 'pendiente_pago') into v_pend;
    if v_hay_activa then
      if exists (select 1 from public.membresias where cliente_id = v_cli and estado = 'activa' and congelada_desde is not null) and not exists (select 1 from public.membresias where cliente_id = v_cli and estado = 'activa' and congelada_desde is null) then
        return json_build_object('puede', false, 'codigo', 'congelada', 'motivo', 'Tu paquete está congelado. Pide que lo reactiven.');
      end if;
      if exists (select 1 from public.membresias m where m.cliente_id = v_cli and m.estado = 'activa' and m.fecha_vencimiento < p_fecha) and not exists (select 1 from public.membresias m where m.cliente_id = v_cli and m.estado = 'activa' and m.fecha_vencimiento >= p_fecha) then
        return json_build_object('puede', false, 'codigo', 'vencido', 'motivo', 'Tu paquete vence antes de esa fecha. Puedes renovarlo.');
      end if;
      if exists (select 1 from public.membresias m where m.cliente_id = v_cli and m.estado = 'activa' and m.fecha_vencimiento >= p_fecha and public.membresia_cubre_sede(m.id, h.sede_id)) then
        return json_build_object('puede', false, 'codigo', 'sin_creditos', 'motivo', 'Ya usaste todas las clases de tu paquete. Puedes comprar otro.');
      end if;
      select string_agg(distinct s.name, ', ') into v_cubre_sedes from public.membresias m join public.membresia_sedes ms on ms.membresia_id = m.id join public.sedes s on s.id = ms.sede_id
        where m.cliente_id = v_cli and m.estado = 'activa';
      return json_build_object('puede', false, 'codigo', 'no_cubre_sede',
        'motivo', 'Tu paquete no incluye esta sede' || coalesce(' (cubre: ' || v_cubre_sedes || ')', '') || '. Puedes comprar uno que la incluya.');
    end if;
    if v_pend then return json_build_object('puede', false, 'codigo', 'pago_pendiente', 'motivo', 'Tu pago está pendiente de confirmación. En cuanto lo aprueben podrás reservar.'); end if;
    return json_build_object('puede', false, 'codigo', 'sin_paquete', 'motivo', 'Necesitas un paquete para reservar. Elige uno en Paquetes.');
  end if;

  -- Cupo
  v_cupo := h.cupo_maximo;
  select count(*) into v_ocup from public.reservas where horario_id = p_horario_id and fecha = p_fecha and estado = 'confirmada';
  if v_ocup >= v_cupo then
    select exists (select 1 from public.lista_espera where horario_id = p_horario_id and fecha = p_fecha and cliente_id = v_cli) into v_en_espera;
    v_mod_espera := public.modulo_activo(h.tenant_id, 'lista_espera');
    return json_build_object('puede', false, 'codigo', 'llena', 'puede_espera', v_mod_espera and not v_en_espera, 'en_espera', v_en_espera,
      'motivo', case when v_en_espera then 'Estás en la lista de espera de esta clase.' when v_mod_espera then 'La clase está llena. Puedes anotarte en la lista de espera.' else 'La clase está llena.' end);
  end if;
  return json_build_object('puede', true, 'codigo', 'ok', 'lugares', v_cupo - v_ocup);
end $$;
revoke all on function public.elegibilidad_clase(uuid, date, uuid) from public;
grant execute on function public.elegibilidad_clase(uuid, date, uuid) to authenticated;

-- Resumen de la clienta dentro de un estudio.
create or replace function public.mi_resumen(p_tenant_id uuid)
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare v_c record;
begin
  select * into v_c from public.clientes where user_id = auth.uid() and tenant_id = p_tenant_id limit 1;
  if v_c is null then return null; end if;
  return json_build_object(
    'cliente_id', v_c.id, 'nombre', v_c.nombre, 'telefono', v_c.telefono, 'email', v_c.email,
    'contacto_emergencia', v_c.contacto_emergencia, 'cuidados', v_c.cuidados_especiales,
    'consentimiento_pendiente', v_c.consentimiento_completado_at is null,
    'paquetes', coalesce((select json_agg(x order by x.vence) from (
        select m.id, p.nombre as paquete, m.estado, m.clases_totales as totales, m.clases_usadas as usadas, m.fecha_vencimiento as vence,
          m.congelada_desde is not null as congelada,
          (select string_agg(s.name, ', ' order by s.name) from public.membresia_sedes ms join public.sedes s on s.id = ms.sede_id where ms.membresia_id = m.id) as sedes,
          m.cobertura_tipo as cobertura
        from public.membresias m join public.paquetes p on p.id = m.paquete_id
        where m.cliente_id = v_c.id and m.estado in ('activa','pendiente_pago') order by m.fecha_vencimiento) x), '[]'::json),
    'proximas', coalesce((select json_agg(y order by y.fecha, y.hora) from (
        select r.id, r.fecha, h.hora_inicio as hora, h.nombre_clase as clase, s.name as sede, r.confirmada_por_clienta_at is not null as confirmada, c2.nombre as para
        from public.reservas r join public.horarios h on h.id = r.horario_id join public.sedes s on s.id = r.sede_id join public.clientes c2 on c2.id = r.cliente_id
        where (r.cliente_id = v_c.id or c2.tutor_id = v_c.id) and r.estado = 'confirmada' and r.fecha >= public.hoy_en_sede(r.sede_id)
        order by r.fecha, h.hora_inicio limit 20) y), '[]'::json)
  );
end $$;
revoke all on function public.mi_resumen(uuid) from public;
grant execute on function public.mi_resumen(uuid) to authenticated;

create or replace function public.actualizar_mi_perfil(p_tenant_id uuid, p_nombre text, p_telefono text, p_email text, p_contacto_emergencia text, p_cuidados text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  v_id := public.mi_cliente_id(p_tenant_id);
  if v_id is null then raise exception 'No autorizado'; end if;
  if p_nombre is null or length(trim(p_nombre)) < 2 then raise exception 'Escribe tu nombre'; end if;
  if length(public._tel_norm(p_telefono)) < 7 then raise exception 'Escribe un teléfono válido'; end if;
  if p_email is not null and length(trim(p_email)) > 0 and trim(p_email) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Correo no válido'; end if;
  if exists (select 1 from public.clientes c where c.tenant_id = p_tenant_id and c.id <> v_id and c.tutor_id is null and public._tel_norm(c.telefono) = public._tel_norm(p_telefono)) then
    raise exception 'Ese teléfono ya está registrado con otra clienta del estudio.';
  end if;
  update public.clientes set nombre = trim(p_nombre), telefono = trim(p_telefono), email = nullif(trim(coalesce(p_email,'')), ''),
    contacto_emergencia = nullif(trim(coalesce(p_contacto_emergencia,'')), ''), cuidados_especiales = nullif(trim(coalesce(p_cuidados,'')), '')
    where id = v_id;
end $$;
revoke all on function public.actualizar_mi_perfil(uuid, text, text, text, text, text) from public;
grant execute on function public.actualizar_mi_perfil(uuid, text, text, text, text, text) to authenticated;

-- Catálogo para comprar: paquetes activos con las sedes que cubren.
create or replace function public.catalogo_paquetes(p_tenant_id uuid)
returns table(id uuid, nombre text, descripcion text, num_clases integer, precio numeric, vigencia_dias integer, cobertura text, sedes text)
language sql stable security definer set search_path to 'public' as $$
  select p.id, p.nombre, p.descripcion, p.num_clases, p.precio, p.vigencia_dias, p.cobertura,
    case p.cobertura when 'todas' then 'Todas las sedes' else (select string_agg(s.name, ', ' order by s.name) from public.paquete_sedes ps join public.sedes s on s.id = ps.sede_id where ps.paquete_id = p.id) end
  from public.paquetes p
  where p.tenant_id = p_tenant_id and p.activo and p_tenant_id in (select c.tenant_id from public.clientes c where c.user_id = auth.uid())
  order by p.precio;
$$;
revoke all on function public.catalogo_paquetes(uuid) from public;
grant execute on function public.catalogo_paquetes(uuid) to authenticated;

-- Datos para transferir (solo a clientas del estudio).
create or replace function public.datos_transferencia(p_tenant_id uuid)
returns json language sql stable security definer set search_path to 'public' as $$
  select to_json(x) from (select banco, tipo_cuenta, numero_cuenta, titular from public.configuracion_pago
    where tenant_id = p_tenant_id and p_tenant_id in (select c.tenant_id from public.clientes c where c.user_id = auth.uid())) x;
$$;
revoke all on function public.datos_transferencia(uuid) from public;
grant execute on function public.datos_transferencia(uuid) to authenticated;
