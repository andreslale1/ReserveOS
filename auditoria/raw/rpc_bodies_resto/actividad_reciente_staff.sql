CREATE OR REPLACE FUNCTION public.actividad_reciente_staff(p_dias integer DEFAULT 30)
 RETURNS TABLE(id uuid, actor_nombre text, tabla text, operacion text, registro_id text, detalle jsonb, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return;
  end if;

  return query
  select l.id, l.actor_nombre, l.tabla, l.operacion, l.registro_id, l.detalle, l.created_at
  from admin_acciones_log l
  where l.created_at >= now() - (p_dias || ' days')::interval
  order by l.created_at desc
  limit 500;
end;
$function$
