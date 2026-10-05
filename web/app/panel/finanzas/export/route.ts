import { NextResponse } from "next/server";
import { getPanelContext } from "@/lib/panel-context";

// P37: exportar finanzas. Solo dueña, gerente general y contadora.
function esc(v: string | number | null) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const { supabase, membership } = await getPanelContext();
  if (!membership) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!["duena", "gerente_general", "contadora"].includes(membership.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const t = membership.tenant_id;
  const [{ data: ingresos }, { data: gastos }] = await Promise.all([
    supabase
      .from("membresias")
      .select("confirmado_at, created_at, precio_final, metodo_pago, origen, clientes(nombre), paquetes(nombre)")
      .eq("tenant_id", t)
      .eq("pagada", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("gastos")
      .select("fecha, categoria, descripcion, monto, tipo")
      .eq("tenant_id", t)
      .order("fecha", { ascending: false }),
  ]);

  const filas: (string | number | null)[][] = [["tipo", "fecha", "concepto", "detalle", "monto_q", "forma_pago"]];
  for (const i of ingresos ?? []) {
    filas.push([
      "ingreso",
      String(i.confirmado_at ?? i.created_at).slice(0, 10),
      (i.paquetes as unknown as { nombre: string } | null)?.nombre ?? "",
      (i.clientes as unknown as { nombre: string } | null)?.nombre ?? "",
      Number(i.precio_final ?? 0),
      i.metodo_pago,
    ]);
  }
  for (const g of gastos ?? []) {
    filas.push(["gasto", g.fecha, g.categoria, g.descripcion, -Number(g.monto), ""]);
  }
  const csv = "﻿" + filas.map((f) => f.map(esc).join(",")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="finanzas-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
