import { NextResponse } from "next/server";
import { getPanelContext } from "@/lib/panel-context";

// P38 de la matriz: "Exportar clientas y reservas nominales". Marcado G para
// dueña, G* (autorización) para gerente -- como todavia no existe un
// mecanismo de delegacion/autorizacion explicita, se limita de entrada a
// dueña y gerente_general (nunca admin_sede/recepcion, que son S*/sin
// permiso), siguiendo la nota de la matriz de "evitar exportación masiva
// por defecto".
function csvEscape(v: string | number | null) {
  const s = v === null || v === undefined ? "" : String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET() {
  const { supabase, membership } = await getPanelContext();

  if (!membership) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!["duena", "gerente_general"].includes(membership.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { data: clientes } = await supabase
    .from("clientes")
    .select(
      "id, nombre, telefono, email, created_at, membresias(estado, clases_totales, clases_usadas, fecha_vencimiento, precio_final), reservas(fecha, estado, asistio)",
    )
    .eq("tenant_id", membership.tenant_id)
    .order("nombre");

  const header = [
    "nombre",
    "telefono",
    "email",
    "alta",
    "estado_membresia",
    "clases_restantes",
    "vencimiento",
    "visitas",
    "ultima_visita",
    "ltv_q",
  ];

  const filas = (clientes ?? []).map((c) => {
    const membresiasCliente =
      (c.membresias as unknown as {
        estado: string;
        clases_totales: number | null;
        clases_usadas: number;
        fecha_vencimiento: string | null;
        precio_final: number | null;
      }[]) ?? [];
    const activa = membresiasCliente.find((m) => m.estado === "activa");

    const reservasCliente =
      (c.reservas as unknown as { fecha: string; asistio: boolean | null }[]) ??
      [];
    const asistencias = reservasCliente.filter((r) => r.asistio === true);
    const ultimaVisita = asistencias
      .map((r) => r.fecha)
      .sort()
      .at(-1);
    const ltv = membresiasCliente.reduce(
      (acc, m) => acc + (m.precio_final ?? 0),
      0,
    );

    return [
      c.nombre,
      c.telefono,
      c.email ?? "",
      c.created_at?.slice(0, 10) ?? "",
      activa ? "activa" : (membresiasCliente[0]?.estado ?? "sin_paquete"),
      activa ? (activa.clases_totales ?? 0) - activa.clases_usadas : "",
      activa?.fecha_vencimiento ?? "",
      reservasCliente.length,
      ultimaVisita ?? "",
      ltv,
    ];
  });

  const csv = [header, ...filas]
    .map((fila) => fila.map((v) => csvEscape(v as string | number | null)).join(","))
    .join("\n");

  const fecha = new Date().toISOString().slice(0, 10);
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clientas-${fecha}.csv"`,
    },
  });
}
