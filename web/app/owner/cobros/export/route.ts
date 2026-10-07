import { NextResponse } from "next/server";
import { getOwnerContext } from "@/lib/owner-context";
import { hoyGT } from "@/lib/fechas";

function esc(v: string | number | null) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Exporte para contabilidad de ReserveOS: todos los cobros con su saldo.
export async function GET() {
  const { supabase } = await getOwnerContext();
  const { data, error } = await supabase.rpc("plataforma_cobros_listar", { p_estado: null });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  const filas: (string | number | null)[][] = [["estudio", "periodo", "concepto", "plan", "monto", "descuento", "pagado", "saldo", "estado", "vence", "fecha_pago", "metodo", "referencia"]];
  for (const c of (data ?? []) as Record<string, string | number | null>[]) {
    filas.push([c.estudio, String(c.periodo).slice(0, 7), c.concepto, c.plan_snapshot, c.monto, c.descuento, c.pagado, c.saldo, c.estado, c.fecha_vencimiento, c.fecha_pago, c.metodo, c.referencia]);
  }
  return new NextResponse("﻿" + filas.map((f) => f.map(esc).join(",")).join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="cobros-reserveos-${hoyGT()}.csv"` },
  });
}
