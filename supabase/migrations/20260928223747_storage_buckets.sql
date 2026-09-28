-- Storage real: hasta ahora los campos imagen_url/comprobante_url guardaban una URL sin que existiera
-- ningún bucket donde ese archivo realmente viviera. Dos buckets, convención de carpeta
-- `{tenant_id}/...` como primer segmento — es lo que hace posible aislar por tenant con RLS sobre
-- storage.objects, igual que con las tablas.
--
-- `public-assets`: logos, fotos de paquetes/productos, contenido del sitio — público de lectura
-- (es contenido de marketing, pensado para mostrarse sin sesión), escritura solo staff del tenant.
-- `comprobantes`: comprobantes de pago — privado. Convención `{tenant_id}/{cliente_id}/archivo`.
-- Lectura/escritura: la propia clienta sobre su carpeta, o staff del tenant.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('public-assets', 'public-assets', true, 5242880, array['image/png','image/jpeg','image/webp','image/gif']),
  ('comprobantes', 'comprobantes', false, 10485760, array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict (id) do nothing;

create policy public_assets_lectura_publica on storage.objects for select
  using (bucket_id = 'public-assets');

create policy public_assets_escritura_staff on storage.objects for insert
  with check (
    bucket_id = 'public-assets'
    and public.tengo_rol_en_tenant((storage.foldername(name))[1]::uuid, array['duena','gerente_general','admin_sede'])
  );
create policy public_assets_actualizar_staff on storage.objects for update
  using (
    bucket_id = 'public-assets'
    and public.tengo_rol_en_tenant((storage.foldername(name))[1]::uuid, array['duena','gerente_general','admin_sede'])
  );
create policy public_assets_borrar_staff on storage.objects for delete
  using (
    bucket_id = 'public-assets'
    and public.tengo_rol_en_tenant((storage.foldername(name))[1]::uuid, array['duena','gerente_general','admin_sede'])
  );

create policy comprobantes_lectura on storage.objects for select
  using (
    bucket_id = 'comprobantes'
    and (
      public.staff_puede_en_sede((storage.foldername(name))[1]::uuid, null, array['duena','gerente_general','admin_sede','recepcion'])
      or (storage.foldername(name))[2]::uuid = public.mi_cliente_id((storage.foldername(name))[1]::uuid)
    )
  );

create policy comprobantes_subir_propio on storage.objects for insert
  with check (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[2]::uuid = public.mi_cliente_id((storage.foldername(name))[1]::uuid)
  );

create policy comprobantes_borrar_staff on storage.objects for delete
  using (
    bucket_id = 'comprobantes'
    and public.staff_puede_en_sede((storage.foldername(name))[1]::uuid, null, array['duena','gerente_general'])
  );
