-- Ajustes del Agente C: nombre propio para la lista de riesgo de fuga (ya existía una función con otro formato) y alcance coherente de clientas con paquete.
drop function if exists public.clientas_riesgo_fuga(uuid,integer,uuid);
create or replace function public.clientas_riesgo_fuga_lista(p_tenant_id uuid, p_dias integer default 14, p_sede_id uuid default null)
returns table(cliente_id uuid, nombre text, telefono text, email text, ultima_visita date, dias_sin_venir integer, membresia_vence date, clases_restantes integer, sede text)
language sql stable security invoker set search_path = public as $$
  with hoy as (select public.hoy_en_sede(null) h)
  select c.id, c.nombre, c.telefono, c.email, uv.f, (hoy.h - coalesce(uv.f, m.fecha_inicio))::int, m.fecha_vencimiento,
         case when m.clases_totales is null then null else m.clases_totales - coalesce(m.clases_usadas,0) end, s.name
    from public.clientes c
    cross join hoy
    join lateral (select * from public.membresias mm where mm.cliente_id = c.id and mm.estado = 'activa' and mm.pagada
                   and mm.fecha_vencimiento >= hoy.h and (mm.clases_totales is null or mm.clases_usadas < mm.clases_totales)
                   order by mm.fecha_vencimiento desc limit 1) m on true
    left join lateral (select max(r.fecha) f from public.reservas r where r.cliente_id = c.id and r.estado = 'confirmada' and r.fecha <= hoy.h and r.asistio is distinct from false) uv on true
    left join public.sedes s on s.id = c.sede_habitual_id
   where c.tenant_id = p_tenant_id and c.tutor_id is null and not coalesce(c.es_mostrador,false)
     and (p_sede_id is null or c.sede_habitual_id = p_sede_id)
     and not exists (select 1 from public.reservas r2 where r2.cliente_id = c.id and r2.estado = 'confirmada' and r2.fecha > hoy.h)
     and (hoy.h - coalesce(uv.f, m.fecha_inicio)) >= p_dias
   order by 6 desc;
$$;

create or replace function public.centro_mando(p_tenant_id uuid, p_sede_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_rol text := public._mi_rol(p_tenant_id); v_g boolean := public._es_g(p_tenant_id);
  v_hoy date := public.hoy_en_sede(null); v_mes date := date_trunc('month', public.hoy_en_sede(null))::date;
  v_fin date := (date_trunc('month', public.hoy_en_sede(null)) + interval '1 month - 1 day')::date;
  v_perm uuid[]; v_sedes uuid[]; v_todas boolean;
  v_res jsonb; v_cl_clause text;
  n_leads int; n_sinpw int; n_cons int; n_vencer int; n_tot int; n_nuevas int; n_pq int; n_sinacc int;
  v_ocup jsonb; v_enc jsonb; v_ing jsonb; v_gastos numeric;
begin
  if v_rol is null or v_rol not in ('duena','gerente_general','contadora','admin_sede','gerente_regional') then raise exception 'No autorizado'; end if;
  v_perm := case when v_g or v_rol = 'contadora' then (select array_agg(id) from public.sedes where tenant_id = p_tenant_id) else public._mis_sedes(p_tenant_id) end;
  if p_sede_id is not null and not (p_sede_id = any(coalesce(v_perm, '{}'))) then raise exception 'No autorizado para esa sede'; end if;
  v_sedes := case when p_sede_id is not null then array[p_sede_id] else v_perm end;
  v_todas := p_sede_id is null and (v_g or v_rol = 'contadora');   -- todo el estudio, incluido lo que no tiene sede
  v_res := jsonb_build_object('rol', v_rol, 'sede_id', p_sede_id, 'hoy', v_hoy, 'mes', v_mes);

  -- Finanzas (dueña, gerencia, contabilidad y, de sus sedes, administradoras y gerencia regional)
  v_ing := public._ingreso_confirmado(p_tenant_id, v_mes, v_fin, case when v_todas then null else v_sedes end);
  select coalesce(sum(g.monto),0) into v_gastos from public.gastos g
   where g.tenant_id = p_tenant_id and g.fecha between v_mes and v_fin and (v_todas or g.sede_id = any(v_sedes));
  v_res := v_res || jsonb_build_object('finanzas', v_ing || jsonb_build_object('gastos', v_gastos, 'utilidad', (v_ing->>'neto')::numeric - v_gastos));
  if v_rol = 'contadora' then return v_res; end if;   -- la contadora no ve datos de clientas

  -- Alertas
  select count(*) into n_leads from public.clientes c
   where c.tenant_id = p_tenant_id and c.tutor_id is null and (v_todas or c.sede_habitual_id = any(v_sedes))
     and exists (select 1 from public.reservas r where r.cliente_id = c.id and r.tipo = 'prueba' and r.estado <> 'cancelada' and r.fecha >= v_hoy - 30)
     and not exists (select 1 from public.membresias m where m.cliente_id = c.id and m.pagada);
  select count(*) into n_sinpw from public.clientes c
   where c.tenant_id = p_tenant_id and c.user_id is null and c.tutor_id is null and not coalesce(c.es_mostrador,false) and (v_todas or c.sede_habitual_id = any(v_sedes));
  select count(*) into n_cons from public.clientes c
   where c.tenant_id = p_tenant_id and c.tutor_id is null and not coalesce(c.es_mostrador,false) and c.consentimiento_completado_at is null and (v_todas or c.sede_habitual_id = any(v_sedes));
  select count(*) into n_vencer from public.membresias m
   where m.tenant_id = p_tenant_id and m.estado = 'activa' and m.pagada and m.fecha_vencimiento between v_hoy and v_hoy + 7 and (v_todas or m.sede_venta_id = any(v_sedes));
  v_res := v_res || jsonb_build_object('alertas', jsonb_build_object('leads_sin_contactar', n_leads, 'cuentas_sin_acceso', n_sinpw, 'consentimientos_pendientes', n_cons, 'paquetes_por_vencer', n_vencer));

  -- Clientas
  select count(*), count(*) filter (where c.created_at::date >= v_hoy - 30) into n_tot, n_nuevas from public.clientes c
   where c.tenant_id = p_tenant_id and c.tutor_id is null and not coalesce(c.es_mostrador,false) and (v_todas or c.sede_habitual_id = any(v_sedes));
  select count(distinct m.cliente_id) into n_pq from public.membresias m join public.clientes c on c.id = m.cliente_id
   where m.tenant_id = p_tenant_id and m.estado = 'activa' and m.pagada and m.fecha_vencimiento >= v_hoy and c.tutor_id is null and not coalesce(c.es_mostrador,false)
     and (v_todas or c.sede_habitual_id = any(v_sedes));
  v_res := v_res || jsonb_build_object('clientas', jsonb_build_object('total', n_tot, 'nuevas_30d', n_nuevas, 'con_paquete_activo', n_pq, 'sin_paquete', greatest(n_tot - n_pq, 0)));

  -- Operación: ocupación de los últimos 30 días y horarios más / menos llenos
  select jsonb_build_object(
      'ocupacion_pct', case when sum(x.cupo) > 0 then round(100.0 * sum(x.reservas) / sum(x.cupo), 1) end,
      'clases', count(*), 'reservas', coalesce(sum(x.reservas),0), 'cupo', coalesce(sum(x.cupo),0)) into v_ocup
    from (select r.horario_id, r.fecha, count(*) reservas, max(h.cupo_maximo) cupo from public.reservas r join public.horarios h on h.id = r.horario_id
           where r.tenant_id = p_tenant_id and r.estado = 'confirmada' and r.fecha between v_hoy - 30 and v_hoy and (v_todas or r.sede_id = any(v_sedes))
           group by r.horario_id, r.fecha) x;
  v_ocup := v_ocup || jsonb_build_object('horarios', coalesce((
      select jsonb_agg(z order by z.ocupacion_pct desc nulls last) from (
        select h.nombre_clase, h.dia_semana, h.hora_inicio, s.name sede,
               round(100.0 * sum(q.reservas) / nullif(sum(h.cupo_maximo),0), 1) ocupacion_pct
          from (select r.horario_id, r.fecha, count(*) reservas from public.reservas r
                 where r.tenant_id = p_tenant_id and r.estado = 'confirmada' and r.fecha between v_hoy - 30 and v_hoy and (v_todas or r.sede_id = any(v_sedes)) group by 1,2) q
          join public.horarios h on h.id = q.horario_id join public.sedes s on s.id = h.sede_id
         group by h.id, h.nombre_clase, h.dia_semana, h.hora_inicio, s.name) z), '[]'::jsonb));
  v_res := v_res || jsonb_build_object('operacion', v_ocup);

  -- Solo dueña y gerencia general: metas, retención, adquisición, encuestas
  if v_g then
    v_res := v_res || jsonb_build_object('metas', public.metas_avance(p_tenant_id, v_mes));
    v_res := v_res || jsonb_build_object('retencion', coalesce(public.kpi_retencion(p_tenant_id)::jsonb, '{}'::jsonb)
      || jsonb_build_object('riesgo_fuga', (select count(*) from public.clientas_riesgo_fuga_lista(p_tenant_id, 14, p_sede_id))));
    v_res := v_res || jsonb_build_object('adquisicion', coalesce((select jsonb_agg(to_jsonb(a)) from public.kpi_adquisicion(p_tenant_id, 3) a), '[]'::jsonb));
    select jsonb_build_object('respuestas', count(*), 'satisfaccion_prom', round(avg(e.satisfaccion)::numeric, 2),
             'recomendaria_pct', case when count(*) filter (where e.recomendaria is not null) > 0 then round(100.0 * count(*) filter (where e.recomendaria) / count(*) filter (where e.recomendaria is not null), 1) end,
             'comentarios', coalesce((select jsonb_agg(jsonb_build_object('fecha', e2.created_at::date, 'satisfaccion', e2.satisfaccion, 'comentario', e2.comentario) order by e2.created_at desc)
                  from (select * from public.encuestas_satisfaccion where tenant_id = p_tenant_id and nullif(trim(comentario),'') is not null order by created_at desc limit 5) e2), '[]'::jsonb))
      into v_enc from public.encuestas_satisfaccion e where e.tenant_id = p_tenant_id and e.created_at >= now() - interval '90 days';
    v_res := v_res || jsonb_build_object('encuestas', v_enc);
  end if;
  return v_res;
end $$;


revoke all on function public.clientas_riesgo_fuga_lista(uuid,integer,uuid) from public, anon;
grant execute on function public.clientas_riesgo_fuga_lista(uuid,integer,uuid) to authenticated;
revoke all on function public.centro_mando(uuid,uuid) from public, anon;
grant execute on function public.centro_mando(uuid,uuid) to authenticated;
