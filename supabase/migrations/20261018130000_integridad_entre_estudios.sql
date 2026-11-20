-- Integridad entre estudios en la BASE: ninguna fila puede unir datos de dos estudios distintos,
-- ni siquiera con una escritura directa. (Blueprint, invariantes 1 y 12.)
-- Las claves nuevas se crean sin validar filas viejas (no bloquean) y se intenta validarlas; si hubiera
-- datos viejos cruzados, queda un aviso y la clave igual protege toda fila nueva.

do $$
declare t text;
begin
  foreach t in array array['clientes','paquetes','horarios','membresias','sedes'] loop
    if not exists (select 1 from pg_constraint where conname = t || '_id_tenant_uq') then
      execute format('alter table public.%I add constraint %I unique (id, tenant_id)', t, t || '_id_tenant_uq');
    end if;
  end loop;
end $$;

do $$
declare x record;
begin
  for x in select * from (values
    ('membresias','membresias_cliente_mismo_tenant','cliente_id','clientes'),
    ('membresias','membresias_paquete_mismo_tenant','paquete_id','paquetes'),
    ('membresias','membresias_sede_mismo_tenant','sede_venta_id','sedes'),
    ('reservas','reservas_cliente_mismo_tenant','cliente_id','clientes'),
    ('reservas','reservas_horario_mismo_tenant','horario_id','horarios'),
    ('reservas','reservas_membresia_mismo_tenant','membresia_id','membresias'),
    ('reservas','reservas_sede_mismo_tenant','sede_id','sedes')
  ) v(tabla, nombre, col, ref) loop
    if not exists (select 1 from pg_constraint where conname = x.nombre) then
      execute format('alter table public.%I add constraint %I foreign key (%I, tenant_id) references public.%I (id, tenant_id) not valid', x.tabla, x.nombre, x.col, x.ref);
      begin
        execute format('alter table public.%I validate constraint %I', x.tabla, x.nombre);
      exception when others then
        raise notice 'AVISO: % tiene filas viejas que cruzan estudios; la clave protege las nuevas. Revisar: %', x.nombre, sqlerrm;
      end;
    end if;
  end loop;
end $$;
