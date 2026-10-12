-- La meta de ingresos se guarda con el tipo 'ingreso' (como ya lo usaban Finanzas y el registro de gastos); el centro de mando la nombra 'ingresos'.
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='definir_meta';
  d := replace(d, 'p_mes)::date, p_tipo, p_meta, auth.uid())', 'p_mes)::date, case when p_tipo = ''ingresos'' then ''ingreso'' else p_tipo end, p_meta, auth.uid())');
  if d not like '%case when p_tipo = ''ingresos''%' then raise exception 'no se pudo parchear definir_meta'; end if;
  execute d;
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='metas_avance';
  d := replace(d, 'and mes = v_mes and tipo = t;', 'and mes = v_mes and tipo = case when t = ''ingresos'' then ''ingreso'' else t end;');
  if d not like '%case when t = ''ingresos''%' then raise exception 'no se pudo parchear metas_avance'; end if;
  execute d;
end $$;
