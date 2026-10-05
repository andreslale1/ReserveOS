-- Integridad bajo concurrencia (ST-04). Las funciones de reserva comprobaban cupo y créditos con un
-- SELECT sin candado: dos personas reservando a la vez el último lugar podían quedar ambas confirmadas.
-- La protección vive en la base (no función por función) para cubrir TODAS las rutas que crean
-- reservas: clienta, recepción, clase de prueba, privada y promoción de lista de espera.

-- 1) Una clienta no puede tener dos reservas confirmadas en la misma clase y fecha.
create unique index if not exists reservas_unica_confirmada_idx
  on public.reservas (cliente_id, horario_id, fecha) where estado = 'confirmada';

-- 2) Los créditos de una membresía nunca pueden exceder el total ni ser negativos.
alter table public.membresias drop constraint if exists membresias_creditos_validos;
alter table public.membresias add constraint membresias_creditos_validos
  check (clases_usadas >= 0 and (clases_totales is null or clases_usadas <= clases_totales));

-- 3) Control de cupo serializado por clase: se bloquea la fila del horario, así dos transacciones
--    concurrentes sobre la misma clase se ejecutan una detrás de la otra y la segunda ve el cupo real.
create or replace function public._control_cupo_reserva()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_cupo int; v_priv int; v_ocupadas int;
begin
  if new.estado <> 'confirmada' then return new; end if;
  if tg_op = 'UPDATE' and old.estado = 'confirmada'
     and old.horario_id = new.horario_id and old.fecha = new.fecha then
    return new;
  end if;

  select cupo_maximo into v_cupo from public.horarios where id = new.horario_id for update;
  if v_cupo is null then raise exception 'Horario no válido'; end if;

  select cupo into v_priv from public.horario_fechas_privadas
    where horario_id = new.horario_id and fecha = new.fecha;
  v_cupo := coalesce(v_priv, v_cupo);

  select count(*) into v_ocupadas from public.reservas
    where horario_id = new.horario_id and fecha = new.fecha and estado = 'confirmada'
      and id <> new.id;

  if v_ocupadas >= v_cupo then
    raise exception 'Ese horario ya no tiene cupo disponible';
  end if;
  return new;
end;
$$;
revoke all on function public._control_cupo_reserva() from public;

drop trigger if exists reservas_control_cupo on public.reservas;
create trigger reservas_control_cupo
  before insert or update of estado, horario_id, fecha on public.reservas
  for each row execute function public._control_cupo_reserva();
