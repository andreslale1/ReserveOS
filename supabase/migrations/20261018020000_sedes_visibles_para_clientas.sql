-- Reservar (portal de la clienta) lee las sedes de su estudio; la política solo dejaba leerlas al personal, así que
-- la clienta veía «este estudio aún no tiene sedes activas». Ahora cada clienta ve las sedes de SU estudio (y solo ese).
drop policy if exists sedes_select_clienta on public.sedes;
create policy sedes_select_clienta on public.sedes for select to authenticated
  using (tenant_id in (select c.tenant_id from public.clientes c where c.user_id = auth.uid()));
