import { createClient } from "@supabase/supabase-js";

// Recibe eventos de un proveedor de pagos. El cuerpo se pasa TAL CUAL (sin reescribirlo) a la base, que verifica la
// firma HMAC con el secreto del estudio, descarta repeticiones y solo entonces activa la compra. Nunca se confía en el
// contenido sin firma válida.
export async function POST(req: Request, { params }: { params: Promise<{ slug: string; proveedor: string }> }) {
  const { slug, proveedor } = await params;
  const cuerpo = await req.text();
  if (cuerpo.length > 20_000) return Response.json({ error: "Cuerpo demasiado grande" }, { status: 413 });
  const firma = req.headers.get("x-reserveos-signature") ?? "";

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("pago_webhook", { p_slug: slug, p_proveedor: proveedor, p_firma: firma, p_cuerpo: cuerpo });
  if (error) {
    const firmaMala = /Firma inv|no v[aá]lida/i.test(error.message);
    return Response.json({ error: firmaMala ? "No autorizado" : error.message }, { status: firmaMala ? 401 : 400 });
  }
  return Response.json(data ?? { ok: true });
}
