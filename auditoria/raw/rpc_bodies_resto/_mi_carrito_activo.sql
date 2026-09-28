CREATE OR REPLACE FUNCTION public._mi_carrito_activo(OUT v_carrito_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cliente_id uuid;
begin
  select id into v_cliente_id from clientes where user_id = auth.uid();
  if v_cliente_id is null then
    raise exception 'No se encontró tu cuenta de clienta';
  end if;

  select id into v_carrito_id from carritos where cliente_id = v_cliente_id and estado = 'activo';
  if v_carrito_id is null then
    insert into carritos (cliente_id) values (v_cliente_id) returning id into v_carrito_id;
  end if;
end;
$function$
