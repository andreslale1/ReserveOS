CREATE OR REPLACE FUNCTION public.kpi_seguimiento_prueba()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_hoy date := (now() - interval '6 hours')::date;
  v_no_asistio int;
  v_cancelada int;
  v_reagendaron int;
  v_sin_clase int;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return null;
  end if;

  select count(*) into v_no_asistio from reservas r
    where r.tipo = 'prueba' and r.estado = 'confirmada' and r.fecha < v_hoy and coalesce(r.asistio, false) = false;

  select count(*) into v_cancelada from reservas r
    where r.tipo = 'prueba' and r.estado = 'cancelada';

  select count(*) into v_reagendaron from reservas r
    where r.tipo = 'prueba'
      and (r.estado = 'cancelada' or (r.estado = 'confirmada' and r.fecha < v_hoy and coalesce(r.asistio, false) = false))
      and exists (select 1 from reservas r2 where r2.cliente_id = r.cliente_id and r2.estado = 'confirmada' and r2.id <> r.id);

  select count(*) into v_sin_clase from public.clientas_sin_clase_para_contactar();

  return json_build_object(
    'total_no_asistio', v_no_asistio,
    'total_cancelada', v_cancelada,
    'total_reagendaron', v_reagendaron,
    'total_sin_clase', v_sin_clase
  );
end;
$function$
