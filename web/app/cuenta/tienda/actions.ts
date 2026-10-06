"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function llamar(fn: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { error: error.message, data: null };
  revalidatePath("/cuenta/tienda");
  return { error: null, data };
}
export async function agregarAlCarrito(tenantId: string, productoId: string, varianteId: string, cantidad: number) {
  return llamar("agregar_a_carrito", { p_tenant_id: tenantId, p_tipo: "producto", p_producto_id: productoId, p_variante_id: varianteId, p_paquete_id: null, p_cantidad: cantidad });
}
export async function quitarDelCarrito(itemId: string) {
  return llamar("quitar_de_carrito", { p_item_id: itemId });
}
export async function cambiarCantidad(itemId: string, cantidad: number) {
  return llamar("actualizar_cantidad_carrito", { p_item_id: itemId, p_cantidad: cantidad });
}
export async function confirmarPedido(tenantId: string, codigo: string) {
  return llamar("iniciar_checkout_carrito", { p_tenant_id: tenantId, p_metodo_pago: "efectivo", p_codigo_descuento: codigo || null });
}
