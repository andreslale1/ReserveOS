-- La tarea que libera los cupos no confirmados fallaba en cuanto encontraba una reserva que liberar: pedía «fecha» de un registro que no la traía.
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='liberar_cupos_no_confirmados';
  d := replace(d, 'select r.tenant_id as t_id, r.id as reserva_id, r.cliente_id,', 'select r.tenant_id as t_id, r.id as reserva_id, r.fecha as f_fecha, r.cliente_id,');
  d := replace(d, 'fecha := v_reg.fecha;', 'fecha := v_reg.f_fecha;');
  if d not like '%f_fecha%' or d like '%v_reg.fecha;%' then raise exception 'no se pudo parchear liberar_cupos_no_confirmados'; end if;
  execute d;
end $$;
revoke all on function public.liberar_cupos_no_confirmados() from public, anon, authenticated;
grant execute on function public.liberar_cupos_no_confirmados() to service_role;
