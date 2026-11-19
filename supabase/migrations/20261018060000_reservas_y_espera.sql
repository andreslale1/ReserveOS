-- AUDITORÍA · tanda 2: reservas, créditos y lista de espera.
-- RES-03 (paquete privado no paga clases regulares), RES-04 (fecha de inicio), RES-05 (gracia sin vencidas), RES-07 (prueba),
-- RES-08 (clases simultáneas), RES-09 (reactivar una reserva reinicia sus datos), ESP-01 (cobertura de sede en la espera),
-- ESP-03 (un candidato inválido ya no impide cancelar), ESP-04 (módulo apagado), ESP-05 (crédito de la promoción), TEN-01 (estudio suspendido).
-- Misma técnica segura: se parchea el texto vivo de cada función y, si no se reconoce, la migración se detiene sin cambiar nada.

create or replace function public._parchear_funcion(p_nombre text, p_ancla text, p_nuevo text, p_marca text, p_esperadas integer default 1)
returns void language plpgsql as $$
declare v_oid oid; v_def text; v_n integer;
begin
  select p.oid into v_oid from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = p_nombre;
  if v_oid is null then raise exception 'Se detiene: no existe la función %', p_nombre; end if;
  v_def := pg_get_functiondef(v_oid);
  if position(p_marca in v_def) > 0 then return; end if;
  v_n := (length(v_def) - length(replace(v_def, p_ancla, ''))) / greatest(length(p_ancla), 1);
  if v_n <> p_esperadas then raise exception 'Se detiene: en % se esperaban % coincidencias y hay % (el texto cambió)', p_nombre, p_esperadas, v_n; end if;
  execute replace(v_def, p_ancla, p_nuevo);
end $$;

-- ───────── agendar_clase ─────────
-- RES-03/04: el derecho debe ser de clases regulares y estar vigente en la fecha de la clase.
select public._parchear_funcion('agendar_clase',
  'estado = ''activa'' and congelada_desde is null and fecha_vencimiento >= p_fecha',
  'estado = ''activa'' and congelada_desde is null and fecha_vencimiento >= p_fecha and (fecha_inicio is null or fecha_inicio <= p_fecha) and not exists (select 1 from public.paquetes pk where pk.id = membresias.paquete_id and pk.categoria = ''privado'')',
  'pk.id = membresias.paquete_id');
select public._parchear_funcion('agendar_clase',
  'and m.estado = ''activa'' and m.congelada_desde is null and m.fecha_vencimiento >= p_fecha',
  'and m.estado = ''activa'' and m.congelada_desde is null and m.fecha_vencimiento >= p_fecha and (m.fecha_inicio is null or m.fecha_inicio <= p_fecha) and pq.categoria <> ''privado''',
  'm.fecha_inicio <= p_fecha) and pq.categoria');
-- RES-05: la gracia por pago pendiente tampoco admite paquetes vencidos, no iniciados ni privados.
select public._parchear_funcion('agendar_clase',
  'estado = ''activa'' and pagada = false and congelada_desde is null',
  'estado = ''activa'' and pagada = false and congelada_desde is null and fecha_vencimiento >= p_fecha and (fecha_inicio is null or fecha_inicio <= p_fecha) and not exists (select 1 from public.paquetes pk2 where pk2.id = membresias.paquete_id and pk2.categoria = ''privado'')',
  'pk2.id = membresias.paquete_id');
-- RES-09: reactivar una reserva reinicia asistencia, penalización, liberaciones y confirmaciones del intento anterior.
select public._parchear_funcion('agendar_clase',
  'update public.reservas set estado = ''confirmada'', tipo = ''regular'' where id = v_reserva_id;',
  'update public.reservas set estado = ''confirmada'', tipo = ''regular'', asistio = null, penalizada = false, liberada_por_no_confirmar = false, confirmada_por_clienta_at = null, confirmacion_enviada_at = null, credito_devuelto_at = null, membresia_id = null where id = v_reserva_id;',
  'tipo = ''regular'', asistio = null');
select public._parchear_funcion('agendar_clase',
  'update public.reservas set estado = ''confirmada'', tipo = ''prueba'' where id = v_reserva_id;',
  'update public.reservas set estado = ''confirmada'', tipo = ''prueba'', asistio = null, penalizada = false, liberada_por_no_confirmar = false, confirmada_por_clienta_at = null, confirmacion_enviada_at = null, credito_devuelto_at = null, membresia_id = null where id = v_reserva_id;',
  'tipo = ''prueba'', asistio = null');
-- RES-07: una clase de prueba ya asistida cuenta aunque después se cancele.
select public._parchear_funcion('agendar_clase',
  'tipo = ''prueba'' and estado <> ''cancelada'') into v_ya_uso_prueba;',
  'tipo = ''prueba'' and (estado <> ''cancelada'' or asistio is true)) into v_ya_uso_prueba;',
  'asistio is true)) into v_ya_uso_prueba');
-- RES-08: una persona no puede reservar dos clases que se solapan el mismo día.
select public._parchear_funcion('agendar_clase',
  'raise exception ''Ya tiene una reserva confirmada en esa clase.'';',
  E'raise exception ''Ya tiene una reserva confirmada en esa clase.'';\n  end if;\n  if exists (select 1 from public.reservas rx join public.horarios hx on hx.id = rx.horario_id join public.horarios hn on hn.id = p_horario_id\n              where rx.cliente_id = v_cliente_id and rx.fecha = p_fecha and rx.estado = ''confirmada'' and rx.horario_id <> p_horario_id\n                and hx.hora_inicio < hn.hora_fin and hx.hora_fin > hn.hora_inicio) then\n    raise exception ''Ya tienes otra clase reservada en ese horario.'';',
  'Ya tienes otra clase reservada en ese horario');

-- ───────── elegibilidad_clase: misma regla que la reserva (el portal ya no promete lo que la reserva rechaza) ─────────
select public._parchear_funcion('elegibilidad_clase',
  'm.fecha_vencimiento >= p_fecha',
  'm.fecha_vencimiento >= p_fecha and (m.fecha_inicio is null or m.fecha_inicio <= p_fecha) and not exists (select 1 from public.paquetes pkx where pkx.id = m.paquete_id and pkx.categoria = ''privado'')',
  'pkx.id = m.paquete_id', 4);

-- ───────── promover_lista_espera ─────────
-- ESP-04: con el módulo de espera apagado no se promueve (y la cancelación del núcleo sigue funcionando).
select public._parchear_funcion('promover_lista_espera',
  'select cupo_maximo, hora_inicio into v_cupo, v_hora_inicio from public.horarios where id = new.horario_id;',
  E'if not public.modulo_activo(new.tenant_id, ''lista_espera'') then return new; end if;\n  select cupo_maximo, hora_inicio into v_cupo, v_hora_inicio from public.horarios where id = new.horario_id;',
  'modulo_activo(new.tenant_id');
-- ESP-01: el paquete debe cubrir la sede de la clase, estar iniciado y no ser privado (mismas reglas que la reserva directa).
select public._parchear_funcion('promover_lista_espera',
  'and fecha_vencimiento >= new.fecha',
  'and fecha_vencimiento >= new.fecha and public.membresia_cubre_sede(id, new.sede_id) and (fecha_inicio is null or fecha_inicio <= new.fecha) and not exists (select 1 from public.paquetes pkp where pkp.id = membresias.paquete_id and pkp.categoria = ''privado'')',
  'membresia_cubre_sede(id, new.sede_id)');
select public._parchear_funcion('promover_lista_espera',
  'and m.estado = ''activa'' and m.congelada_desde is null and m.fecha_vencimiento >= new.fecha',
  'and m.estado = ''activa'' and m.congelada_desde is null and m.fecha_vencimiento >= new.fecha and public.membresia_cubre_sede(m.id, new.sede_id) and (m.fecha_inicio is null or m.fecha_inicio <= new.fecha)',
  'membresia_cubre_sede(m.id, new.sede_id)');
-- RES-09 / ESP-05: la promoción reinicia el intento y el crédito se asigna de nuevo (así volverá a devolverse al cancelar).
select public._parchear_funcion('promover_lista_espera',
  'update public.reservas set estado = ''confirmada'', tipo = ''regular'' where id = v_reserva_existente;',
  'update public.reservas set estado = ''confirmada'', tipo = ''regular'', asistio = null, penalizada = false, liberada_por_no_confirmar = false, confirmada_por_clienta_at = null, confirmacion_enviada_at = null, credito_devuelto_at = null, membresia_id = null where id = v_reserva_existente;',
  'tipo = ''regular'', asistio = null');
select public._parchear_funcion('promover_lista_espera',
  'update public.reservas set membresia_id = v_membresia_id where id = v_nueva_reserva_id;',
  'update public.reservas set membresia_id = v_membresia_id, credito_devuelto_at = null where id = v_nueva_reserva_id;',
  'membresia_id = v_membresia_id, credito_devuelto_at = null');
-- ESP-03: cada candidato se intenta de forma aislada; si uno no puede (límite diario, etc.), se salta y la cancelación original se conserva.
-- Se aplica en UN solo paso (un begin sin su end haría fallar la validación de sintaxis de Supabase).
do $$
declare v_oid oid; v_def text; v_a1 text; v_a2 text; v_n1 integer; v_n2 integer;
begin
  select p.oid into v_oid from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'promover_lista_espera';
  if v_oid is null then raise exception 'Se detiene: no existe promover_lista_espera'; end if;
  v_def := pg_get_functiondef(v_oid);
  if position('exception when others then' in v_def) > 0 then return; end if;
  v_a1 := 'select id into v_reserva_existente from public.reservas';
  v_a2 := '    exit;';
  v_n1 := (length(v_def) - length(replace(v_def, v_a1, ''))) / length(v_a1);
  v_n2 := (length(v_def) - length(replace(v_def, v_a2, ''))) / length(v_a2);
  if v_n1 <> 1 or v_n2 <> 1 then raise exception 'Se detiene: en promover_lista_espera el texto cambió (% / %)', v_n1, v_n2; end if;
  execute replace(replace(v_def, v_a1, E'begin\n    select id into v_reserva_existente from public.reservas'), v_a2, E'    exit;\n    exception when others then\n      continue;\n    end;');
end $$;

-- ───────── TEN-01 · Un estudio suspendido tampoco admite REACTIVAR una reserva cancelada ─────────
drop trigger if exists guard_estado_tx_reactivar on public.reservas;
create trigger guard_estado_tx_reactivar before update of estado on public.reservas
  for each row when (old.estado is distinct from 'confirmada' and new.estado = 'confirmada')
  execute function public._guard_estado_tenant('tx');

drop function public._parchear_funcion(text, text, text, text, integer);
