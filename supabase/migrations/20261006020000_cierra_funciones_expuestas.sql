-- SEGURIDAD: las funciones nuevas de public heredaban EXECUTE para el rol anónimo (default privileges de Supabase;
-- un "revoke ... from public" no lo quita). Resultado: 334 funciones ejecutables por visitantes sin cuenta. La mayoría se
-- protegía internamente, pero varias NO verificaban identidad y permitían, por ejemplo, activar un paquete sin pagar
-- (confirmar_pago_transaccion), regalar clases (devolver_clase_a_membresia) o leer el gasto de cualquier clienta.
-- Regla desde ahora: el anónimo solo puede ejecutar una lista blanca explícita.

-- 1) Anónimo: nada, salvo lo realmente público.
revoke execute on all functions in schema public from anon;
grant execute on function public.horarios_publicos(text) to anon;
grant execute on function public.tenant_por_dominio(text) to anon;
grant execute on function public.captar_lead(text, text, text, text, text, text, text, text) to anon;
grant execute on function public.invitacion_clienta_por_token(uuid) to anon;
grant execute on function public.invitacion_personal_por_token(uuid) to anon;
grant execute on function public.testimonios_publicos(uuid) to anon;

-- 2) Las funciones nuevas ya no se exponen solas (cada migración concede de forma explícita a authenticated).
alter default privileges in schema public revoke execute on functions from anon;

-- 3) Internas, de cron o de proveedor: ni anónimos ni usuarios autenticados. Solo el servidor (service_role) o el propio cron.
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as firma from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and p.proname in (
      'confirmar_pago_transaccion','confirmar_transaccion_carrito','devolver_clase_a_membresia','otorgar_bono_referido_si_corresponde',
      'gasto_productos_clienta','liberar_cupos_no_confirmados','lista_espera_vencida','bloquear_espera_clase_empezada',
      'horarios_por_comenzar','horarios_por_terminar','reservas_asistencia_por_notificar','reservas_liberadas_no_confirmar',
      'reservas_para_recordar_confirmacion','reservas_para_recordatorio_agendada','membresias_para_recordatorio_inactividad',
      'membresias_para_recordatorio_vencimiento','clientas_para_recordatorio_password','caja_esperado_del_dia__interno',
      'chequeo_salud__interno','kpi_cancelaciones_prueba__interno','kpi_clientas_nuevas_mensual__interno',
      'kpi_detalle_cancelaciones_prueba__interno','kpi_embudo_prueba__interno','kpi_ingreso_bruto_mensual__interno',
      'kpi_tendencia__interno','rls_auto_enable','obtener_cliente_mostrador','necesita_password_por_email','usuario_tiene_password',
      'agendar_clase_prueba','registrar_accion_admin','promover_lista_espera','liberar_privatizacion_si_cancela','set_codigo_referido',
      'set_actualizado_at','set_updated_at','proteger_columnas_clienta','_procesar_pedido_pagado')
  loop
    execute format('revoke execute on function %s from authenticated, public', r.firma);
    execute format('grant execute on function %s to service_role', r.firma);
  end loop;
end $$;
