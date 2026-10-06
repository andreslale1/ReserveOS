-- WEB-01: dominio propio por estudio. El estudio se resuelve por HOST VERIFICADO (nunca por un parámetro que el
-- navegador pueda manipular). Flujo: la dueña solicita el dominio, el operador comprueba DNS y lo activa, la baja
-- libera el dominio. Un host desconocido o sin verificar no revela ningún estudio.

alter table public.tenant_domains
  add column if not exists solicitado_at timestamptz not null default now(),
  add column if not exists verificado_at timestamptz;

-- Pública (la usa el proxy antes de saber quién es la persona): solo devuelve datos mínimos y solo si está verificado.
create or replace function public.tenant_por_dominio(p_host text)
returns json language sql stable security definer set search_path to 'public' as $$
  select json_build_object('tenant_id', t.id, 'slug', t.slug, 'nombre', t.name)
  from public.tenant_domains d join public.tenants t on t.id = d.tenant_id
  where d.domain = lower(trim(p_host)) and d.verified and t.status = 'activo' limit 1;
$$;
revoke all on function public.tenant_por_dominio(text) from public;
grant execute on function public.tenant_por_dominio(text) to anon, authenticated;

create or replace function public.dominio_solicitar(p_tenant_id uuid, p_domain text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_d text := lower(trim(p_domain)); v_id uuid;
begin
  if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then raise exception 'No autorizado'; end if;
  perform public._exigir_modulo(p_tenant_id, 'portal_marca');
  if v_d !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$' then raise exception 'Escribe un dominio válido, por ejemplo reservas.tuestudio.com'; end if;
  if v_d = 'reserveos.app' or v_d like '%.reserveos.app' or v_d like '%.vercel.app' then raise exception 'Ese dominio no se puede usar'; end if;
  if exists (select 1 from public.tenant_domains where domain = v_d) then raise exception 'Ese dominio ya está registrado'; end if;
  if (select count(*) from public.tenant_domains where tenant_id = p_tenant_id) >= 3 then raise exception 'Máximo 3 dominios por estudio'; end if;
  insert into public.tenant_domains (tenant_id, domain, verified) values (p_tenant_id, v_d, false) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.dominio_solicitar(uuid, text) from public;
grant execute on function public.dominio_solicitar(uuid, text) to authenticated;

create or replace function public.dominio_baja(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v record;
begin
  select * into v from public.tenant_domains where id = p_id;
  if v is null then raise exception 'Dominio no encontrado'; end if;
  if not (public.tengo_rol_en_tenant(v.tenant_id, array['duena','gerente_general']) or public.soy_staff_plataforma()) then raise exception 'No autorizado'; end if;
  delete from public.tenant_domains where id = p_id;
end $$;
revoke all on function public.dominio_baja(uuid) from public;
grant execute on function public.dominio_baja(uuid) to authenticated;

create or replace function public.dominio_verificar(p_id uuid, p_verificado boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.soy_staff_plataforma() then raise exception 'Solo el operador activa dominios'; end if;
  update public.tenant_domains set verified = p_verificado, verificado_at = case when p_verificado then now() else null end where id = p_id;
  if not found then raise exception 'Dominio no encontrado'; end if;
end $$;
revoke all on function public.dominio_verificar(uuid, boolean) from public;
grant execute on function public.dominio_verificar(uuid, boolean) to authenticated;

create or replace function public.dominios_plataforma()
returns table(id uuid, estudio text, domain text, verified boolean, solicitado_at timestamptz, verificado_at timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._plat_ok(array['soporte']) then raise exception 'No autorizado'; end if;
  return query select d.id, t.name, d.domain, d.verified, d.solicitado_at, d.verificado_at
    from public.tenant_domains d join public.tenants t on t.id = d.tenant_id order by d.verified, d.solicitado_at desc;
end $$;
revoke all on function public.dominios_plataforma() from public;
grant execute on function public.dominios_plataforma() to authenticated;
