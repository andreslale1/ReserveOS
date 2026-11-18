import { createClient } from "@supabase/supabase-js";

// Envía los correos pendientes de la cola (cola_mensajes) por Resend. Lo llama el cron de Vercel cada 5 minutos.
// Sin RESEND_API_KEY no envía nada: los mensajes quedan en la cola, nunca se pierden.
export const maxDuration = 60;

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}` || !process.env.CRON_SECRET) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const key = process.env.RESEND_API_KEY;
  const de = process.env.RESEND_FROM_EMAIL;
  const srv = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !de || !srv) return Response.json({ ok: true, enviados: 0, nota: "Correo no configurado: la cola espera" });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, srv, { auth: { persistSession: false } });
  const { data: lote, error } = await supabase.rpc("cola_tomar", { p_lote: 50 });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const mensajes = (lote ?? []) as { id: string; tenant_id: string; canal: string; destino: string; asunto: string | null; cuerpo: string }[];
  const ids = [...new Set(mensajes.map((m) => m.tenant_id))];
  const { data: ts } = ids.length ? await supabase.from("tenants").select("id, name").in("id", ids) : { data: [] };
  const nombre = new Map((ts ?? []).map((t) => [t.id, t.name as string]));

  let enviados = 0, fallidos = 0;
  for (const m of mensajes) {
    if (m.canal !== "email") {
      await supabase.rpc("cola_resultado", { p_id: m.id, p_ok: false, p_error: `Canal ${m.canal} sin proveedor conectado` });
      continue;
    }
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": m.id },
        body: JSON.stringify({
          from: `${(nombre.get(m.tenant_id) ?? "ReserveOS").replace(/[<>"]/g, "")} <${de}>`,
          to: [m.destino],
          subject: m.asunto || "Mensaje de tu estudio",
          html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;white-space:pre-wrap">${esc(m.cuerpo)}</div>`,
        }),
      });
      if (r.ok) { enviados++; await supabase.rpc("cola_resultado", { p_id: m.id, p_ok: true }); }
      else { fallidos++; await supabase.rpc("cola_resultado", { p_id: m.id, p_ok: false, p_error: `Resend ${r.status}: ${(await r.text()).slice(0, 200)}` }); }
    } catch (e) {
      fallidos++;
      await supabase.rpc("cola_resultado", { p_id: m.id, p_ok: false, p_error: String(e).slice(0, 200) });
    }
  }
  return Response.json({ ok: true, enviados, fallidos });
}
