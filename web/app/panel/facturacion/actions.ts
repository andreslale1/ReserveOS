"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function llamar(fn: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { error: error.message };
  revalidatePath("/panel/facturacion");
  return { error: null };
}
export async function guardarConfigFiscal(tenantId: string, c: { nit: string; razon: string; comercial: string; direccion: string; regimen: string; serie: string }) {
  return llamar("fiscal_guardar_config", { p_tenant_id: tenantId, p_nit: c.nit, p_razon: c.razon, p_comercial: c.comercial || null, p_direccion: c.direccion, p_regimen: c.regimen, p_serie: c.serie || null });
}
export async function solicitarFactura(tenantId: string, tipo: string, origenId: string, nit: string, nombre: string, direccion: string) {
  return llamar("factura_solicitar", { p_tenant_id: tenantId, p_origen_tipo: tipo, p_origen_id: origenId, p_nit: nit, p_nombre: nombre, p_direccion: direccion || null });
}
export async function marcarEmitida(id: string, serie: string, numero: string, uuid: string) {
  return llamar("factura_marcar_emitida", { p_id: id, p_serie: serie || null, p_numero: numero, p_uuid: uuid || null });
}
export async function anularFactura(id: string, motivo: string) {
  return llamar("factura_anulada_manual", { p_id: id, p_motivo: motivo });
}
