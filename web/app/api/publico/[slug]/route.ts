import { createClient } from "@supabase/supabase-js";

// API pública de solo lectura de un estudio: sedes, horarios semanales, paquetes y contacto.
// La consume el widget (public/widget.js) y cualquier web que quiera mostrar el horario. No incluye datos de personas.
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };

export async function OPTIONS() { return new Response(null, { status: 204, headers: CORS }); }

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) return Response.json({ error: "Estudio no válido" }, { status: 400, headers: CORS });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("horarios_publicos", { p_slug: slug });
  if (error || !data) return Response.json({ error: "Estudio no encontrado" }, { status: 404, headers: CORS });
  const e = data as { nombre: string; slug: string; color: string | null; logo: string | null; sedes: unknown; clases: unknown; paquetes: unknown; contacto: unknown };
  return Response.json(
    { nombre: e.nombre, slug: e.slug, color: e.color, logo: e.logo, sedes: e.sedes, clases: e.clases, paquetes: e.paquetes, contacto: e.contacto },
    { headers: { ...CORS, "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
