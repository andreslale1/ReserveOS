"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function solicitarPaquete(paqueteId: string, referencia: string, codigo: string, sedeId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("solicitar_membresia", {
    p_paquete_id: paqueteId, p_referencia_pago: referencia, p_metodo_pago: "transferencia", p_comprobante_url: null,
    p_cliente_id: null, p_codigo_descuento: codigo || null, p_sede_id: sedeId,
  });
  if (error) return { error: error.message };
  revalidatePath("/cuenta", "layout");
  return { error: null };
}

export async function canjearCodigo(tenantId: string, codigo: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("canjear_gift_card", { p_tenant_id: tenantId, p_codigo: codigo });
  if (error) return { error: error.message };
  revalidatePath("/cuenta", "layout");
  return { error: null };
}
