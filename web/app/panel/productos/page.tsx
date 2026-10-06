import { redirect } from "next/navigation";
import { getPanelContext, puedeVer, rutaHabilitada } from "@/lib/panel-context";
import ProductosView, { type Producto, type Movimiento } from "./productos-view";

export default async function ProductosPage() {
  const { supabase, membership, modulos } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/productos") || !rutaHabilitada(modulos, "/panel/productos")) redirect("/panel/hoy");
  const t = membership.tenant_id;
  const [{ data: prods }, { data: movs }] = await Promise.all([
    supabase.from("productos").select("id, nombre, descripcion, precio, categoria, imagen_url, activo, producto_variantes(id, nombre, stock)").eq("tenant_id", t).order("nombre"),
    supabase.rpc("movimientos_listar", { p_tenant_id: t, p_variante_id: null }),
  ]);
  return (
    <ProductosView
      tenantId={t}
      puedeGestionar={["duena", "gerente_general"].includes(membership.role)}
      productos={((prods ?? []) as unknown as { id: string; nombre: string; descripcion: string | null; precio: number; categoria: string | null; imagen_url: string | null; activo: boolean; producto_variantes: { id: string; nombre: string; stock: number }[] }[]).map((p) => ({
        id: p.id, nombre: p.nombre, descripcion: p.descripcion ?? "", precio: Number(p.precio), categoria: p.categoria ?? "", imagen: p.imagen_url ?? "", activo: p.activo, variantes: p.producto_variantes ?? [],
      })) as Producto[]}
      movimientos={(movs ?? []) as Movimiento[]}
    />
  );
}
