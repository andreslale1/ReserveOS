import { NextResponse } from "next/server";
import { getPanelContext } from "@/lib/panel-context";
import { aCsv, reportePorId } from "@/lib/reportes-catalogo";
import { hoyGT, primerDiaMesGT } from "@/lib/fechas";

// Exportaciones Excel/CSV. Cada una corre con la sesión de quien la pide: el alcance por sede lo aplica la base de datos.
export async function GET(req: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  const { supabase, membership, sedes } = await getPanelContext();
  if (!membership) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const rep = reportePorId(tipo);
  if (!rep) return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 });
  if (!rep.roles.includes(membership.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const url = new URL(req.url);
  const fecha = /^\d{4}-\d{2}-\d{2}$/;
  const desde = fecha.test(url.searchParams.get("desde") ?? "") ? url.searchParams.get("desde")! : primerDiaMesGT();
  const hasta = fecha.test(url.searchParams.get("hasta") ?? "") ? url.searchParams.get("hasta")! : hoyGT();
  const sedeParam = url.searchParams.get("sede");
  const sedeId = sedeParam && sedes.some((s) => s.id === sedeParam) ? sedeParam : null;
  if (desde > hasta) return NextResponse.json({ error: "La fecha inicial es posterior a la final" }, { status: 400 });

  try {
    const tabla = await rep.ejecutar(supabase, { tenantId: membership.tenant_id, desde, hasta, sedeId });
    return new NextResponse(aCsv(tabla), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${rep.id}-${desde}_a_${hasta}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo generar el reporte" }, { status: 400 });
  }
}
