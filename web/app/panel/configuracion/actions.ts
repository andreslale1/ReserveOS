"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function guardarMarca(tenantId: string, nombre: string, colorPrimario: string, logoUrl: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_marca", {
    p_tenant_id: tenantId,
    p_nombre: nombre,
    p_branding: { color_primario: colorPrimario || null, logo_url: logoUrl || null },
  });
  if (error) return { error: error.message };
  revalidatePath("/panel/configuracion");
  revalidatePath("/panel", "layout");
  return { error: null };
}
