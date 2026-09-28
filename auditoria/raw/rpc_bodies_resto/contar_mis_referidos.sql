CREATE OR REPLACE FUNCTION public.contar_mis_referidos()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)::int from clientes
    where referido_por = (select id from clientes where user_id = auth.uid())
      and credito_referido_otorgado = true;
$function$
