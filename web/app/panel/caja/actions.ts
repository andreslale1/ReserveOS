"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function cerrarCaja(input: {
  tenantId: string;
  sedeId: string;
  fecha: string;
  efectivoContado: number;
  tarjetaContado: number;
  transferenciaContado: number;
  notas: string;
}) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("cerrar_caja", {
    p_tenant_id: input.tenantId,
    p_sede_id: input.sedeId,
    p_fecha: input.fecha,
    p_efectivo_contado: input.efectivoContado,
    p_tarjeta_contado: input.tarjetaContado,
    p_transferencia_contado: input.transferenciaContado,
    p_notas: input.notas || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/panel/caja");
  return { error: null };
}
