-- P23 de la matriz: "Crear catálogo, precios y cobertura de sedes" -- hueco real encontrado al
-- revisar que faltaba: no existía ninguna forma de crear un paquete desde el panel. Un tenant
-- nuevo (incluso uno recien creado desde /owner) no tiene nada que vender hasta que alguien
-- inserte filas en paquetes a mano por SQL. Solo dueña/gerente_general (G/G*) -- admin_sede no
-- aparece en esta fila de la matriz.

create or replace function public.crear_paquete(
  p_tenant_id uuid,
  p_nombre text,
  p_precio numeric,
  p_vigencia_dias integer,
  p_num_clases integer default null,
  p_cobertura text default 'sede',
  p_sede_ids uuid[] default '{}',
  p_descripcion text default null,
  p_categoria text default 'regular'
)
returns public.paquetes
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_row public.paquetes;
  v_sede uuid;
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then
    raise exception 'No autorizado';
  end if;
  if trim(coalesce(p_nombre, '')) = '' then raise exception 'El nombre es obligatorio'; end if;
  if p_precio < 0 then raise exception 'El precio no puede ser negativo'; end if;
  if p_vigencia_dias <= 0 then raise exception 'La vigencia debe ser mayor a 0 días'; end if;
  if p_cobertura not in ('sede', 'sedes', 'todas') then raise exception 'Cobertura inválida'; end if;
  if p_cobertura = 'sedes' and coalesce(array_length(p_sede_ids, 1), 0) = 0 then
    raise exception 'Elegí al menos una sede para cobertura "sedes"';
  end if;

  insert into public.paquetes (tenant_id, nombre, descripcion, num_clases, precio, vigencia_dias, cobertura, categoria)
  values (p_tenant_id, trim(p_nombre), nullif(trim(coalesce(p_descripcion, '')), ''), p_num_clases, p_precio, p_vigencia_dias, p_cobertura, p_categoria)
  returning * into v_row;

  if p_cobertura = 'sedes' then
    foreach v_sede in array p_sede_ids loop
      insert into public.paquete_sedes (paquete_id, sede_id) values (v_row.id, v_sede)
      on conflict do nothing;
    end loop;
  end if;

  return v_row;
end;
$$;
revoke all on function public.crear_paquete(uuid, text, numeric, integer, integer, text, uuid[], text, text) from public;
grant execute on function public.crear_paquete(uuid, text, numeric, integer, integer, text, uuid[], text, text) to authenticated;

create or replace function public.actualizar_paquete(
  p_paquete_id uuid,
  p_activo boolean default null,
  p_precio numeric default null,
  p_nombre text default null,
  p_descripcion text default null
)
returns public.paquetes
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid;
  v_row public.paquetes;
begin
  select tenant_id into v_tenant_id from public.paquetes where id = p_paquete_id;
  if v_tenant_id is null then raise exception 'Paquete no encontrado'; end if;
  if not public.tengo_rol_en_tenant(v_tenant_id, array['duena','gerente_general']) then
    raise exception 'No autorizado';
  end if;
  if p_precio is not null and p_precio < 0 then raise exception 'El precio no puede ser negativo'; end if;

  update public.paquetes set
    activo = coalesce(p_activo, activo),
    precio = coalesce(p_precio, precio),
    nombre = coalesce(nullif(trim(p_nombre), ''), nombre),
    descripcion = case when p_descripcion is not null then nullif(trim(p_descripcion), '') else descripcion end
  where id = p_paquete_id
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.actualizar_paquete(uuid, boolean, numeric, text, text) from public;
grant execute on function public.actualizar_paquete(uuid, boolean, numeric, text, text) to authenticated;
