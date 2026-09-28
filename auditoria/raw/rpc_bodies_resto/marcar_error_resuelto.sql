CREATE OR REPLACE FUNCTION public.marcar_error_resuelto(p_id uuid, p_resuelto boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles where id = auth.uid() and rol in ('duena', 'empleada')) then
    raise exception 'No autorizado';
  end if;
  update error_logs set resuelto = p_resuelto, resuelto_por = auth.uid(), resuelto_at = case when p_resuelto then now() else null end
    where id = p_id;
end;
$function$
