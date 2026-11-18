import { createClient } from "@supabase/supabase-js";

// Recibe el correo de la web de ventas y lo manda al embudo de ventas (mismo camino que /contacto).
export async function POST(req: Request) {
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  if (!email || !/^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(email) || email.length > 160) return Response.json({ ok: false }, { status: 400 });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { error } = await supabase.rpc("captar_lead", {
    p_nombre_empresa: "Por confirmar", p_contacto: "Por confirmar", p_email: email.trim(), p_telefono: "", p_ciudad: "", p_mensaje: "Pidió una demo desde la portada", p_fuente: "portada", p_trampa: "",
  });
  return Response.json({ ok: !error }, { status: error ? 500 : 200 });
}
