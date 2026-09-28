CREATE OR REPLACE FUNCTION public.bloquear_espera_clase_empezada()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_hora time;
begin
  select hora_inicio into v_hora from horarios where id = NEW.horario_id;
  if v_hora is not null and (NEW.fecha + v_hora) <= (now() - interval '6 hours')::timestamp then
    raise exception 'Esa clase ya empezó — elige otro horario.';
  end if;
  return NEW;
end;
$function$
