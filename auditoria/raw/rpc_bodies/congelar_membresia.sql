CREATE OR REPLACE FUNCTION public.congelar_membresia(p_membresia_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from perfiles where id = auth.uid() and rol = 'duena') then
    raise exception 'Solo la dueña puede congelar membresías';
  end if;

  update membresias
    set congelada_desde = (now() - interval '6 hours')::date
    where id = p_membresia_id and estado = 'activa' and congelada_desde is null;

  if not found then
    raise exception 'Esta membresía no se puede congelar (no está activa o ya está congelada)';
  end if;
end;
$function$
