-- Hasta ahora codigos_descuento solo tenia policy de SELECT -- ningun staff podia crear o editar
-- codigos desde el panel, solo por SQL directo. Sigue el mismo patron del resto del proyecto:
-- la autorizacion de escritura vive en el RPC (security definer + chequeo de rol), no en policies
-- de INSERT/UPDATE sobre la tabla cruda.

create or replace function public.crear_codigo_descuento(
  p_tenant_id uuid,
  p_codigo text,
  p_descuento_pct integer,
  p_aplica_a text default 'paquetes',
  p_usos_maximos integer default null,
  p_vigente_hasta date default null,
  p_auto_aplicar_canal text default null
)
returns public.codigos_descuento
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_row public.codigos_descuento;
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','admin_sede']) then
    raise exception 'No autorizado';
  end if;
  if p_descuento_pct < 0 or p_descuento_pct > 100 then
    raise exception 'El descuento debe estar entre 0 y 100';
  end if;

  insert into public.codigos_descuento (tenant_id, codigo, descuento_pct, aplica_a, usos_maximos, vigente_hasta, auto_aplicar_canal)
  values (p_tenant_id, upper(trim(p_codigo)), p_descuento_pct, p_aplica_a, p_usos_maximos, p_vigente_hasta, p_auto_aplicar_canal)
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.crear_codigo_descuento(uuid, text, integer, text, integer, date, text) from public;
grant execute on function public.crear_codigo_descuento(uuid, text, integer, text, integer, date, text) to authenticated;

create or replace function public.actualizar_codigo_descuento(
  p_codigo_id uuid,
  p_activo boolean default null,
  p_descuento_pct integer default null,
  p_usos_maximos integer default null,
  p_vigente_hasta date default null
)
returns public.codigos_descuento
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid;
  v_row public.codigos_descuento;
begin
  select tenant_id into v_tenant_id from public.codigos_descuento where id = p_codigo_id;
  if v_tenant_id is null then raise exception 'Código no encontrado'; end if;
  if not public.tengo_rol_en_tenant(v_tenant_id, array['duena','gerente_general','admin_sede']) then
    raise exception 'No autorizado';
  end if;
  if p_descuento_pct is not null and (p_descuento_pct < 0 or p_descuento_pct > 100) then
    raise exception 'El descuento debe estar entre 0 y 100';
  end if;

  update public.codigos_descuento set
    activo = coalesce(p_activo, activo),
    descuento_pct = coalesce(p_descuento_pct, descuento_pct),
    usos_maximos = case when p_usos_maximos is not null then p_usos_maximos else usos_maximos end,
    vigente_hasta = case when p_vigente_hasta is not null then p_vigente_hasta else vigente_hasta end
  where id = p_codigo_id
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.actualizar_codigo_descuento(uuid, boolean, integer, integer, date) from public;
grant execute on function public.actualizar_codigo_descuento(uuid, boolean, integer, integer, date) to authenticated;
