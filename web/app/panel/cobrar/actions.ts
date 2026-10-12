"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Cobro en recepción: crea la membresía ya pagada en la sede indicada. Los permisos los valida la base (staff en esa sede).
export async function cobrarPaquete(i: { clienteId: string; paqueteId: string; sedeId: string; metodo: string; codigo: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("agregar_membresia_manual", {
    p_cliente_id: i.clienteId,
    p_paquete_id: i.paqueteId,
    p_sede_venta_id: i.sedeId,
    p_metodo_pago: i.metodo,
    p_codigo_descuento: i.codigo.trim() || null,
  });
  if (error) return { error: error.message, resultado: null };
  revalidatePath("/panel/caja");
  revalidatePath("/panel/clientes");
  return { error: null, resultado: data as unknown };
}
