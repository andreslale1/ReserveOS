-- Las funciones protegidas tenían listas de roles escritas a mano que podían excluir a un rol que la matriz sí
-- permite (con delegación). La matriz (role_permissions) pasa a ser la fuente: se reemplaza la lista de la primera
-- verificación por los roles que la matriz define para esa acción. _exigir_accion decide si hace falta delegación.
do $$
declare
  r record; v_oid oid; v_def text; v_roles text; v_n int := 0;
begin
  for r in select * from (values
    ('actualizar_marca','P04'), ('crear_sede','P05'), ('cerrar_sede','P05'), ('reabrir_sede','P05'),
    ('crear_invitacion_personal','P06'), ('asignar_sede_personal','P06'), ('quitar_sede_personal','P06'),
    ('crear_paquete','P23'), ('actualizar_paquete','P23'),
    ('ajustar_creditos_membresia','P25'), ('confirmar_pago_membresia','P30'), ('rechazar_membresia_pendiente','P30'),
    ('anular_cobro_membresia','P31'), ('registrar_gasto','P35'), ('registrar_activo_pasivo','P36'),
    ('crear_codigo_descuento','P40'), ('actualizar_codigo_descuento','P40'),
    ('actualizar_horario','P14'), ('cancelar_clase_fecha','P14')
  ) as x(fn, act) loop
    select string_agg(quote_literal(role), ',' order by role) into v_roles
      from public.role_permissions where action_id = r.act and role not in ('clienta','saas');
    for v_oid in select oid from pg_proc where proname = r.fn and pronamespace = 'public'::regnamespace loop
      v_def := pg_get_functiondef(v_oid);
      if v_def not like '%_exigir_accion%' then continue; end if;
      v_def := regexp_replace(v_def, '(if not public\.(?:tengo_rol_en_tenant|staff_puede_en_sede)\([^;]*?)array\[[^\]]*\]', '\1array[' || v_roles || ']');
      execute v_def;
      v_n := v_n + 1;
    end loop;
  end loop;
end $$;
