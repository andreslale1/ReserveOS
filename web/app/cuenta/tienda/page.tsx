import { redirect } from "next/navigation";
import { getCuenta } from "@/lib/cuenta-context";
import TiendaView, { type Item, type ProductoCat, type Pedido } from "./tienda-view";

export default async function TiendaClientaPage() {
  const { supabase, actual } = await getCuenta();
  const t = actual!.tenant_id;
  const { data: mods } = await supabase.rpc("mis_modulos", { p_tenant_id: t });
  if (!((mods as string[] | null) ?? []).includes("tienda_inventario")) redirect("/cuenta");
  const [{ data: cat }, { data: carrito }, { data: pedidos }] = await Promise.all([
    supabase.rpc("catalogo_productos", { p_tenant_id: t }),
    supabase.rpc("mi_carrito"),
    supabase.rpc("mis_pedidos"),
  ]);
  const filas = (cat ?? []) as { producto_id: string; nombre: string; descripcion: string | null; precio: number; imagen_url: string | null; categoria: string | null; variante_id: string; variante_nombre: string; stock: number }[];
  const productos = new Map<string, ProductoCat>();
  for (const f of filas) {
    if (!productos.has(f.producto_id)) productos.set(f.producto_id, { id: f.producto_id, nombre: f.nombre, descripcion: f.descripcion ?? "", precio: Number(f.precio), imagen: f.imagen_url, categoria: f.categoria, variantes: [] });
    productos.get(f.producto_id)!.variantes.push({ id: f.variante_id, nombre: f.variante_nombre, stock: f.stock });
  }
  return <TiendaView tenantId={t} productos={[...productos.values()]} carrito={(carrito ?? []) as Item[]} pedidos={(pedidos ?? []) as Pedido[]} />;
}
