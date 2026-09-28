CREATE OR REPLACE FUNCTION public.catalogo_productos()
 RETURNS TABLE(producto_id uuid, nombre text, descripcion text, precio numeric, unidad text, imagen_url text, categoria text, orden integer, variante_id uuid, variante_nombre text, stock integer, variante_orden integer, variante_imagen_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id, p.nombre, p.descripcion, p.precio, p.unidad, p.imagen_url, p.categoria, p.orden,
         v.id, v.nombre, v.stock, v.orden, v.imagen_url
  from productos p
  join producto_variantes v on v.producto_id = p.id
  where p.activo = true
  order by p.orden, p.nombre, v.orden, v.nombre;
$function$
