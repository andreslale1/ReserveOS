import { createClient } from "@supabase/supabase-js";

// Alerta diaria (7:00 hora de Guatemala) al equipo de ReserveOS con los estudios que requieren atención.
// No envía nada si todo está sano o si el correo no está configurado.
export const maxDuration = 60;

type Fila = { nombre: string; puntos: number; motivos: string[] };
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: "No autorizado" }, { status: 401 });
  const key = process.env.RESEND_API_KEY, de = process.env.RESEND_FROM_EMAIL, srv = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !de || !srv) return Response.json({ ok: true, nota: "Correo no configurado" });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, srv, { auth: { persistSession: false } });
  const [{ data }, { data: dest }] = await Promise.all([supabase.rpc("_estudios_atencion"), supabase.rpc("_destinatarios_alerta")]);
  const urgentes = ((data ?? []) as Fila[]).filter((f) => f.puntos >= 3);
  const to = ((dest ?? []) as { email: string }[]).map((d) => d.email);
  if (urgentes.length === 0 || to.length === 0) return Response.json({ ok: true, enviados: 0 });

  const lista = urgentes.map((f) => `<li><strong>${esc(f.nombre)}</strong>: ${esc(f.motivos.join(" · "))}</li>`).join("");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `ReserveOS <${de}>`, to,
      subject: `${urgentes.length} estudio(s) requieren atención hoy`,
      html: `<div style="font-family:Arial,sans-serif;font-size:15px"><p>Estudios que requieren atención:</p><ul>${lista}</ul><p><a href="https://reserveos.app/owner/atencion">Abrir panel de atención</a></p></div>`,
    }),
  });
  return Response.json({ ok: r.ok, enviados: r.ok ? to.length : 0 });
}
