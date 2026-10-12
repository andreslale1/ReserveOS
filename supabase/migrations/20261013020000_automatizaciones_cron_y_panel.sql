-- AUTOMATIZACIONES · programación (pg_cron) y funciones del panel.
-- Los trabajos «diarios» corren CADA HORA y cada estudio entra solo cuando es la hora de su sede (8, 9, 10, 11 a. m.; lunes 7 a. m.): nada depende de UTC.
select cron.unschedule(jobname) from cron.job where jobname = 'encolar_recordatorios';
select cron.schedule('recordatorio_clase_1h',       '*/10 * * * *', 'select public.auto_recordatorio_clase()');
select cron.schedule('recordatorio_reserva_agendada','*/15 * * * *', 'select public.auto_reserva_agendada()');
select cron.schedule('recordatorio_confirmacion',   '*/10 * * * *', 'select public.auto_confirmacion_asistencia()');
select cron.schedule('recordatorio_horario_fijo',   '*/15 * * * *', 'select public.auto_horario_fijo()');
select cron.schedule('aviso_inasistencia',          '*/10 * * * *', 'select public.auto_aviso_inasistencia()');
select cron.schedule('aviso_asistencia_confirmada', '*/10 * * * *', 'select public.auto_aviso_asistencia()');
select cron.schedule('avisos_operativos',           '*/10 * * * *', 'select public.auto_avisos_operativos()');
select cron.schedule('liberar_cupos_no_confirmados','*/10 * * * *', 'select public.auto_liberar_cupos()');
select cron.schedule('lista_espera_vencida',        '*/15 * * * *', 'select public.auto_lista_espera_vencida()');
select cron.schedule('reconciliar_pagos',           '*/2 * * * *',  'select public.auto_reconciliar_pagos()');
select cron.schedule('salud_sistema',               '7 * * * *',    'select public.auto_salud_sistema()');
select cron.schedule('paquetes_por_vencer',         '7 * * * *',    'select public.auto_paquetes_por_vencer()');
select cron.schedule('clientas_inactivas',          '7 * * * *',    'select public.auto_clientas_inactivas()');
select cron.schedule('cuentas_sin_password',        '7 * * * *',    'select public.auto_cuentas_sin_password()');
select cron.schedule('analisis_semanal',            '30 * * * *',   'select public.auto_analisis_semanal()');

-- Panel de la dueña ----------------------------------------------------------------------------------------------------------------
create or replace function public.automatizaciones_panel(p_tenant_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public._es_g(p_tenant_id) then raise exception 'No autorizado'; end if;
  return jsonb_build_object(
    'automatizaciones', coalesce((select jsonb_agg(jsonb_build_object('clave', a.clave, 'nombre', a.nombre, 'descripcion', a.descripcion, 'frecuencia', a.frecuencia, 'modulo', a.modulo,
        'modulo_activo', (a.modulo is null or public.modulo_activo(p_tenant_id, a.modulo)), 'toggleable', a.toggleable, 'audiencia', a.audiencia,
        'activa', coalesce(at.activa, true), 'ultima_ejecucion', l.ultima_ejecucion, 'ultimo_estado', l.ultimo_estado,
        'encolados_7d', (select coalesce(sum((e.detalle->>p_tenant_id::text)::int), 0) from public.automatizaciones_ejecuciones e where e.clave = a.clave and e.ejecutado_at > now() - interval '7 days'),
        'ultimo_encolado', (select max(e.ejecutado_at) from public.automatizaciones_ejecuciones e where e.clave = a.clave and e.detalle ? p_tenant_id::text)) order by a.orden)
      from public.automatizaciones a left join public.automatizaciones_tenant at on at.tenant_id = p_tenant_id and at.clave = a.clave left join public.automatizaciones_latido l on l.clave = a.clave), '[]'::jsonb),
    'ejecuciones', coalesce((select jsonb_agg(x) from (select e.clave, a.nombre, e.ejecutado_at, e.estado, coalesce((e.detalle->>p_tenant_id::text)::int, 0) as encolados
        from public.automatizaciones_ejecuciones e join public.automatizaciones a on a.clave = e.clave where e.detalle ? p_tenant_id::text order by e.ejecutado_at desc limit 15) x), '[]'::jsonb),
    'salud', (select to_jsonb(s) from (select fecha_local, ejecutado_at, problemas, resultados from public.salud_chequeos where tenant_id = p_tenant_id order by fecha_local desc limit 1) s),
    'cola', (select jsonb_build_object('pendientes', count(*) filter (where estado in ('pendiente','fallido')), 'enviados', count(*) filter (where estado = 'enviado')) from public.cola_mensajes where tenant_id = p_tenant_id));
end $$;

create or replace function public.automatizacion_configurar(p_tenant_id uuid, p_clave text, p_activa boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public._es_g(p_tenant_id) then raise exception 'No autorizado'; end if;
  if not exists (select 1 from public.automatizaciones where clave = p_clave and toggleable) then raise exception 'Esta automatización no se puede apagar'; end if;
  insert into public.automatizaciones_tenant (tenant_id, clave, activa, updated_at, updated_by) values (p_tenant_id, p_clave, p_activa, now(), auth.uid())
    on conflict (tenant_id, clave) do update set activa = excluded.activa, updated_at = now(), updated_by = auth.uid();
end $$;

create or replace function public.salud_ejecutar_ahora(p_tenant_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public._es_g(p_tenant_id) then raise exception 'No autorizado'; end if;
  perform public.auto_salud_sistema(now(), p_tenant_id, true);
  return (select to_jsonb(s) from (select fecha_local, ejecutado_at, problemas, resultados from public.salud_chequeos where tenant_id = p_tenant_id order by fecha_local desc limit 1) s);
end $$;
revoke all on function public.automatizaciones_panel(uuid), public.automatizacion_configurar(uuid,text,boolean), public.salud_ejecutar_ahora(uuid) from public, anon;
grant execute on function public.automatizaciones_panel(uuid), public.automatizacion_configurar(uuid,text,boolean), public.salud_ejecutar_ahora(uuid) to authenticated;
