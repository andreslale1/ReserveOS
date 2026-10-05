import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";
import ClientesView from "./clientes-view";

export default async function ClientesPage() {
  const { supabase, membership } = await getPanelContext();

  if (!membership) {
    return null;
  }
  if (!puedeVer(membership.role, "/panel/clientes")) {
    redirect("/panel/hoy");
  }

  const { data: clientes } = await supabase
    .from("clientes")
    .select(
      "id, nombre, telefono, email, membresias(estado, clases_totales, clases_usadas, fecha_vencimiento, precio_final), reservas(fecha, asistio)",
    )
    .eq("tenant_id", membership.tenant_id)
    .order("nombre");

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

    return {
      id: c.id,
      nombre: c.nombre,
      telefono: c.telefono,
      email: c.email,
      estadoMembresia: activa
        ? "activa"
        : (membresiasCliente[0]?.estado ?? "sin_paquete"),
      clasesRestantes: activa
        ? (activa.clases_totales ?? 0) - activa.clases_usadas
        : null,
      vencimiento: activa?.fecha_vencimiento ?? null,
      visitas: reservasCliente.length,
      ultimaVisita: ultimaVisita ?? null,
      ltv,
    };
  });

  return (
    <ClientesView
      clientes={filas}
      puedeExportar={["duena", "gerente_general"].includes(membership.role)}
    />
  );
}
