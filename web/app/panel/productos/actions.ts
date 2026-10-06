"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function llamar(fn: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { error: error.message };
  revalidatePath("/panel/productos");
  revalidatePath("/panel/tienda");
  return { error: null };
}
export async function guardarProducto(i: { id: string | null; tenantId: string; nombre: string; descripcion: string; precio: number; categoria: string; imagen: string; activo: boolean }) {
  return llamar("producto_guardar", { p_id: i.id, p_tenant_id: i.tenantId, p_nombre: i.nombre, p_descripcion: i.descripcion || null, p_precio: i.precio, p_categoria: i.categoria || null, p_imagen_url: i.imagen || null, p_activo: i.activo });
}
export async function agregarVariante(productoId: string, nombre: string) {
  return llamar("variante_guardar", { p_producto_id: productoId, p_nombre: nombre });
}
export async function moverStock(varianteId: string, delta: number, tipo: string, motivo: string) {
  return llamar("inventario_ajustar", { p_variante_id: varianteId, p_delta: delta, p_tipo: tipo, p_motivo: motivo });
}
