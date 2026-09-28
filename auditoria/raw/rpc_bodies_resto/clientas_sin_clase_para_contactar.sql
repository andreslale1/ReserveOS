CREATE OR REPLACE FUNCTION public.clientas_sin_clase_para_contactar()
 RETURNS TABLE(cliente_id uuid, nombre text, telefono text, email text, motivo text, ultima_clase_intentada date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_hoy date := (now() - interval '6 hours')::date;
begin
  if not exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'duena') then
    return;
  end if;

  return query
  with trial_fallidas as (
    select distinct on (r.cliente_id)
      r.cliente_id,
      case when r.estado = 'cancelada' then 'Canceló su prueba y no reagendó' else 'No asistió a su prueba y no reagendó' end as motivo,
      r.fecha
    from reservas r
    where r.tipo = 'prueba'
      and (
        r.estado = 'cancelada'
        or (r.estado = 'confirmada' and r.fecha < v_hoy and coalesce(r.asistio, false) = false)
      )
      and not exists (
        select 1 from reservas r2
        where r2.cliente_id = r.cliente_id and r2.estado = 'confirmada' and r2.id <> r.id
      )
    order by r.cliente_id, r.fecha desc
  ),
  nunca_asistieron as (
    select c.id as cliente_id, 'Nunca ha tomado ninguna clase'::text as motivo, null::date as fecha
    from clientes c
    where not exists (select 1 from reservas r where r.cliente_id = c.id and r.asistio = true)
      and not exists (select 1 from reservas r where r.cliente_id = c.id and r.estado = 'confirmada' and r.fecha >= v_hoy)
      and not exists (select 1 from trial_fallidas tf where tf.cliente_id = c.id)
  )
  select c.id, c.nombre, c.telefono, c.email, u.motivo, u.fecha
  from (
    select * from trial_fallidas
    union all
    select * from nunca_asistieron
  ) u
  join clientes c on c.id = u.cliente_id
  order by c.nombre;
end;
$function$
