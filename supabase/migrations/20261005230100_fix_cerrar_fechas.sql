-- Corrección: generate_series no admite fechas puras; se usa timestamp.
create or replace function public.cerrar_fechas(p_tenant_id uuid, p_sede_id uuid, p_desde date, p_hasta date, p_motivo text)
returns json language plpgsql security definer set search_path to 'public' as $$
declare v_h record; v_d date; v_n int := 0; v_r record;
begin
  if p_sede_id is null then
    if not public.tengo_rol_en_tenant(p_tenant_id, array['duena','gerente_general']) then raise exception 'Cerrar todas las sedes solo lo hace la dueña o gerente general'; end if;
  elsif not public.staff_puede_en_sede(p_tenant_id, p_sede_id, array['duena','gerente_general','admin_sede']) then
    raise exception 'No autorizado';
  end if;
  if p_motivo is null or length(trim(p_motivo)) < 3 then raise exception 'Escribe el motivo (feriado, remodelación…)'; end if;
  if p_hasta < p_desde then raise exception 'La fecha final no puede ser anterior a la inicial'; end if;
  if p_hasta - p_desde > 90 then raise exception 'Un cierre no puede durar más de 90 días'; end if;
  if p_sede_id is not null and not exists (select 1 from public.sedes where id = p_sede_id and tenant_id = p_tenant_id) then raise exception 'Sede no válida'; end if;
  insert into public.sede_cierres (tenant_id, sede_id, desde, hasta, motivo) values (p_tenant_id, p_sede_id, p_desde, p_hasta, trim(p_motivo));
  -- Cancela clases y reservas de esos días, devolviendo la clase a cada paquete.
  for v_d in select g::date from generate_series(greatest(p_desde, current_date)::timestamp, p_hasta::timestamp, interval '1 day') g loop
    for v_h in select h.* from public.horarios h where h.tenant_id = p_tenant_id and h.activo
        and (p_sede_id is null or h.sede_id = p_sede_id)
        and ((h.fecha_especifica is null and h.dia_semana = extract(dow from v_d)::int) or h.fecha_especifica = v_d) loop
      insert into public.horario_cancelaciones (tenant_id, horario_id, fecha) values (p_tenant_id, v_h.id, v_d) on conflict (horario_id, fecha) do nothing;
      for v_r in select * from public.reservas where horario_id = v_h.id and fecha = v_d and estado = 'confirmada' loop
        update public.reservas set estado = 'cancelada' where id = v_r.id;
        if v_r.tipo = 'regular' then perform public.devolver_clase_a_membresia(v_r.cliente_id); end if;
        v_n := v_n + 1;
      end loop;
    end loop;
  end loop;
  return json_build_object('ok', true, 'reservas_canceladas', v_n);
end $$;
