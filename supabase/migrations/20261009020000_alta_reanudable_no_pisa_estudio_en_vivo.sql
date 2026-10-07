-- Reanudar el alta de un estudio que ya salió en vivo no vuelve a aplicar el plan ni a reescribir sus módulos habilitados.
create or replace function public.alta_estudio_desde_contrato(p_contrato_id uuid, p_slug text, p_name text, p_sede_nombre text,
  p_timezone text default 'America/Guatemala', p_email_duena text default null, p_nombre_duena text default null, p_confirmar_duplicado boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_c record; v_tenant uuid; v_sede uuid; v_proy uuid; v_token uuid; v_reanudado boolean := false; v_plan text; v_vivo boolean;
begin
  if not public._plat_ok(array['soporte']) then raise exception 'No autorizado'; end if;
  select * into v_c from public.plataforma_contratos where id = p_contrato_id for update;
  if v_c is null then raise exception 'Contrato no encontrado'; end if;
  if v_c.estado <> 'vigente' then raise exception 'El contrato está en estado "%": el alta se hace con un contrato vigente', v_c.estado; end if;

  if v_c.tenant_id is not null then
    v_tenant := v_c.tenant_id; v_reanudado := true;
    select id into v_sede from public.sedes where tenant_id = v_tenant order by created_at limit 1;
  else
    perform public._alta_validar(p_slug, p_name, p_email_duena, p_confirmar_duplicado);
    if p_sede_nombre is null or length(trim(p_sede_nombre)) < 2 then raise exception 'Escribe el nombre de la primera sede'; end if;
    insert into public.tenants (slug, name, status) values (lower(trim(p_slug)), trim(p_name), public._status_borrador()) returning id into v_tenant;
    insert into public.sedes (tenant_id, name, timezone) values (v_tenant, trim(p_sede_nombre), coalesce(p_timezone,'America/Guatemala')) returning id into v_sede;
    update public.plataforma_contratos set tenant_id = v_tenant where id = p_contrato_id;
  end if;

  select id into v_proy from public.plataforma_proyectos where lead_id = v_c.lead_id order by created_at limit 1;
  if v_proy is null then
    insert into public.plataforma_proyectos (empresa_id, lead_id, nombre, etapas)
      values ((select empresa_id from public.plataforma_leads where id = v_c.lead_id), v_c.lead_id,
              'Alta de ' || coalesce((select nombre from public.plataforma_leads where id = v_c.lead_id), p_name), public._plantilla_etapas_alta())
      returning id into v_proy;
  end if;
  update public.plataforma_proyectos set tenant_id = v_tenant, email_duena = coalesce(nullif(lower(trim(p_email_duena)),''), email_duena) where id = v_proy;
  update public.plataforma_empresas set tenant_id = v_tenant where id = (select empresa_id from public.plataforma_proyectos where id = v_proy);

  -- plan y suscripción en pausa hasta salir en vivo; módulos del plan habilitados (no se reaplica a un estudio que ya está en vivo)
  select estado = 'en_vivo' into v_vivo from public.plataforma_proyectos where id = v_proy;
  if not coalesce(v_vivo, false) then
    perform public._aplicar_contrato(p_contrato_id, false);
    select plan into v_plan from public.plataforma_suscripciones where tenant_id = v_tenant;
    perform public.aplicar_plan_tenant(v_tenant, v_plan, 'Alta desde contrato');
    perform public.proyecto_etapa(v_proy, 'contrato', true);
    perform public.proyecto_etapa(v_proy, 'plan', true);
  end if;

  if nullif(trim(coalesce(p_email_duena,'')),'') is not null
     and not exists (select 1 from public.tenant_memberships where tenant_id = v_tenant)
     and not exists (select 1 from public.invitaciones_personal where tenant_id = v_tenant and role = 'duena' and lower(email) = lower(trim(p_email_duena))) then
    v_token := public.invitar_primera_duena_plataforma(v_tenant, p_email_duena, coalesce(nullif(trim(p_nombre_duena),''), 'Dueña'));
    perform public.proyecto_etapa(v_proy, 'estudio', true);
  end if;
  return jsonb_build_object('tenant_id', v_tenant, 'sede_id', v_sede, 'proyecto_id', v_proy, 'token', v_token, 'reanudado', v_reanudado);
end $$;
revoke all on function public.alta_estudio_desde_contrato(uuid, text, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.alta_estudio_desde_contrato(uuid, text, text, text, text, text, text, boolean) to authenticated;
