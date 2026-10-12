-- La administradora de sede solo crea y administra cuentas de recepción e instructoras (de sus sedes); la gerencia regional, además, administradoras de sede.
-- Contadora y marketing, y cualquier rol superior, los define solo la dueña o la gerencia general.
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='_validar_alcance_personal';
  d := replace(d, E'  if public._rol_de_sede(p_rol_objetivo) and (p_sede_ids is null',
    E'  if v_mi_rol = ''admin_sede'' and p_rol_objetivo not in (''recepcion'',''instructora'') then\n    raise exception ''Una administradora de sede solo crea y administra recepción e instructoras de sus sedes.'';\n  end if;\n  if v_mi_rol = ''gerente_regional'' and p_rol_objetivo not in (''admin_sede'',''recepcion'',''instructora'') then\n    raise exception ''La gerencia regional solo crea y administra administradoras de sede, recepción e instructoras de sus sedes.'';\n  end if;\n  if public._rol_de_sede(p_rol_objetivo) and (p_sede_ids is null');
  if d not like '%solo crea y administra recepción e instructoras%' then raise exception 'no se pudo parchear _validar_alcance_personal'; end if;
  execute d;
end $$;
