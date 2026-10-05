import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";
import PagosPendientesView from "./pagos-pendientes-view";

export default async function PagosPendientesPage() {
  const { supabase, membership } = await getPanelContext();

  if (!membership) {
    return null;
  }
  if (!puedeVer(membership.role, "/panel/pagos-pendientes")) {
    redirect("/panel/hoy");
  }

  const { data: pendientes } = await supabase
    .from("membresias")
    .select(
      "id, metodo_pago, referencia_pago, comprobante_url, created_at, clientes(nombre, telefono), paquetes(nombre, precio), sedes:sede_venta_id(name)",
    )
    .eq("tenant_id", membership.tenant_id)
    .eq("pagada", false)
    .eq("estado", "activa")
    .order("created_at", { ascending: true });

  const filas = (pendientes ?? []).map((m) => ({
    id: m.id,
    metodoPago: m.metodo_pago,
    referenciaPago: m.referencia_pago,
    comprobanteUrl: m.comprobante_url,
    fecha: m.created_at,
    clienteNombre:
      (m.clientes as unknown as { nombre: string } | null)?.nombre ?? "—",
    clienteTelefono:
      (m.clientes as unknown as { telefono: string } | null)?.telefono ?? "",
    paqueteNombre:
      (m.paquetes as unknown as { nombre: string } | null)?.nombre ?? "—",
    paquetePrecio:
      (m.paquetes as unknown as { precio: number } | null)?.precio ?? 0,
    sedeNombre: (m.sedes as unknown as { name: string } | null)?.name ?? "—",
  }));

  return <PagosPendientesView pendientes={filas} />;
}
