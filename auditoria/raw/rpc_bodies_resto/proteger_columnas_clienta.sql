CREATE OR REPLACE FUNCTION public.proteger_columnas_clienta()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if current_user = 'authenticated'
     and not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol in ('duena', 'empleada')) then
    if NEW.tutor_id is distinct from OLD.tutor_id
       or NEW.es_cuenta_familiar is distinct from OLD.es_cuenta_familiar
       or NEW.es_menor is distinct from OLD.es_menor
       or NEW.user_id is distinct from OLD.user_id
       or NEW.email is distinct from OLD.email
       or NEW.codigo_referido is distinct from OLD.codigo_referido
       or NEW.referido_por is distinct from OLD.referido_por
       or NEW.credito_referido_otorgado is distinct from OLD.credito_referido_otorgado
       or NEW.notas is distinct from OLD.notas then
      raise exception 'No puedes modificar ese dato de tu perfil.';
    end if;
  end if;
  return NEW;
end;
$function$
