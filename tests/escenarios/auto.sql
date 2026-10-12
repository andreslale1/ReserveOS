-- Automatizaciones con hora simulada: miércoles 14/10/2026 09:00 en Guatemala (15:00 UTC). Todo dentro de una transacción que se deshace.
do $$
declare t uuid; s uuid; c1 uuid; c2 uuid; ci uuid; cs uuid; mi uuid; ins uuid; paq uuid; ahora timestamptz := timestamptz '2026-10-14 15:00:00+00';
  h1 uuid; h2 uuid; h3 uuid; h4 uuid; h5 uuid; h6 uuid; r1 uuid; r2 uuid; r3 uuid; r4 uuid; r5 uuid; r6 uuid; k int; k2 int; log text := ''; n1 int; e text; tok uuid; mid uuid;
  u1 text; hmc_antes int;
begin
  select id into t from tenants where slug='vim-prueba';
  select id into s from sedes where tenant_id=t and name='Centro';
  select id into c1 from clientes where tenant_id=t and nombre='FX Clienta Centro';
  select id into c2 from clientes where tenant_id=t and nombre='FX Clienta Norte';
  select id into ins from tenant_memberships where tenant_id=t and role='instructora' limit 1;
  select id into paq from paquetes where tenant_id=t limit 1;
  if not public.modulo_activo(t,'nucleo_agenda_reservas') then raise exception 'fixture sin módulo nucleo'; end if;
  insert into configuracion_reservas(tenant_id, horas_minimas_confirmacion) values (t, 2) on conflict (tenant_id) do update set horas_minimas_confirmacion = 2;
  update clientes set email = coalesce(email,'fx-c1@auto.test'), telefono = coalesce(telefono,'50255550001') where id in (c1, c2);
  delete from comunicacion_preferencias where cliente_id in (c1, c2);
  update membresias set clases_usadas = 0 where cliente_id in (c1,c2) and estado='activa';

  -- horarios (fecha específica; hora de sede)
  insert into horarios(tenant_id,sede_id,dia_semana,hora_inicio,hora_fin,nombre_clase,cupo_maximo,fecha_especifica,instructor_membership_id) values (t,s,3,'10:00','11:00','ZZ Auto 1h',10,'2026-10-14',ins) returning id into h1;
  insert into horarios(tenant_id,sede_id,dia_semana,hora_inicio,hora_fin,nombre_clase,cupo_maximo,fecha_especifica) values (t,s,4,'07:00','08:00','ZZ Auto manana',10,'2026-10-15') returning id into h2;
  insert into horarios(tenant_id,sede_id,dia_semana,hora_inicio,hora_fin,nombre_clase,cupo_maximo,fecha_especifica) values (t,s,3,'11:30','12:30','ZZ Auto ultimo',10,'2026-10-14') returning id into h3;
  insert into horarios(tenant_id,sede_id,dia_semana,hora_inicio,hora_fin,nombre_clase,cupo_maximo,fecha_especifica,instructor_membership_id) values (t,s,3,'08:00','08:50','ZZ Auto pasada',10,'2026-10-14',ins) returning id into h4;
  insert into horarios(tenant_id,sede_id,dia_semana,hora_inicio,hora_fin,nombre_clase,cupo_maximo,instructor_membership_id) values (t,s,4,'10:00','11:00','ZZ Auto fijo',10,ins) returning id into h5;
  insert into horarios(tenant_id,sede_id,dia_semana,hora_inicio,hora_fin,nombre_clase,cupo_maximo,fecha_especifica,instructor_membership_id) values (t,s,3,'09:10','10:00','ZZ Auto inicio',10,'2026-10-14',ins) returning id into h6;
  insert into reservas(tenant_id,sede_id,horario_id,cliente_id,fecha,tipo,estado) values (t,s,h1,c1,'2026-10-14','regular','confirmada') returning id into r1;
  insert into reservas(tenant_id,sede_id,horario_id,cliente_id,fecha,tipo,estado) values (t,s,h2,c1,'2026-10-15','regular','confirmada') returning id into r2;
  insert into reservas(tenant_id,sede_id,horario_id,cliente_id,fecha,tipo,estado) values (t,s,h3,c1,'2026-10-14','regular','confirmada') returning id into r3;
  insert into reservas(tenant_id,sede_id,horario_id,cliente_id,fecha,tipo,estado,asistio) values (t,s,h4,c1,'2026-10-14','regular','confirmada',false) returning id into r4;
  insert into reservas(tenant_id,sede_id,horario_id,cliente_id,fecha,tipo,estado,asistio) values (t,s,h4,c2,'2026-10-14','regular','confirmada',true) returning id into r5;
  insert into reservas(tenant_id,sede_id,horario_id,cliente_id,fecha,tipo,estado) values (t,s,h6,c1,'2026-10-14','regular','confirmada') returning id into r6;

  -- 1 · recordatorio 1 h antes: solo la clase de las 10:00 (a 60 min); idempotente
  k := public.auto_recordatorio_clase(ahora, t); k2 := public.auto_recordatorio_clase(ahora, t);
  select count(*) into n1 from cola_mensajes where tenant_id=t and clave_unica like 'rec1h:'||r1||':%';
  log := log || format('[rec1h nuevos>0=%s, en cola=%s, repetir=%s, solo-1-reserva=%s] ', k > 0, n1, k2, (select count(*) from cola_mensajes where tenant_id=t and clave_unica like 'rec1h:%' and clave_unica not like 'rec1h:'||r1||':%' and created_at > now() - interval '1 minute') = 0);
  -- 2 · reserva agendada (mañana 07:00 = 22 h) 
  k := public.auto_reserva_agendada(ahora, t); k2 := public.auto_reserva_agendada(ahora, t);
  log := log || format('[agendada nuevos>0=%s, repetir=%s, marca=%s] ', k > 0, k2, (select recordatorio_agendada_enviado_at is not null from reservas where id=r2));
  -- 3 · confirmación: r2 (22 h, hmc=2 → pedido) y r3 (2,5 h → último aviso)
  k := public.auto_confirmacion_asistencia(ahora, t); k2 := public.auto_confirmacion_asistencia(ahora, t);
  log := log || format('[confirmar pedido=%s, ultimo=%s, repetir=%s] ', (select confirmacion_enviada_at is not null and not confirmacion_recordatorio_enviado from reservas where id=r2), (select confirmacion_recordatorio_enviado from reservas where id=r3), k2);
  -- 5/6 · inasistencia (c1 no vino) y asistencia confirmada (c2 vino)
  k := public.auto_aviso_inasistencia(ahora, t); k2 := public.auto_aviso_inasistencia(ahora, t);
  log := log || format('[inasistencia nuevos>0=%s, repetir=%s, solo-c1=%s] ', k > 0, k2, (select count(*) from cola_mensajes where tenant_id=t and clave_unica like 'noshow:'||r5||':%') = 0);
  k := public.auto_aviso_asistencia(ahora, t); k2 := public.auto_aviso_asistencia(ahora, t);
  log := log || format('[asistencia nuevos>0=%s, repetir=%s, marca=%s] ', k > 0, k2, (select asistencia_notificada from reservas where id=r5));
  -- 7 · avisos operativos: «fin» de h4 (terminó 08:50, ahora 09:00) y «inicio» de h6 (09:10); una sola vez
  k := public.auto_avisos_operativos(ahora, t); k2 := public.auto_avisos_operativos(ahora, t);
  log := log || format('[operativos nuevos=%s, repetir=%s, fin=%s, inicio=%s] ', k, k2, exists(select 1 from avisos_operativos_enviados where horario_id=h4 and tipo='fin'), exists(select 1 from avisos_operativos_enviados where horario_id=h6 and tipo='inicio'));
  -- 4 · horario fijo: c1 fue a h5 (jueves 10:00) tres jueves seguidos y no reservó el del 15/10 (25 h)
  insert into reservas(tenant_id,sede_id,horario_id,cliente_id,fecha,tipo,estado) values (t,s,h5,c1,'2026-10-08','regular','confirmada'),(t,s,h5,c1,'2026-10-01','regular','confirmada'),(t,s,h5,c1,'2026-09-24','regular','confirmada');
  k := public.auto_horario_fijo(ahora, t); k2 := public.auto_horario_fijo(ahora, t);
  log := log || format('[fijo nuevos>0=%s, repetir=%s] ', k > 0, k2);
  -- apagar por estudio: no encola ni marca
  update reservas set asistio = true, asistencia_notificada = false where id = r4;
  insert into automatizaciones_tenant(tenant_id, clave, activa) values (t, 'aviso_asistencia', false);
  k := public.auto_aviso_asistencia(ahora, t);
  log := log || format('[apagada=%s, sin-marca=%s] ', k, (select not asistencia_notificada from reservas where id=r4));
  delete from automatizaciones_tenant where tenant_id=t and clave='aviso_asistencia';
  -- preferencias: sin correo ni WhatsApp no se encola
  insert into comunicacion_preferencias(cliente_id, tenant_id, marketing_ok, email_ok, whatsapp_ok) values (c2, t, true, false, false) on conflict (cliente_id) do update set email_ok=false, whatsapp_ok=false;
  update reservas set asistencia_notificada = false where id = r5; delete from cola_mensajes where tenant_id=t and clave_unica like 'asistio:'||r5||':%';
  k := public.auto_aviso_asistencia(ahora, t);
  log := log || format('[sin-consentimiento=%s] ', (select count(*) from cola_mensajes where tenant_id=t and clave_unica like 'asistio:'||r5||':%'));
  -- hora de sede: a las 08:00 de Guatemala (14:00 UTC) corre la salud; a las 09:00 no
  k := public.auto_salud_sistema(timestamptz '2026-10-14 15:00:00+00', t);
  log := log || format('[salud 9am sin correr=%s] ', (select count(*) from salud_chequeos where tenant_id=t and fecha_local='2026-10-14') = 0);
  -- problemas reales para la salud: cupo excedido, paquete excedido
  update horarios set cupo_maximo = 1 where id = h4;
  -- (la base ya impide clases_usadas > clases_totales con un CHECK; el chequeo diario queda como red de seguridad)
  k := public.auto_salud_sistema(timestamptz '2026-10-14 14:00:00+00', t); k2 := public.auto_salud_sistema(timestamptz '2026-10-14 14:00:00+00', t);
  log := log || format('[salud 8am: aviso a dueña>0=%s, repetir=%s, cupos=%s, fila=%s] ', k > 0, k2, (select resultados->'cupos_excedidos'->>'n' from salud_chequeos where tenant_id=t and fecha_local='2026-10-14'), (select count(*) from salud_chequeos where tenant_id=t and fecha_local='2026-10-14'));
  -- 11/12/13 · paquetes por vencer, inactivas, sin contraseña
  select id into mid from membresias where cliente_id = c1 and estado='activa' limit 1;
  update membresias set fecha_vencimiento = '2026-10-17' where id = mid;
  k := public.auto_paquetes_por_vencer(timestamptz '2026-10-14 15:00:00+00', t); k2 := public.auto_paquetes_por_vencer(timestamptz '2026-10-14 15:00:00+00', t);
  log := log || format('[vence nuevos>0=%s, repetir=%s] ', k > 0, k2);
  insert into clientes(tenant_id, nombre, email, telefono, sede_habitual_id) values (t, 'ZZ Inactiva', 'zz-inactiva@auto.test', '50255550002', s) returning id into ci;
  insert into membresias(tenant_id, cliente_id, paquete_id, sede_venta_id, cobertura_tipo, clases_totales, clases_usadas, fecha_inicio, fecha_vencimiento, estado, pagada) select t, ci, paq, s, 'sede', 8, 2, '2026-09-01', '2026-11-30', 'activa', true;
  insert into reservas(tenant_id,sede_id,horario_id,cliente_id,fecha,tipo,estado,asistio) values (t,s,h5,ci,'2026-09-17','regular','confirmada',true);
  k := public.auto_clientas_inactivas(timestamptz '2026-10-14 16:00:00+00', t); k2 := public.auto_clientas_inactivas(timestamptz '2026-10-14 16:00:00+00', t);
  log := log || format('[inactivas 10am nuevos>0=%s, repetir=%s, c1-no=%s] ', k > 0, k2, (select count(*) from cola_mensajes where tenant_id=t and cliente_id=c1 and clave_unica like 'inactiva:%') = 0);
  insert into clientes(tenant_id, nombre, email, telefono, created_at) values (t, 'ZZ SinPass', 'zz-sinpass@auto.test', '50255550003', timestamptz '2026-10-10 12:00:00+00') returning id into cs;
  insert into invitaciones_clienta(cliente_id, token, usado, created_at) values (cs, gen_random_uuid(), false, timestamptz '2026-10-10 12:00:00+00');
  k := public.auto_cuentas_sin_password(timestamptz '2026-10-14 17:00:00+00', t); k2 := public.auto_cuentas_sin_password(timestamptz '2026-10-14 17:00:00+00', t);
  log := log || format('[sinpass 11am nuevos>0=%s, repetir=%s, enlace=%s] ', k > 0, k2, exists(select 1 from cola_mensajes where tenant_id=t and cliente_id=cs and cuerpo like '%/invitar/clienta/%'));
  -- 14 · análisis semanal: lunes 12/10 07:00 de Guatemala = 13:00 UTC
  k := public.auto_analisis_semanal(timestamptz '2026-10-12 13:00:00+00', t); k2 := public.auto_analisis_semanal(timestamptz '2026-10-12 13:00:00+00', t);
  log := log || format('[semanal nuevos>0=%s, repetir=%s, martes-no=%s] ', k > 0, k2, public.auto_analisis_semanal(timestamptz '2026-10-13 13:00:00+00', t) = 0);
  -- 9 · pagos: un «iniciado» de hace 3 horas pasa a revisión; uno reciente no
  insert into pago_transacciones(tenant_id, cliente_id, paquete_id, tipo, proveedor, monto, estado, created_at) values (t, c1, paq, 'paquete', 'prueba', 100, 'iniciado', ahora - interval '3 hours');
  insert into pago_transacciones(tenant_id, cliente_id, paquete_id, tipo, proveedor, monto, estado, created_at) values (t, c1, paq, 'paquete', 'prueba', 100, 'iniciado', ahora - interval '20 minutes');
  k := public.auto_reconciliar_pagos(ahora, t); k2 := public.auto_reconciliar_pagos(ahora, t);
  log := log || format('[pagos marcados=%s, repetir=%s] ', k, k2);
  -- registro de ejecuciones
  log := log || format('[latido=%s, ejecuciones=%s] ', (select count(*) from automatizaciones_latido where clave in ('recordatorio_clase','salud_sistema')), (select count(*) from automatizaciones_ejecuciones where encolados > 0));
  raise exception 'RESULTADO: %', log;
end $$;
