CREATE OR REPLACE FUNCTION public.testimonios_publicos()
 RETURNS TABLE(nombre_publico text, texto text, calificacion integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select nombre_publico, texto, calificacion from testimonios where aprobado = true order by created_at desc limit 24; $function$
