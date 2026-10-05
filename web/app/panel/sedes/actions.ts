"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function llamar(fn: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { error: error.message };
  revalidatePath("/panel/sedes");
  return { error: null };
}

export async function crearSede(tenantId: string, nombre: string, direccion: string, timezone: string) {
  return llamar("crear_sede", {
    p_tenant_id: tenantId,
    p_nombre: nombre,
    p_direccion: direccion || null,
    p_timezone: timezone,
  });
}
export async function cerrarSede(sedeId: string) {
  return llamar("cerrar_sede", { p_sede_id: sedeId });
}
export async function reabrirSede(sedeId: string) {
  return llamar("reabrir_sede", { p_sede_id: sedeId });
}
