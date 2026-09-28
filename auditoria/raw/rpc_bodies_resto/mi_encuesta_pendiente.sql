CREATE OR REPLACE FUNCTION public.mi_encuesta_pendiente()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cliente_id uuid;
  v_prueba_completada boolean;
  v_ya_prueba boolean;
  v_primer_paquete_completado boolean;
  v_ya_primer boolean;
begin
  select id into v_cliente_id from clientes where user_id = auth.uid();
  if v_cliente_id is null then
    return null;
  end if;

  select exists(
    select 1 from reservas
    where cliente_id = v_cliente_id and tipo = 'prueba' and estado = 'confirmada' and fecha < ((now() - interval '6 hours')::date)
  ) into v_prueba_completada;

  select exists(
    select 1 from encuestas_satisfaccion where cliente_id = v_cliente_id and disparador = 'prueba'
  ) into v_ya_prueba;

  if v_prueba_completada and not v_ya_prueba then
    return json_build_object('disparador', 'prueba');
  end if;

  select exists(
    select 1 from membresias
    where cliente_id = v_cliente_id and origen = 'compra' and pagada = true
      and clases_totales is not null and clases_usadas >= clases_totales
  ) into v_primer_paquete_completado;

  select exists(
    select 1 from encuestas_satisfaccion where cliente_id = v_cliente_id and disparador = 'primer_paquete'
  ) into v_ya_primer;

  if v_primer_paquete_completado and not v_ya_primer then
    return json_build_object('disparador', 'primer_paquete');
  end if;

  return null;
end;
$function$
