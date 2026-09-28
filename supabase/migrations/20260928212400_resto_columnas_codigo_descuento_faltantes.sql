-- Al diferir el módulo de descuentos en el batch de tablas del núcleo/resto, quedaron fuera las
-- columnas codigo_descuento_id que las tablas núcleo (membresias, pago_transacciones) y resto
-- (pedidos) necesitan para conectarse con codigos_descuento ahora que ese módulo sí se porta.
alter table public.membresias add column if not exists codigo_descuento_id uuid references public.codigos_descuento(id);
alter table public.pago_transacciones add column if not exists codigo_descuento_id uuid references public.codigos_descuento(id);
alter table public.pedidos add column if not exists codigo_descuento_id uuid references public.codigos_descuento(id);
alter table public.pedidos add column if not exists codigo_descuento_usado_id uuid references public.codigos_descuento(id);
