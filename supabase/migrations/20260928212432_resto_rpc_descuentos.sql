-- Módulo resto — códigos de descuento. Todo tenant-scoped vía codigos_descuento.tenant_id (ya
-- denormalizado en la tabla del Hito "resto tablas").

create or replace function public._precio_con_descuento(p_paquete_id uuid, p_precio_catalogo numeric, p_codigo_id uuid, p_descuento_pct integer)
returns numeric
language plpgsql stable
set search_path to 'public'
as $$
declare
  v_override numeric;
begin
  if p_codigo_id is not null then
    select precio_override into v_override from public.codigos_descuento_paquetes where codigo_id = p_codigo_id and paquete_id = p_paquete_id;
    if v_override is not null then return v_override; end if;
  end if;
  return ceil(p_precio_catalogo * (1 - p_descuento_pct / 100.0));
end;
$$;

create or replace function public._validar_codigo_descuento(p_tenant_id uuid, p_codigo text, p_paquete_id uuid, OUT v_descuento_pct integer, OUT v_codigo_id uuid)
returns record
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_codigo record;
begin
  v_descuento_pct := 0; v_codigo_id := null;
  if p_codigo is null or trim(p_codigo) = '' then return; end if;

  select * into v_codigo from public.codigos_descuento
    where tenant_id = p_tenant_id and codigo = upper(trim(p_codigo)) and activo = true
      and (vigente_hasta is null or vigente_hasta >= public.hoy_en_sede(null))
      and (usos_maximos is null or usos_actuales < usos_maximos);
  if v_codigo is null then raise exception 'Código de descuento no válido o vencido'; end if;

  if exists (select 1 from public.codigos_descuento_paquetes where codigo_id = v_codigo.id)
     and not exists (select 1 from public.codigos_descuento_paquetes where codigo_id = v_codigo.id and paquete_id = p_paquete_id) then
    raise exception 'Este código no aplica para el paquete seleccionado';
  end if;
  v_descuento_pct := v_codigo.descuento_pct; v_codigo_id := v_codigo.id;
end;
$$;
revoke all on function public._validar_codigo_descuento(uuid, text, uuid) from public;
grant execute on function public._validar_codigo_descuento(uuid, text, uuid) to authenticated;

create or replace function public._aplicar_codigo_descuento(p_tenant_id uuid, p_codigo text, p_paquete_id uuid, OUT v_descuento_pct integer, OUT v_codigo_id uuid)
returns record
language plpgsql security definer
set search_path to 'public'
as $$
begin
  select v.v_descuento_pct, v.v_codigo_id into v_descuento_pct, v_codigo_id from public._validar_codigo_descuento(p_tenant_id, p_codigo, p_paquete_id) v;
  if v_codigo_id is not null then
    update public.codigos_descuento set usos_actuales = usos_actuales + 1 where id = v_codigo_id;
  end if;
end;
$$;
revoke all on function public._aplicar_codigo_descuento(uuid, text, uuid) from public;
grant execute on function public._aplicar_codigo_descuento(uuid, text, uuid) to authenticated;

create or replace function public._codigo_valido_generico(p_tenant_id uuid, p_codigo text, OUT v_descuento_pct integer, OUT v_codigo_id uuid, OUT v_aplica_a text)
returns record
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_codigo record;
begin
  v_descuento_pct := 0; v_codigo_id := null; v_aplica_a := null;
  if p_codigo is null or trim(p_codigo) = '' then return; end if;

  select * into v_codigo from public.codigos_descuento
    where tenant_id = p_tenant_id and codigo = upper(trim(p_codigo)) and activo = true
      and (vigente_hasta is null or vigente_hasta >= public.hoy_en_sede(null))
      and (usos_maximos is null or usos_actuales < usos_maximos);
  if v_codigo is null then raise exception 'Código de descuento no válido o vencido'; end if;
  v_descuento_pct := v_codigo.descuento_pct; v_codigo_id := v_codigo.id; v_aplica_a := v_codigo.aplica_a;
end;
$$;
revoke all on function public._codigo_valido_generico(uuid, text) from public;
grant execute on function public._codigo_valido_generico(uuid, text) to authenticated;

create or replace function public.codigo_descuento_activo_para_canal(p_tenant_id uuid, p_canal text)
returns json
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_codigo record; v_paquetes text;
begin
  if p_canal is null then return null; end if;
  select cd.id, cd.codigo, cd.descuento_pct into v_codigo from public.codigos_descuento cd
    where cd.tenant_id = p_tenant_id and cd.auto_aplicar_canal = p_canal and cd.activo = true
      and (cd.vigente_hasta is null or cd.vigente_hasta >= public.hoy_en_sede(null))
      and (cd.usos_maximos is null or cd.usos_actuales < cd.usos_maximos)
    order by cd.created_at desc limit 1;
  if v_codigo is null then return null; end if;

  select string_agg(p.nombre, ', ' order by p.nombre) into v_paquetes
    from public.codigos_descuento_paquetes cdp join public.paquetes p on p.id = cdp.paquete_id
    where cdp.codigo_id = v_codigo.id;

  return json_build_object('codigo', v_codigo.codigo, 'descuento_pct', v_codigo.descuento_pct, 'paquete_nombre', v_paquetes);
end;
$$;
revoke all on function public.codigo_descuento_activo_para_canal(uuid, text) from public;
grant execute on function public.codigo_descuento_activo_para_canal(uuid, text) to authenticated, anon;

create or replace function public.codigo_descuento_por_canal(p_tenant_id uuid)
returns text
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_cliente_id uuid; v_canal text; v_codigo text;
begin
  select id, como_se_entero into v_cliente_id, v_canal from public.clientes where user_id = auth.uid() and tenant_id = p_tenant_id;
  if v_canal is null then return null; end if;

  select codigo into v_codigo from public.codigos_descuento cd
    where cd.tenant_id = p_tenant_id and cd.auto_aplicar_canal = v_canal and cd.activo = true
      and (cd.vigente_hasta is null or cd.vigente_hasta >= public.hoy_en_sede(null))
      and (cd.usos_maximos is null or cd.usos_actuales < cd.usos_maximos)
      and not exists (select 1 from public.membresias m where m.cliente_id = v_cliente_id and m.codigo_descuento_id = cd.id)
    order by cd.created_at desc limit 1;
  return v_codigo;
end;
$$;
revoke all on function public.codigo_descuento_por_canal(uuid) from public;
grant execute on function public.codigo_descuento_por_canal(uuid) to authenticated;
