import { getPanelContext } from "@/lib/panel-context";
import ClientesView from "./clientes-view";

export default async function ClientesPage() {
  const { supabase, membership } = await getPanelContext();

  if (!membership) {
    return null;
  }

  const { data: clientes } = await supabase
    .from("clientes")
    .select(
      "id, nombre, telefono, email, membresias(estado, clases_totales, clases_usadas, fecha_vencimiento)",
    )
    .eq("tenant_id", membership.tenant_id)
    .order("nombre");

  const filas = (clientes ?? []).map((c) => {
    const membresiasCliente = (
      (c.membresias as unknown as {
        estado: string;
        clases_totales: number | null;
        clases_usadas: number;
        fecha_vencimiento: string | null;
      }[]) ?? []
    );
    const activa = membresiasCliente.find((m) => m.estado === "activa");

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
    };
  });

  return <ClientesView clientes={filas} />;
}
