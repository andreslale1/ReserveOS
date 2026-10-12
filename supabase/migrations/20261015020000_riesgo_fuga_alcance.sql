-- La lista de riesgo de fuga ve TODAS las reservas de la clienta (una reserva futura en otra sede la saca de la lista), pero solo devuelve las clientas que quien llama atiende.
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='clientas_riesgo_fuga_lista';
  d := regexp_replace(d, 'LANGUAGE sql\s+STABLE', 'LANGUAGE sql STABLE SECURITY DEFINER');
  d := regexp_replace(d, 'where c\.tenant_id = p_tenant_id\s+and c\.tutor_id is null', 'where c.tenant_id = p_tenant_id and (public._es_g(p_tenant_id) or public._cliente_atendida(c.id)) and c.tutor_id is null');
  if d not like '%SECURITY DEFINER%' or d not like '%_cliente_atendida%' then raise exception 'no se pudo parchear la lista de riesgo'; end if;
  execute d;
end $$;
revoke all on function public.clientas_riesgo_fuga_lista(uuid,integer,uuid) from public, anon;
grant execute on function public.clientas_riesgo_fuga_lista(uuid,integer,uuid) to authenticated;
