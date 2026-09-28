CREATE OR REPLACE FUNCTION public.liberar_privatizacion_si_cancela()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if NEW.estado = 'cancelada' and OLD.estado <> 'cancelada' then
    delete from horario_fechas_privadas_personas where reserva_id = NEW.id;
  end if;
  return NEW;
end;
$function$
