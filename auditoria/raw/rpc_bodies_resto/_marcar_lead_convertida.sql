CREATE OR REPLACE FUNCTION public._marcar_lead_convertida()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if NEW.pagada = true and (TG_OP = 'INSERT' or OLD.pagada is distinct from true) then
    update reservas set estado_lead = 'convertida'
      where cliente_id = NEW.cliente_id and tipo = 'prueba' and estado_lead is distinct from 'convertida';
  end if;
  return NEW;
end;
$function$
