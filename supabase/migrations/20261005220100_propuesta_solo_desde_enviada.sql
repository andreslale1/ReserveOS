-- Una propuesta solo puede aceptarse o perderse después de enviarse.
create or replace function public.propuesta_estado(p_id uuid, p_estado text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_p record; v_e record;
begin
  if not public._plat_ok(array['ventas']) then raise exception 'No autorizado'; end if;
  if p_estado not in ('enviada','negociando','aceptada','perdida') then raise exception 'Estado no válido'; end if;
  select * into v_p from public.plataforma_propuestas where id = p_id;
  if v_p is null or v_p.estado in ('reemplazada','aceptada','perdida') then raise exception 'La propuesta ya no admite cambios (crea una versión nueva)'; end if;
  if p_estado in ('aceptada','perdida') and v_p.estado = 'borrador' then raise exception 'Primero marca la propuesta como enviada'; end if;
  update public.plataforma_propuestas set estado = p_estado where id = p_id;
  if p_estado in ('enviada','negociando') then
    update public.plataforma_leads set etapa = case when etapa in ('prospecto','demo') then 'propuesta' else etapa end, updated_at = now() where id = v_p.lead_id;
  elsif p_estado = 'aceptada' then
    update public.plataforma_leads set etapa = 'ganado', valor_mensual = v_p.mensualidad, updated_at = now() where id = v_p.lead_id;
    select empresa_id, nombre into v_e from public.plataforma_leads where id = v_p.lead_id;
    if not exists (select 1 from public.plataforma_proyectos where lead_id = v_p.lead_id) then
      insert into public.plataforma_proyectos (empresa_id, lead_id, nombre, etapas)
        values (v_e.empresa_id, v_p.lead_id, 'Alta de ' || v_e.nombre, public._plantilla_etapas_alta());
    end if;
  end if;
end $$;
