import { createClient } from "@/lib/supabase/server";

type Cambio = { campo: string; antes: unknown; despues: unknown };
type Fila = { created_at: string; actor: string; tabla: string; operacion: string; estudio: string | null; n: number; items: { registro: string | null; cambios: Cambio[] }[] };

const csv = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"`;
const val = (v: unknown) => (v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));

// Exporta lo filtrado en pantalla (ya redactado por la base). Autoriza la propia RPC: solo operador/auditor.
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  const filas: Fila[] = [];
  for (let pag = 0; pag < 25; pag++) {
    const { data, error } = await supabase.rpc("plataforma_auditoria_buscar", {
      p_desde: sp.get("desde") || null, p_hasta: sp.get("hasta") || null, p_tenant_id: sp.get("estudio") || null, p_actor: sp.get("actor") || null,
      p_tabla: sp.get("modulo") || null, p_operacion: sp.get("accion") || null, p_q: sp.get("q") || null, p_limite: 200, p_offset: pag * 200,
    });
    if (error) return new Response(error.message, { status: 403 });
    const r = data as { total: number; filas: Fila[] };
    filas.push(...r.filas);
    if (filas.length >= r.total) break;
  }
  const lineas = ["fecha_guatemala,quien,modulo,accion,estudio,registros,detalle"];
  for (const f of filas) {
    const fecha = new Date(f.created_at).toLocaleString("es-GT", { timeZone: "America/Guatemala" });
    const detalle = f.items.map((it) => `${it.registro ?? ""}: ` + it.cambios.map((c) => `${c.campo} ${val(c.antes)} -> ${val(c.despues)}`).join("; ")).join(" | ");
    lineas.push([fecha, f.actor, f.tabla, f.operacion, f.estudio, f.n, detalle].map(csv).join(","));
  }
  return new Response("﻿" + lineas.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="auditoria-reserveos.csv"', "Cache-Control": "no-store" } });
}
