-- Auditoría owner, 2.ª pasada: F-03 (etapas e hitos con evidencia o derivados de datos reales), F-07 (vínculos contrato/proyecto/estudio coherentes),
-- F-08 (alta de prospecto en una sola transacción), F-11 parcial (aplicar a la suscripción solo con contrato vigente).

-- F-08: empresa + contacto + oportunidad, todo o nada; si la empresa ya existe y no tiene oportunidad abierta, se reutiliza.
create or replace function public.prospecto_crear(
  p_nombre text, p_tipo text, p_ciudad text, p_sitio_web text, p_fuente text, p_valor numeric, p_num_sedes integer, p_plan_interes text, p_etapa text,
  p_proximo_paso text, p_proximo_paso_fecha date, p_contacto text, p_cargo text, p_telefono text, p_email text, p_excepcion text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp uuid; v_lead uuid; v_reusada boolean := false; v_abierta uuid;
begin
  if not public._plat_ok(array['ventas']) then raise exception 'No autorizado'; end if;
  select id into v_emp from public.plataforma_empresas where lower(nombre) = lower(trim(coalesce(p_nombre,''))) limit 1;
  if v_emp is not null then
    select id into v_abierta from public.plataforma_leads where empresa_id = v_emp and etapa not in ('ganado','perdido') limit 1;
    if v_abierta is not null then raise exception 'Ya hay una oportunidad abierta para esa empresa (/owner/pipeline/%). Ábrela en lugar de crear otra.', v_abierta; end if;
    v_reusada := true;
  else
    v_emp := public.empresa_guardar(null, p_nombre, p_tipo, p_ciudad, p_sitio_web, p_num_sedes, p_fuente, null);
  end if;
  if nullif(trim(coalesce(p_contacto,'')),'') is not null then
    perform public.contacto_guardar(null, v_emp, p_contacto, p_cargo, p_telefono, p_email, true);
  end if;
  v_lead := public.oportunidad_guardar(null, v_emp, p_valor, p_etapa, p_plan_interes, p_num_sedes, null, p_proximo_paso, p_proximo_paso_fecha, p_fuente, null, null, p_excepcion);
  return jsonb_build_object('empresa_id', v_emp, 'lead_id', v_lead, 'empresa_reutilizada', v_reusada);
end $$;
revoke all on function public.prospecto_crear(text,text,text,text,text,numeric,integer,text,text,text,date,text,text,text,text,text) from public, anon;
grant execute on function public.prospecto_crear(text,text,text,text,text,numeric,integer,text,text,text,date,text,text,text,text,text) to authenticated;

-- F-07: el contrato solo se vincula a un estudio coherente con su empresa, y no se cambia el estudio de un contrato firmado.
create or replace function public.contrato_actualizar(p_id uuid, p_estado text, p_tenant_id uuid, p_renovacion_auto boolean, p_documento_url text, p_notas text)
returns void language plpgsql security definer set search_path = public as $$
declare v_c record; v_emp_t uuid;
begin
  if not public._plat_ok(array['ventas','finanzas']) then raise exception 'No autorizado'; end if;
  select * into v_c from public.plataforma_contratos where id = p_id;
  if v_c is null then raise exception 'Contrato no encontrado'; end if;
  if p_tenant_id is distinct from v_c.tenant_id then
    if v_c.estado in ('firmado','vigente') and v_c.tenant_id is not null then raise exception 'No se cambia el estudio de un contrato firmado o vigente: cancélalo y crea uno nuevo'; end if;
    if p_tenant_id is not null then
      if not exists (select 1 from public.tenants where id = p_tenant_id) then raise exception 'El estudio no existe'; end if;
      select e.tenant_id into v_emp_t from public.plataforma_leads l join public.plataforma_empresas e on e.id = l.empresa_id where l.id = v_c.lead_id;
      if v_emp_t is not null and v_emp_t <> p_tenant_id then raise exception 'Ese contrato pertenece a una empresa ya vinculada a otro estudio'; end if;
      if exists (select 1 from public.plataforma_contratos where tenant_id = p_tenant_id and id <> p_id and estado in ('firmado','vigente')) then
        raise exception 'Ese estudio ya tiene un contrato firmado o vigente'; end if;
    end if;
  end if;
  update public.plataforma_contratos set tenant_id = p_tenant_id, renovacion_auto = coalesce(p_renovacion_auto, renovacion_auto),
    documento_url = p_documento_url, notas = p_notas where id = p_id;
  if p_estado is distinct from v_c.estado then perform public.contrato_estado(p_id, p_estado, null, null, p_notas); end if;
end $$;

-- F-03: «firmado» exige el documento o una excepción con motivo; la firma legal no es solo un botón.
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='contrato_estado';
  d := replace(d, E'  if p_estado = ''cancelado'' and length', E'  if p_estado = ''firmado'' and nullif(trim(coalesce(v_c.documento_url,'''')),'''') is null and length(trim(coalesce(p_motivo,''''))) < 10 then\n    raise exception ''Para marcarlo como firmado adjunta el enlace al documento firmado, o escribe una excepción con motivo (mínimo 10 caracteres)'';\n  end if;\n  if p_estado = ''cancelado'' and length');
  if d not like '%adjunta el enlace al documento%' then raise exception 'no se pudo parchear contrato_estado'; end if;
  execute d;
end $$;

-- F-11 parcial: aplicar el contrato a la suscripción solo si está vigente y vinculado a un estudio.
create or replace function public.contrato_aplicar_suscripcion(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_c record;
begin
  if not public._plat_ok(array['finanzas']) then raise exception 'No autorizado'; end if;
  select * into v_c from public.plataforma_contratos where id = p_id;
  if v_c is null then raise exception 'Contrato no encontrado'; end if;
  if v_c.estado <> 'vigente' then raise exception 'Solo un contrato vigente se aplica a la suscripción (estado actual: %)', v_c.estado; end if;
  if v_c.tenant_id is null then raise exception 'Vincula primero el contrato a un estudio'; end if;
  perform public._aplicar_contrato(p_id, not exists (select 1 from public.plataforma_proyectos where tenant_id = v_c.tenant_id and estado = 'en_curso'));
end $$;

-- F-07: vincular un proyecto a un estudio: solo operador, proyecto en curso, estudio existente y no ocupado por otra empresa.
create or replace function public.proyecto_vincular_estudio(p_id uuid, p_tenant_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_p record; v_emp_t uuid;
begin
  if not public._plat_ok(array[]::text[]) then raise exception 'No autorizado (solo operador)'; end if;
  select * into v_p from public.plataforma_proyectos where id = p_id;
  if v_p is null then raise exception 'Proyecto no encontrado'; end if;
  if v_p.estado <> 'en_curso' then raise exception 'El proyecto ya no está en curso'; end if;
  if not exists (select 1 from public.tenants where id = p_tenant_id) then raise exception 'El estudio no existe'; end if;
  select tenant_id into v_emp_t from public.plataforma_empresas where id = v_p.empresa_id;
  if v_emp_t is not null and v_emp_t <> p_tenant_id then raise exception 'La empresa de este proyecto ya está vinculada a otro estudio'; end if;
  if exists (select 1 from public.plataforma_empresas where tenant_id = p_tenant_id and id is distinct from v_p.empresa_id) then raise exception 'Ese estudio ya está vinculado a otra empresa'; end if;
  update public.plataforma_proyectos set tenant_id = p_tenant_id where id = p_id;
  update public.plataforma_empresas set tenant_id = p_tenant_id where id = v_p.empresa_id;
end $$;

-- F-03: etapas del checklist. Las que se pueden comprobar con datos se derivan; las demás exigen evidencia escrita y registran quién y cuándo.
drop function if exists public.proyecto_etapa(uuid, text, boolean);
create or replace function public.proyecto_etapa(p_id uuid, p_key text, p_hecha boolean, p_evidencia text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_p record; v_ok boolean := true; v_msg text; v_quien text;
begin
  if not public._plat_ok(array['ventas','soporte']) then raise exception 'No autorizado'; end if;
  select * into v_p from public.plataforma_proyectos where id = p_id;
  if v_p is null or v_p.estado <> 'en_curso' then raise exception 'Proyecto no encontrado o ya no está en curso'; end if;
  if p_hecha then
    case p_key
      when 'contrato' then v_ok := v_p.tenant_id is not null and exists (select 1 from public.plataforma_contratos where tenant_id = v_p.tenant_id and estado = 'vigente'); v_msg := 'No hay un contrato vigente vinculado al estudio';
      when 'estudio'  then v_ok := v_p.tenant_id is not null and (exists (select 1 from public.tenant_memberships where tenant_id = v_p.tenant_id and role = 'duena') or exists (select 1 from public.invitaciones_personal where tenant_id = v_p.tenant_id and role = 'duena')); v_msg := 'El estudio no está vinculado o no tiene dueña invitada';
      when 'plan'     then v_ok := v_p.tenant_id is not null and exists (select 1 from public.plataforma_suscripciones where tenant_id = v_p.tenant_id); v_msg := 'El estudio no tiene suscripción asignada';
      when 'sedes'    then v_ok := v_p.tenant_id is not null and exists (select 1 from public.sedes where tenant_id = v_p.tenant_id); v_msg := 'El estudio no tiene sedes';
      when 'catalogo' then v_ok := v_p.tenant_id is not null and exists (select 1 from public.paquetes where tenant_id = v_p.tenant_id) and exists (select 1 from public.horarios where tenant_id = v_p.tenant_id); v_msg := 'Faltan paquetes o clases cargados en el estudio';
      else v_ok := length(trim(coalesce(p_evidencia,''))) >= 10; v_msg := 'Esta etapa no se puede comprobar sola: escribe la evidencia (mínimo 10 caracteres: qué se hizo, dónde se ve)';
    end case;
    if not v_ok then raise exception '%', v_msg; end if;
  end if;
  select coalesce(nombre, 'staff') into v_quien from public.plataforma_staff where user_id = auth.uid();
  update public.plataforma_proyectos p set etapas = (
    select jsonb_agg(case when e->>'key' = p_key then e || jsonb_build_object('hecha', p_hecha, 'fecha', now(), 'por', v_quien,
         'evidencia', case when p_hecha then nullif(trim(coalesce(p_evidencia,'')),'') else null end) else e end)
    from jsonb_array_elements(p.etapas) e) where p.id = p_id;
end $$;
revoke all on function public.proyecto_etapa(uuid,text,boolean,text) from public, anon;
grant execute on function public.proyecto_etapa(uuid,text,boolean,text) to authenticated;
