CREATE OR REPLACE FUNCTION public.registrar_accion_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_id uuid := auth.uid();
  v_actor_nombre text;
begin
  select nombre into v_actor_nombre from perfiles where id = v_actor_id;

  if TG_OP = 'DELETE' then
    insert into admin_acciones_log (actor_id, actor_nombre, tabla, operacion, registro_id, detalle)
      values (v_actor_id, v_actor_nombre, TG_TABLE_NAME, 'delete', OLD.id::text, to_jsonb(OLD));
    return OLD;
  elsif TG_OP = 'UPDATE' then
    insert into admin_acciones_log (actor_id, actor_nombre, tabla, operacion, registro_id, detalle)
      values (v_actor_id, v_actor_nombre, TG_TABLE_NAME, 'update', NEW.id::text, jsonb_build_object('antes', to_jsonb(OLD), 'despues', to_jsonb(NEW)));
    return NEW;
  else
    insert into admin_acciones_log (actor_id, actor_nombre, tabla, operacion, registro_id, detalle)
      values (v_actor_id, v_actor_nombre, TG_TABLE_NAME, 'insert', NEW.id::text, to_jsonb(NEW));
    return NEW;
  end if;
end;
$function$
