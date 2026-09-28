CREATE OR REPLACE FUNCTION public.lista_espera_vencida()
 RETURNS TABLE(lista_espera_id uuid, cliente_id uuid, nombre text, email text, user_id uuid, nombre_clase text, hora_inicio time without time zone, fecha date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ahora timestamp := (now() - interval '6 hours')::timestamp;
  v_reg record;
begin
  for v_reg in
    select le.id as le_id, c.id as c_id, c.nombre as c_nombre, c.email as c_email, c.user_id as c_user_id,
           h.nombre_clase as h_nombre, h.hora_inicio as h_hora, le.fecha as le_fecha
    from lista_espera le
    join horarios h on h.id = le.horario_id
    join clientes c on c.id = le.cliente_id
    where (le.fecha + h.hora_inicio) <= v_ahora
  loop
    delete from lista_espera where id = v_reg.le_id;
    lista_espera_id := v_reg.le_id;
    cliente_id := v_reg.c_id;
    nombre := v_reg.c_nombre;
    email := v_reg.c_email;
    user_id := v_reg.c_user_id;
    nombre_clase := v_reg.h_nombre;
    hora_inicio := v_reg.h_hora;
    fecha := v_reg.le_fecha;
    return next;
  end loop;
end;
$function$
