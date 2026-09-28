CREATE OR REPLACE FUNCTION public.salir_lista_espera(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_propio_id uuid;
begin
  select id into v_propio_id from clientes where user_id = auth.uid();

  delete from lista_espera
    where id = p_id
      and (cliente_id = v_propio_id or cliente_id in (select id from clientes where tutor_id = v_propio_id));
end;
$function$
