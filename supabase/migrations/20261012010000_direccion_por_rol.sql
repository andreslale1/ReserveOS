-- F-12: Dirección entrega a cada rol solo su parte. Ventas: pipeline y contratos. Finanzas: dinero. Soporte/implementación/ingeniería: servicio y activaciones.
-- El operador lo recibe completo. El filtro está en el servidor: no basta con ocultar tarjetas.
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='plataforma_direccion';
  d := replace(d, 'declare v json;', 'declare v json; r text := public.mi_rol_plataforma();');
  d := replace(d, E'  ) into v;\n  return v;', E'  ) into v;\n  if r is distinct from ''operador'' then\n    v := (v::jsonb - case r\n      when ''ventas'' then array[''cobros_en_mora'',''estudios_en_mora'',''cobros_por_vencer_7d'',''tickets_abiertos'',''tickets_urgentes'',''tickets_sla_vencido'',''incidentes_activos'',''estudios_activos'',''estudios_suspendidos'']\n      when ''finanzas'' then array[''seguimientos_vencidos'',''sin_proxima_accion'',''valor_pipeline'',''oportunidades_abiertas'',''activaciones_en_curso'',''tickets_abiertos'',''tickets_urgentes'',''tickets_sla_vencido'',''incidentes_activos'',''tareas_vencidas'',''tareas_hoy'']\n      else array[''seguimientos_vencidos'',''sin_proxima_accion'',''valor_pipeline'',''oportunidades_abiertas'',''cobros_en_mora'',''estudios_en_mora'',''cobros_por_vencer_7d'',''contratos_por_vencer_60d'']\n    end)::json;\n  end if;\n  return v;');
  if d not like '%mi_rol_plataforma%' or d not like '%ventas'' then array%' then raise exception 'no se pudo parchear plataforma_direccion'; end if;
  execute d;

  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='owner_direccion_extra';
  d := replace(d, 'declare hoy date', 'declare r text := public.mi_rol_plataforma(); hoy date');
  d := replace(d, E'  ) into v;\n  return v;', E'  ) into v;\n  if r is distinct from ''operador'' then\n    v := jsonb_set(v::jsonb, ''{acciones}'', coalesce((select jsonb_agg(a) from jsonb_array_elements(v::jsonb->''acciones'') a\n      where (a->>''tipo'') like any (case r when ''ventas'' then array[''Propuesta%'',''Activación%''] when ''finanzas'' then array[''Cobro%''] else array[''Activación%'',''Incidente%'',''Ticket%'',''Dominio%''] end)), ''[]''::jsonb))::json;\n    v := (v::jsonb #- (case r when ''ventas'' then ''{comparativa,cobrado}'' when ''finanzas'' then ''{comparativa,oportunidades_nuevas}'' else ''{comparativa,cobrado}'' end)::text[])::json;\n    if r = ''finanzas'' then v := (v::jsonb #- ''{comparativa,ganadas}'' #- ''{comparativa,tickets_nuevos}'')::json; end if;\n    if r not in (''ventas'',''finanzas'') then v := (v::jsonb #- ''{comparativa,oportunidades_nuevas}'' #- ''{comparativa,ganadas}'')::json; end if;\n    if r = ''ventas'' then v := (v::jsonb #- ''{comparativa,tickets_nuevos}'')::json; end if;\n  end if;\n  return v;');
  if d not like '%like any%' then raise exception 'no se pudo parchear owner_direccion_extra'; end if;
  execute d;
end $$;
