-- Agente C: centro de mando, UNA regla de ingreso confirmado, metas, riesgo de fuga, ficha de clienta, carritos.

-- ============ 1. UNA sola regla de ingreso confirmado ============
-- bruto = membresías pagadas (por fecha de confirmación) + pedidos pagados/entregados + cobros personalizados
-- devoluciones = membresías pagadas y luego anuladas (por fecha de anulación; monto reembolsado, o el precio si no hubo reembolso registrado)
-- neto = bruto - devoluciones. p_sedes null = todas (incluye lo que no tiene sede).
create or replace function public._ingreso_confirmado(p_tenant_id uuid, p_desde date, p_hasta date, p_sedes uuid[] default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with paq as (
    select coalesce(sum(coalesce(m.precio_final,0)),0) v from public.membresias m
     where m.tenant_id = p_tenant_id and m.pagada and m.confirmado_at::date between p_desde and p_hasta
       and (p_sedes is null or m.sede_venta_id = any(p_sedes))),
  tie as (
    select coalesce(sum(p.total),0) v from public.pedidos p
     where p.tenant_id = p_tenant_id and p.estado in ('pagado','entregado') and p.pagado_at::date between p_desde and p_hasta
       and (p_sedes is null or p.sede_entrega_id = any(p_sedes))),
  otr as (
    select coalesce(sum(c.monto),0) v from public.cobros_personalizados c
     where c.tenant_id = p_tenant_id and c.confirmado_at::date between p_desde and p_hasta
       and (p_sedes is null or c.sede_id = any(p_sedes))),
  dev as (
    select coalesce(sum(coalesce((select r.monto from public.reembolsos r where r.membresia_id = m.id and r.estado in ('aprobado','devuelto') limit 1), m.precio_final, 0)),0) v
      from public.membresias m
     where m.tenant_id = p_tenant_id and m.pagada and m.estado = 'anulada' and m.anulada_at::date between p_desde and p_hasta
       and (p_sedes is null or m.sede_venta_id = any(p_sedes)))
  select jsonb_build_object('paquetes', paq.v, 'tienda', tie.v, 'otros', otr.v, 'bruto', paq.v + tie.v + otr.v,
                            'devoluciones', dev.v, 'neto', paq.v + tie.v + otr.v - dev.v)
    from paq, tie, otr, dev;
$$;
revoke all on function public._ingreso_confirmado(uuid,date,date,uuid[]) from public, anon, authenticated;

-- Los tres resúmenes históricos pasan a usar la misma regla.
do $$
declare d text; nuevo_ing text;
begin
  -- kpi_finanzas_resumen
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='kpi_finanzas_resumen';
  d := regexp_replace(d, 'select coalesce\(sum\(coalesce\(m\.precio_final.*?v_ingresos := v_ingresos_membresias \+ v_ingresos_productos;',
    E'declare_ic jsonb := public._ingreso_confirmado(p_tenant_id, p_desde, p_hasta, null);\n  v_ingresos_productos := (declare_ic->>''tienda'')::numeric;\n  v_ingresos_membresias := (declare_ic->>''paquetes'')::numeric + (declare_ic->>''otros'')::numeric - (declare_ic->>''devoluciones'')::numeric;\n  v_ingresos := (declare_ic->>''neto'')::numeric;', 'ns');
  d := replace(d, 'declare_ic jsonb := ', 'v_ic := ');
  d := replace(d, 'declare_ic->', 'v_ic->');
  d := regexp_replace(d, '\mdeclare\M', 'declare v_ic jsonb;');
  if d not like '%_ingreso_confirmado%' then raise exception 'no se pudo parchear kpi_finanzas_resumen'; end if;
  execute d;

  -- kpi_iva_resumen
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='kpi_iva_resumen';
  d := regexp_replace(d, 'select coalesce\(sum\(coalesce\(m\.precio_final.*?v_ingresos := v_ingresos_membresias \+ v_ingresos_productos;',
    E'v_ic := public._ingreso_confirmado(p_tenant_id, p_desde, p_hasta, null);\n  v_ingresos_productos := (v_ic->>''tienda'')::numeric;\n  v_ingresos_membresias := (v_ic->>''paquetes'')::numeric + (v_ic->>''otros'')::numeric - (v_ic->>''devoluciones'')::numeric;\n  v_ingresos := (v_ic->>''neto'')::numeric;', 'ns');
  d := regexp_replace(d, '\mdeclare\M', 'declare v_ic jsonb;');
  if d not like '%_ingreso_confirmado%' then raise exception 'no se pudo parchear kpi_iva_resumen'; end if;
  execute d;

  -- kpi_balance_general
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='kpi_balance_general';
  d := regexp_replace(d, 'select coalesce\(sum\(coalesce\(m\.precio_final.*?v_utilidad_acumulada :=',
    E'v_ingresos_totales := (public._ingreso_confirmado(p_tenant_id, date ''2000-01-01'', public.hoy_en_sede(null), null)->>''neto'')::numeric;\n  v_utilidad_acumulada :=', 'ns');
  if d not like '%_ingreso_confirmado%' then raise exception 'no se pudo parchear kpi_balance_general'; end if;
  execute d;
end $$;

-- ============ 2. Anulación de cobros: devuelve el uso del código de descuento ============
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='anular_cobro_membresia';
  d := regexp_replace(d, 'anulada_motivo\s*=\s*p_motivo\s+where\s+id\s*=\s*p_membresia_id;',
    E'anulada_motivo = p_motivo where id = p_membresia_id;\n  if v_membresia.codigo_descuento_id is not null then\n    update public.codigos_descuento set usos_actuales = greatest(coalesce(usos_actuales,0) - 1, 0) where id = v_membresia.codigo_descuento_id;\n  end if;');
  if d not like '%usos_actuales = greatest%' then raise exception 'no se pudo parchear anular_cobro_membresia'; end if;
  execute d;
end $$;

-- ============ 3. Metas con avance real y proyección ============
create or replace function public.definir_meta(p_tenant_id uuid, p_mes date, p_tipo text, p_meta numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public._es_g(p_tenant_id) then raise exception 'No autorizado'; end if;
  if p_tipo not in ('ingresos','reservas','clientas_nuevas','clientas_con_paquete') then raise exception 'Tipo de meta no válido'; end if;
  if p_meta is null or p_meta < 0 then raise exception 'La meta debe ser un número positivo'; end if;
  insert into public.metas_mensuales (tenant_id, mes, tipo, meta, actualizado_por)
    values (p_tenant_id, date_trunc('month', p_mes)::date, p_tipo, p_meta, auth.uid())
    on conflict (tenant_id, mes, tipo) do update set meta = excluded.meta, actualizado_por = auth.uid();
end $$;

create or replace function public.metas_avance(p_tenant_id uuid, p_mes date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_hoy date := public.hoy_en_sede(null); v_mes date; v_fin date; v_dias int; v_trans int; v_res jsonb := '[]'::jsonb;
        t text; v_meta numeric; v_real numeric; v_proy numeric;
begin
  if not public._es_g(p_tenant_id) then raise exception 'No autorizado'; end if;
  v_mes := date_trunc('month', coalesce(p_mes, v_hoy))::date;
  v_fin := (v_mes + interval '1 month - 1 day')::date;
  v_dias := v_fin - v_mes + 1;
  v_trans := case when v_hoy < v_mes then 0 when v_hoy > v_fin then v_dias else v_hoy - v_mes + 1 end;
  foreach t in array array['ingresos','reservas','clientas_nuevas','clientas_con_paquete'] loop
    select meta into v_meta from public.metas_mensuales where tenant_id = p_tenant_id and mes = v_mes and tipo = t;
    v_real := case t
      when 'ingresos' then (public._ingreso_confirmado(p_tenant_id, v_mes, v_fin, null)->>'neto')::numeric
      when 'reservas' then (select count(*) from public.reservas r where r.tenant_id = p_tenant_id and r.estado = 'confirmada' and r.fecha between v_mes and least(v_fin, v_hoy))
      when 'clientas_nuevas' then (select count(*) from public.clientes c where c.tenant_id = p_tenant_id and c.tutor_id is null and not coalesce(c.es_mostrador,false) and c.created_at::date between v_mes and v_fin)
      else (select count(distinct m.cliente_id) from public.membresias m where m.tenant_id = p_tenant_id and m.estado = 'activa' and m.pagada and m.fecha_vencimiento >= v_hoy)
    end;
    v_proy := case when t = 'clientas_con_paquete' then v_real when v_trans > 0 then round(v_real / v_trans * v_dias, 2) else 0 end;
    v_res := v_res || jsonb_build_object('tipo', t, 'meta', v_meta, 'real', v_real, 'proyeccion', v_proy,
      'avance_pct', case when coalesce(v_meta,0) > 0 then round(100.0 * v_real / v_meta, 1) end,
      'proyeccion_pct', case when coalesce(v_meta,0) > 0 then round(100.0 * v_proy / v_meta, 1) end);
  end loop;
  return jsonb_build_object('mes', v_mes, 'dias_mes', v_dias, 'dias_transcurridos', v_trans, 'metas', v_res);
end $$;

-- ============ 4. Riesgo de fuga: lista para contactar (con los permisos de quien llama: sus clientas) ============
create or replace function public.clientas_riesgo_fuga(p_tenant_id uuid, p_dias integer default 14, p_sede_id uuid default null)
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

-- ============ 5. Centro de mando (7 pestañas), por tenant y filtrable por sede ============
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
  select count(distinct m.cliente_id) into n_pq from public.membresias m
   where m.tenant_id = p_tenant_id and m.estado = 'activa' and m.pagada and m.fecha_vencimiento >= v_hoy and (v_todas or m.sede_venta_id = any(v_sedes));
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
      || jsonb_build_object('riesgo_fuga', (select count(*) from public.clientas_riesgo_fuga(p_tenant_id, 14, p_sede_id))));
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

-- ============ 6. Ficha de clienta ============
create or replace function public.cliente_detalle(p_cliente_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c record; v_hoy date := public.hoy_en_sede(null); r jsonb; dia text; gasto numeric;
begin
  select * into c from public.clientes where id = p_cliente_id;
  if c is null then raise exception 'Clienta no encontrada'; end if;
  if not public._cliente_atendida(p_cliente_id) and not public._es_g(c.tenant_id) then raise exception 'No autorizado'; end if;
  select (select coalesce(sum(coalesce(m.precio_final,0)),0) from public.membresias m where m.cliente_id = p_cliente_id and m.pagada and m.estado <> 'anulada')
       + (select coalesce(sum(p.total),0) from public.pedidos p where p.cliente_id = p_cliente_id and p.estado in ('pagado','entregado'))
       + (select coalesce(sum(x.monto),0) from public.cobros_personalizados x where x.cliente_id = p_cliente_id) into gasto;
  select (array['domingo','lunes','martes','miércoles','jueves','viernes','sábado'])[extract(dow from fecha)::int + 1] into dia
    from public.reservas where cliente_id = p_cliente_id and estado = 'confirmada' and asistio is true
   group by extract(dow from fecha) order by count(*) desc limit 1;
  select jsonb_build_object(
      'reservas_total', count(*) filter (where estado = 'confirmada' and fecha <= v_hoy),
      'asistidas', count(*) filter (where estado = 'confirmada' and asistio is true),
      'no_vino', count(*) filter (where estado = 'confirmada' and asistio is false),
      'canceladas', count(*) filter (where estado = 'cancelada'),
      'proximas', count(*) filter (where estado = 'confirmada' and fecha > v_hoy),
      'primera_visita', min(fecha) filter (where estado = 'confirmada' and asistio is true),
      'ultima_visita', max(fecha) filter (where estado = 'confirmada' and asistio is true))
    into r from public.reservas where cliente_id = p_cliente_id;
  return r || jsonb_build_object(
    'pct_asistencia', case when (r->>'asistidas')::int + (r->>'no_vino')::int > 0 then round(100.0 * (r->>'asistidas')::int / ((r->>'asistidas')::int + (r->>'no_vino')::int), 1) end,
    'gasto_total', gasto, 'dia_mas_concurrido', dia,
    'tiene_acceso', c.user_id is not null, 'consentimiento_completado', c.consentimiento_completado_at is not null,
    'cliente_desde', c.created_at::date);
end $$;

create or replace function public.reenviar_acceso_clienta(p_cliente_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare c record; v_tok uuid;
begin
  select * into c from public.clientes where id = p_cliente_id;
  if c is null then raise exception 'Clienta no encontrada'; end if;
  if not public._es_g(c.tenant_id) then raise exception 'No autorizado'; end if;
  if c.user_id is not null then raise exception 'Esta clienta ya tiene acceso. Si olvidó su contraseña, que use "Olvidé mi contraseña" en el inicio de sesión.'; end if;
  update public.invitaciones_clienta set usado = true where cliente_id = p_cliente_id and not usado;   -- se invalida el enlace anterior
  v_tok := public.crear_invitacion_clienta(p_cliente_id);
  return v_tok::text;
end $$;

create or replace function public.recordar_consentimiento(p_cliente_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c record; v_canal text;
begin
  select * into c from public.clientes where id = p_cliente_id;
  if c is null then raise exception 'Clienta no encontrada'; end if;
  if not public._es_g(c.tenant_id) then raise exception 'No autorizado'; end if;
  if c.consentimiento_completado_at is not null then raise exception 'Esta clienta ya firmó su consentimiento'; end if;
  v_canal := case when nullif(trim(coalesce(c.email,'')),'') is not null then 'email' else 'whatsapp' end;
  insert into public.cola_mensajes (tenant_id, cliente_id, canal, destino, asunto, cuerpo, tipo, estado, clave_unica)
    values (c.tenant_id, c.id, v_canal, coalesce(nullif(c.email,''), c.telefono), 'Completa tu consentimiento informado',
            'Hola ' || split_part(c.nombre,' ',1) || ', antes de tu próxima clase necesitamos que completes tu consentimiento informado desde tu cuenta.',
            'consentimiento_pendiente', 'pendiente', 'consent-' || c.id || '-' || public.hoy_en_sede(null))
    on conflict do nothing;
end $$;

create or replace function public.eliminar_cliente(p_cliente_id uuid, p_confirmar_nombre text)
returns void language plpgsql security definer set search_path = public as $$
declare c record; v_pagos int;
begin
  select * into c from public.clientes where id = p_cliente_id;
  if c is null then raise exception 'Clienta no encontrada'; end if;
  if c.tenant_id is null or not public.tengo_rol_en_tenant(c.tenant_id, array['duena']) then raise exception 'Solo la dueña puede eliminar una cuenta'; end if;
  if lower(trim(coalesce(p_confirmar_nombre,''))) <> lower(trim(c.nombre)) then raise exception 'Escribe el nombre exacto de la clienta para confirmar'; end if;
  select (select count(*) from public.membresias m where m.cliente_id = c.id and m.pagada and m.estado <> 'anulada')
       + (select count(*) from public.pedidos p where p.cliente_id = c.id and p.estado in ('pagado','entregado'))
       + (select count(*) from public.cobros_personalizados x where x.cliente_id = c.id) into v_pagos;
  if v_pagos > 0 then raise exception 'Esta clienta tiene % pago(s) confirmados. Anúlalos primero: un cobro no se borra junto con la cuenta.', v_pagos; end if;
  insert into public.admin_acciones_log (tenant_id, actor_id, actor_nombre, tabla, operacion, registro_id, detalle)
    values (c.tenant_id, auth.uid(), (select nombre from public.tenant_memberships where tenant_id = c.tenant_id and user_id = auth.uid() limit 1), 'clientes', 'delete', c.id,
            jsonb_build_object('nombre', c.nombre, 'telefono', c.telefono, 'motivo', 'Eliminación de cuenta confirmada por la dueña'));
  delete from public.clientes where id = c.id;
end $$;

-- ============ 7. Carritos abandonados: recordar (solo encola, no envía) ============
create or replace function public.carrito_recordar(p_carrito_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare ct record; c record; v_canal text;
begin
  select * into ct from public.carritos where id = p_carrito_id;
  if ct is null then raise exception 'Carrito no encontrado'; end if;
  if not public._es_g(ct.tenant_id) then raise exception 'No autorizado'; end if;
  if ct.estado <> 'activo' then raise exception 'Ese carrito ya no está activo'; end if;
  select * into c from public.clientes where id = ct.cliente_id;
  v_canal := case when nullif(trim(coalesce(c.email,'')),'') is not null then 'email' else 'whatsapp' end;
  insert into public.cola_mensajes (tenant_id, cliente_id, canal, destino, asunto, cuerpo, tipo, estado, clave_unica)
    values (ct.tenant_id, c.id, v_canal, coalesce(nullif(c.email,''), c.telefono), 'Dejaste algo en tu carrito',
            'Hola ' || split_part(c.nombre,' ',1) || ', dejaste productos en tu carrito. Puedes terminar tu compra cuando quieras.',
            'carrito_abandonado', 'pendiente', 'carrito-' || ct.id || '-' || public.hoy_en_sede(null))
    on conflict do nothing;
end $$;

-- ============ 8. Permisos: nada para anon; solo usuarios con sesión ============
do $$
declare f text;
begin
  foreach f in array array[
    'definir_meta(uuid,date,text,numeric)','metas_avance(uuid,date)','clientas_riesgo_fuga(uuid,integer,uuid)','centro_mando(uuid,uuid)',
    'cliente_detalle(uuid)','reenviar_acceso_clienta(uuid)','recordar_consentimiento(uuid)','eliminar_cliente(uuid,text)','carrito_recordar(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
