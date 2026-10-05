import { redirect } from "next/navigation";
import { getPanelContext, puedeVer, rutaHabilitada } from "@/lib/panel-context";
import TiendaView from "./tienda-view";

export default async function TiendaPage() {
  const { supabase, membership, modulos } = await getPanelContext();

  if (!membership) {
    return null;
  }
  if (!puedeVer(membership.role, "/panel/tienda") || !rutaHabilitada(modulos, "/panel/tienda")) {
    redirect("/panel/hoy");
  }

  const esDuenaOGerente =
    membership.role === "duena" || membership.role === "gerente_general";

  const [{ data: catalogo }, { data: pedidos }, carritosRes] =
    await Promise.all([
      supabase.rpc("catalogo_productos", { p_tenant_id: membership.tenant_id }),
      supabase
        .from("pedidos")
        .select("id, estado, metodo_pago, total, created_at, clientes(nombre)")
        .eq("tenant_id", membership.tenant_id)
        .order("created_at", { ascending: false })
        .limit(20),
      esDuenaOGerente
        ? supabase.rpc("carritos_abandonados", {
            p_tenant_id: membership.tenant_id,
          })
        : Promise.resolve({ data: [] }),
    ]);

  type ProductoRPC = {
    producto_id: string;
    nombre: string;
    precio: number;
    unidad: string;
    categoria: string | null;
    variante_id: string;
    variante_nombre: string;
    stock: number;
  };

  const porProducto = new Map<
    string,
    { nombre: string; precio: number; unidad: string; categoria: string | null; variantes: { id: string; nombre: string; stock: number }[] }
  >();
  for (const row of (catalogo ?? []) as ProductoRPC[]) {
    if (!porProducto.has(row.producto_id)) {
      porProducto.set(row.producto_id, {
        nombre: row.nombre,
        precio: row.precio,
        unidad: row.unidad,
        categoria: row.categoria,
        variantes: [],
      });
    }
    porProducto.get(row.producto_id)!.variantes.push({
      id: row.variante_id,
      nombre: row.variante_nombre,
      stock: row.stock,
    });
  }

  return (
    <TiendaView
      productos={Array.from(porProducto.values())}
      pedidos={(pedidos ?? []).map((p) => ({
        id: p.id,
        estado: p.estado,
        metodoPago: p.metodo_pago,
        total: p.total,
        fecha: p.created_at,
        clienteNombre:
          (p.clientes as unknown as { nombre: string } | null)?.nombre ?? "—",
      }))}
      carritosAbandonados={carritosRes.data ?? []}
      esDuenaOGerente={esDuenaOGerente}
    />
  );
}
