CREATE OR REPLACE FUNCTION public.marcar_membresia_pagada(p_membresia_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_membresia record;
  v_num_clases int;
  v_vigencia_dias int;
begin
  if not exists (select 1 from perfiles where id = auth.uid() and rol in ('duena', 'empleada')) then
    raise exception 'No autorizado';
  end if;

  select cliente_id, paquete_id, origen, clases_totales into v_membresia
    from membresias where id = p_membresia_id and pagada = false;

  if v_membresia is null then
    raise exception 'Membresía no encontrada o ya pagada';
  end if;

  select num_clases, vigencia_dias into v_num_clases, v_vigencia_dias
    from paquetes where id = v_membresia.paquete_id;

  if v_membresia.origen = 'compra' then
    update membresias set
      pagada = true,
      clases_totales = case when v_num_clases is null then null else greatest(v_membresia.clases_totales, v_num_clases) end,
      fecha_inicio = ((now() - interval '6 hours')::date),
      fecha_vencimiento = ((now() - interval '6 hours')::date) + coalesce(v_vigencia_dias, 30),
      confirmado_at = now(),
      confirmado_por = auth.uid()
    where id = p_membresia_id;
  else
    update membresias set
      pagada = true,
      fecha_inicio = ((now() - interval '6 hours')::date),
      fecha_vencimiento = ((now() - interval '6 hours')::date) + coalesce(v_vigencia_dias, 30),
      confirmado_at = now(),
      confirmado_por = auth.uid()
    where id = p_membresia_id;
  end if;

  perform otorgar_bono_referido_si_corresponde(v_membresia.cliente_id, v_membresia.paquete_id);

  return json_build_object('ok', true);
end;
$function$
