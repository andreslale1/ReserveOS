-- Gastos operativos vs de preinversión (los de preinversión no entran en el IVA, ni en el margen operativo, ni en la utilidad acumulada) y gasto de marketing por canal.
alter table public.gastos add column if not exists etapa text not null default 'operativo';
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='public.gastos'::regclass and conname='gastos_etapa_check') then
    alter table public.gastos add constraint gastos_etapa_check check (etapa in ('operativo','preinversion'));
  end if;
end $$;

drop function if exists public.registrar_gasto(uuid,uuid,date,text,text,numeric,text,text);
create or replace function public.registrar_gasto(p_tenant_id uuid, p_sede_id uuid, p_fecha date, p_categoria text, p_descripcion text, p_monto numeric, p_tipo text,
  p_metodo_pago text default null, p_etapa text default 'operativo')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_sede_id is not null then
    if not exists (select 1 from public.sedes where id = p_sede_id and tenant_id = p_tenant_id) then raise exception 'Sede no válida'; end if;
    perform public._exigir_accion(p_tenant_id, p_sede_id, 'P35');
    if not public.staff_puede_en_sede(p_tenant_id, p_sede_id, array['admin_sede','contadora','duena','gerente_general','gerente_regional','recepcion']) then raise exception 'No autorizado'; end if;
  elsif not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general','contadora']) then
    raise exception 'No autorizado';
  end if;
  if p_monto is null or p_monto <= 0 then raise exception 'El monto debe ser mayor a 0'; end if;
  if p_tipo not in ('fijo','variable') then raise exception 'Tipo de gasto no válido'; end if;
  if coalesce(p_etapa,'operativo') not in ('operativo','preinversion') then raise exception 'Etapa de gasto no válida'; end if;
  if p_categoria is null or length(trim(p_categoria)) = 0 then raise exception 'La categoría es obligatoria'; end if;
  insert into public.gastos (tenant_id, sede_id, fecha, categoria, descripcion, monto, tipo, metodo_pago, etapa)
    values (p_tenant_id, p_sede_id, p_fecha, trim(p_categoria), nullif(trim(coalesce(p_descripcion,'')),''), p_monto, p_tipo, p_metodo_pago, coalesce(p_etapa,'operativo'))
    returning id into v_id;
  insert into public.admin_acciones_log (tenant_id, actor_id, actor_nombre, tabla, operacion, registro_id, detalle)
    values (p_tenant_id, auth.uid(), public._nombre_actor(p_tenant_id), 'gastos', 'insert', v_id::text,
            jsonb_build_object('monto', p_monto, 'categoria', p_categoria, 'fecha', p_fecha, 'etapa', coalesce(p_etapa,'operativo')));
  return v_id;
end $$;
revoke all on function public.registrar_gasto(uuid,uuid,date,text,text,numeric,text,text,text) from public, anon;
grant execute on function public.registrar_gasto(uuid,uuid,date,text,text,numeric,text,text,text) to authenticated;

do $$
declare f text; d text;
begin
  foreach f in array array['kpi_iva_resumen','kpi_finanzas_resumen','kpi_balance_general'] loop
    select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname=f;
    d := regexp_replace(d, 'from public\.gastos\s+where tenant_id = p_tenant_id', 'from public.gastos where etapa = ''operativo'' and tenant_id = p_tenant_id', 'g');
    if d not like '%etapa = ''operativo''%' then raise exception 'no se pudo parchear %', f; end if;
    execute d;
  end loop;
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='centro_mando';
  d := replace(d, 'where g.tenant_id = p_tenant_id and g.fecha between v_mes and v_fin', 'where g.etapa = ''operativo'' and g.tenant_id = p_tenant_id and g.fecha between v_mes and v_fin');
  if d not like '%g.etapa = ''operativo''%' then raise exception 'no se pudo parchear centro_mando'; end if;
  execute d;
end $$;

create or replace function public.registrar_gasto_marketing(p_tenant_id uuid, p_mes date, p_canal text, p_monto numeric)
returns void language plpgsql security definer set search_path = public as $$
declare v_mes date := date_trunc('month', p_mes)::date;
begin
  if not public._es_g(p_tenant_id) then raise exception 'No autorizado'; end if;
  if nullif(trim(coalesce(p_canal,'')),'') is null then raise exception 'Indica el canal'; end if;
  if p_monto is null or p_monto < 0 then raise exception 'El monto no puede ser negativo'; end if;
  update public.gasto_marketing set monto = p_monto, updated_at = now() where tenant_id = p_tenant_id and mes = v_mes and canal = trim(p_canal);
  if not found then insert into public.gasto_marketing (tenant_id, mes, canal, monto) values (p_tenant_id, v_mes, trim(p_canal), p_monto); end if;
end $$;
revoke all on function public.registrar_gasto_marketing(uuid,date,text,numeric) from public, anon;
grant execute on function public.registrar_gasto_marketing(uuid,date,text,numeric) to authenticated;
