-- AUDITORÍA · tanda 3: PAG-03 (evento de pago sin monto), PAG-04 (reembolso total del proveedor revoca el paquete),
-- FIN-01 en el ranking de clientas (y su error de columna ambigua), HOR-01 (cupo por debajo de lo reservado), ESP-06 (espera en el portal).
-- Misma técnica segura que las tandas anteriores: se parchea el texto vivo y, si no se reconoce, se detiene sin cambiar nada.

create or replace function public._parchear_funcion(p_nombre text, p_ancla text, p_nuevo text, p_marca text, p_esperadas integer default 1)
returns void language plpgsql as $$
declare v_oid oid; v_def text; v_n integer;
begin
  select p.oid into v_oid from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = p_nombre;
  if v_oid is null then raise exception 'Se detiene: no existe la función %', p_nombre; end if;
  v_def := pg_get_functiondef(v_oid);
  if position(p_marca in v_def) > 0 then return; end if;
  v_n := (length(v_def) - length(replace(v_def, p_ancla, ''))) / greatest(length(p_ancla), 1);
  if v_n <> p_esperadas then raise exception 'Se detiene: en % se esperaban % coincidencias y hay % (el texto cambió)', p_nombre, p_esperadas, v_n; end if;
  execute replace(v_def, p_ancla, p_nuevo);
end $$;

-- PAG-03 · Un «pago exitoso» firmado SIN monto ya no confirma la compra: pasa a revisión (antes se confirmaba).
select public._parchear_funcion('pago_webhook',
  'if v_monto is not null and abs(v_monto - v_tx.monto) > 0.01 then',
  'if v_monto is null or abs(v_monto - v_tx.monto) > 0.01 then',
  'if v_monto is null or abs(v_monto - v_tx.monto) > 0.01');

-- PAG-04 · Un reembolso TOTAL confirmado por el proveedor revoca el paquete (antes el dinero se devolvía y las clases seguían).
-- Un reembolso parcial no anula nada: queda para revisión humana.
select public._parchear_funcion('pago_webhook',
  'v_res := ''reembolsado'';',
  E'v_res := ''reembolsado'';\n    if v_tx.membresia_id is not null and (v_monto is null or v_monto >= v_tx.monto - 0.01) then\n      update public.membresias set estado = ''anulada'', anulada_at = now(), anulada_motivo = ''Reembolso total confirmado por el proveedor'' where id = v_tx.membresia_id and estado = ''activa'';\n    end if;',
  'Reembolso total confirmado por el proveedor');

-- FIN-01 / error · Ranking de clientas: ya no falla por columna ambigua y no cuenta dos veces el paquete vendido por la tienda.
select public._parchear_funcion('ranking_clientas_valor', 'AS $function$', E'AS $function$\n#variable_conflict use_column', '#variable_conflict use_column');
select public._parchear_funcion('ranking_clientas_valor',
  'pedidos_cli as (select cliente_id, total as monto,',
  'pedidos_cli as (select cliente_id, greatest(total - coalesce((select sum(i.precio_unitario * coalesce(i.cantidad, 1)) from public.pedido_items i where i.pedido_id = pedidos.id and i.tipo <> ''producto''), 0), 0) as monto,',
  'select sum(i.precio_unitario * coalesce(i.cantidad, 1)) from public.pedido_items i where i.pedido_id = pedidos.id');

-- HOR-01 · No se puede bajar el cupo de una clase por debajo de lo ya reservado en sus próximas fechas.
select public._parchear_funcion('actualizar_horario',
  'if p_cupo_maximo is not null and p_cupo_maximo < 1 then raise exception ''El cupo debe ser al menos 1''; end if;',
  E'if p_cupo_maximo is not null and p_cupo_maximo < 1 then raise exception ''El cupo debe ser al menos 1''; end if;\n  if p_cupo_maximo is not null and exists (select 1 from (select fecha, count(*) n from public.reservas where horario_id = p_horario_id and estado = ''confirmada'' and fecha >= public.hoy_gt() group by fecha) x where x.n > p_cupo_maximo) then\n    raise exception ''No puedes bajar el cupo por debajo de las reservas que ya hay en una fecha próxima. Cancela o traslada reservas primero.'';\n  end if;',
  'No puedes bajar el cupo por debajo de las reservas');

-- ESP-06 · La lista de espera del portal devuelve la clase (horario_id) para reconocer a quien espera y mostrar «Salir de espera».
drop function if exists public.mi_lista_espera();
create function public.mi_lista_espera()
returns table(id uuid, fecha date, hora_inicio time, nombre_clase text, cliente_id uuid, cliente_nombre text, es_propia boolean, horario_id uuid)
language sql stable security definer set search_path to 'public' as $$
  select le.id, le.fecha, h.hora_inicio, h.nombre_clase, c.id, c.nombre, (c.user_id = auth.uid()), le.horario_id
  from public.lista_espera le
  join public.horarios h on h.id = le.horario_id
  join public.clientes c on c.id = le.cliente_id
  where c.user_id = auth.uid() or c.tutor_id in (select id from public.clientes where user_id = auth.uid() and tenant_id = c.tenant_id)
  order by le.fecha, h.hora_inicio;
$$;
revoke all on function public.mi_lista_espera() from public, anon;
grant execute on function public.mi_lista_espera() to authenticated;

drop function public._parchear_funcion(text, text, text, text, integer);
