"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function venderGiftCard(i: { tenantId: string; sedeId: string; paqueteId: string; comprador: string; destinatario: string; email: string; metodo: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("gift_card_vender", { p_tenant_id: i.tenantId, p_sede_id: i.sedeId, p_paquete_id: i.paqueteId, p_comprador: i.comprador, p_destinatario: i.destinatario, p_email: i.email, p_metodo: i.metodo });
  if (error) return { error: error.message, codigo: null as string | null };
  revalidatePath("/panel/gift-cards");
  return { error: null, codigo: (data as { codigo: string }).codigo };
}
export async function anularGiftCard(id: string, motivo: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("gift_card_anular", { p_id: id, p_motivo: motivo });
  if (error) return { error: error.message };
  revalidatePath("/panel/gift-cards");
  return { error: null };
}
