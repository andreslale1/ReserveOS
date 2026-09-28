CREATE OR REPLACE FUNCTION public.descongelar_membresia(p_membresia_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_congelada_desde date;
  v_dias int;
begin
  if not exists (select 1 from perfiles where id = auth.uid() and rol = 'duena') then
    raise exception 'Solo la dueña puede descongelar membresías';
  end if;

  select congelada_desde into v_congelada_desde from membresias where id = p_membresia_id;
  if v_congelada_desde is null then
    raise exception 'Esta membresía no está congelada';
  end if;

  v_dias := (now() - interval '6 hours')::date - v_congelada_desde;

  update membresias
    set congelada_desde = null,
        fecha_vencimiento = fecha_vencimiento + v_dias
    where id = p_membresia_id;
end;
$function$
