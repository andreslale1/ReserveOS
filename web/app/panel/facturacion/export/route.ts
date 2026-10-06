import { NextResponse } from "next/server";
import { getPanelContext } from "@/lib/panel-context";

function esc(v: string | number | null) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Documentos pendientes de emitir fuera de ReserveOS (o todos), para pasarlos al certificador o al contador.
export async function GET(req: Request) {
  const { supabase, membership } = await getPanelContext();
  if (!membership) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!["duena", "gerente_general", "contadora"].includes(membership.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const estado = new URL(req.url).searchParams.get("estado");
  const { data, error } = await supabase.rpc("documentos_fiscales_listar", { p_tenant_id: membership.tenant_id, p_estado: estado || null });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const filas: (string | number | null)[][] = [["fecha", "sede", "nit_receptor", "nombre_receptor", "concepto", "monto_total", "iva_incluido", "estado", "serie", "numero"]];
  for (const d of (data ?? []) as Record<string, string | number | null>[]) filas.push([String(d.created_at).slice(0, 10), d.sede, d.nit_receptor, d.nombre_receptor, d.concepto, d.monto, d.iva, d.estado, d.serie, d.numero]);
  return new NextResponse("﻿" + filas.map((f) => f.map(esc).join(",")).join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="facturas-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
