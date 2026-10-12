import { NextResponse } from "next/server";
import { getPanelContext, puedeVer } from "@/lib/panel-context";
import { argumentosHistorial, asistenciaTexto, DIAS, type FilaHistorial, type Filtros } from "../filtros";

// Descarga CSV (UTF-8 con BOM, para que Excel respete los acentos). Usa la misma función de la base que la pantalla: mismo alcance por rol y sede.
const celda = (v: unknown) => {
  let t = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;   // evita que una hoja de cálculo ejecute texto que parezca fórmula
  return `"${t.replace(/"/g, '""')}"`;
};

export async function GET(req: Request) {
  const { supabase, membership } = await getPanelContext();
  if (!membership || !puedeVer(membership.role, "/panel/historial")) return new NextResponse("No autorizado", { status: 403 });
  const f = Object.fromEntries(new URL(req.url).searchParams) as Filtros;
  const { data, error } = await supabase.rpc("historial_reservas", argumentosHistorial(membership.tenant_id, f, 5000, 0));
  if (error) return new NextResponse(error.message, { status: 400 });
  const filas = (data ?? []) as FilaHistorial[];
  const cab = ["Fecha", "Día", "Hora", "Clase", "Sede", "Instructora", "Clienta", "Tipo", "Estado", "Asistencia", "Confirmó asistencia"];
  const lineas = filas.map((r) => [r.fecha, DIAS[r.dia_semana], r.hora_inicio.slice(0, 5), r.nombre_clase, r.sede, r.instructora ?? "", r.cliente, r.tipo, r.estado, asistenciaTexto(r), r.confirmada ? "Sí" : "No"].map(celda).join(","));
  const cuerpo = "﻿" + [cab.map(celda).join(","), ...lineas].join("\r\n");
  return new NextResponse(cuerpo, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="historial-reservas.csv"`, "Cache-Control": "no-store" } });
}
