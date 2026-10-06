"use server";

import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";

export async function hacerCheckin() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("hacer_checkin");
  if (error) return { error: error.message, clase: null as string | null };
  revalidatePath("/cuenta");
  return { error: null, clase: (data as { clase: string }).clase };
}

export async function renovarCodigo(tenantId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mi_codigo_checkin", { p_tenant_id: tenantId, p_renovar: true });
  if (error || !data) return null;
  const imagen = await QRCode.toDataURL(`RSCK:${data}`, { margin: 1, width: 440 });
  return { codigo: data as string, imagen };
}
