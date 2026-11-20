-- CORRECCIÓN de 20261018130000: las claves foráneas compuestas creaban una SEGUNDA relación entre las mismas tablas
-- y la API (PostgREST) dejó de poder traer datos relacionados (clientes con membresías, reservas con clase, etc.).
-- La protección entre estudios se mantiene con disparadores, que la API no ve como relaciones.

alter table public.membresias drop constraint if exists membresias_cliente_mismo_tenant;
alter table public.membresias drop constraint if exists membresias_paquete_mismo_tenant;
alter table public.membresias drop constraint if exists membresias_sede_mismo_tenant;
alter table public.reservas   drop constraint if exists reservas_cliente_mismo_tenant;
alter table public.reservas   drop constraint if exists reservas_horario_mismo_tenant;
alter table public.reservas   drop constraint if exists reservas_membresia_mismo_tenant;
alter table public.reservas   drop constraint if exists reservas_sede_mismo_tenant;

create or replace function public._mismo_estudio()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_t uuid;
begin
  if tg_table_name = 'membresias' then
    select tenant_id into v_t from public.clientes where id = new.cliente_id;
    if v_t is distinct from new.tenant_id then raise exception 'La clienta pertenece a otro estudio'; end if;
    if new.paquete_id is not null then
      select tenant_id into v_t from public.paquetes where id = new.paquete_id;
      if v_t is distinct from new.tenant_id then raise exception 'El paquete pertenece a otro estudio'; end if;
    end if;
    if new.sede_venta_id is not null then
      select tenant_id into v_t from public.sedes where id = new.sede_venta_id;
      if v_t is distinct from new.tenant_id then raise exception 'La sede pertenece a otro estudio'; end if;
    end if;
  else
    select tenant_id into v_t from public.clientes where id = new.cliente_id;
    if v_t is distinct from new.tenant_id then raise exception 'La clienta pertenece a otro estudio'; end if;
    select tenant_id into v_t from public.horarios where id = new.horario_id;
    if v_t is distinct from new.tenant_id then raise exception 'La clase pertenece a otro estudio'; end if;
    if new.membresia_id is not null then
      select tenant_id into v_t from public.membresias where id = new.membresia_id;
      if v_t is distinct from new.tenant_id then raise exception 'La membresía pertenece a otro estudio'; end if;
    end if;
    if new.sede_id is not null then
      select tenant_id into v_t from public.sedes where id = new.sede_id;
      if v_t is distinct from new.tenant_id then raise exception 'La sede pertenece a otro estudio'; end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function public._mismo_estudio() from public, anon, authenticated;

drop trigger if exists membresias_mismo_estudio on public.membresias;
create trigger membresias_mismo_estudio before insert or update of tenant_id, cliente_id, paquete_id, sede_venta_id on public.membresias
  for each row execute function public._mismo_estudio();
drop trigger if exists reservas_mismo_estudio on public.reservas;
create trigger reservas_mismo_estudio before insert or update of tenant_id, cliente_id, horario_id, membresia_id, sede_id on public.reservas
  for each row execute function public._mismo_estudio();
