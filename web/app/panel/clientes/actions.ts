"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function crearCliente(input: {
  tenantId: string;
  nombre: string;
  telefono: string;
  email: string;
  sedeHabitualId: string | null;
  comoSeEntero: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_cliente", {
    p_tenant_id: input.tenantId,
    p_nombre: input.nombre,
    p_telefono: input.telefono,
    p_email: input.email || null,
    p_sede_habitual_id: input.sedeHabitualId,
    p_como_se_entero: input.comoSeEntero || null,
  });
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/panel/clientes");
  return { error: null };
}

export async function obtenerDetalleCliente(clienteId: string) {
  const supabase = await createClient();

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, nombre, telefono, email, created_at")
    .eq("id", clienteId)
    .maybeSingle();

  const { data: membresias } = await supabase
    .from("membresias")
    .select("id, estado, clases_totales, clases_usadas, fecha_vencimiento, precio_final")
    .eq("cliente_id", clienteId)
    .order("fecha_inicio", { ascending: false })
    .limit(3);

  const { data: reservas } = await supabase
    .from("reservas")
    .select("fecha, estado, asistio, horarios(nombre_clase, hora_inicio)")
    .eq("cliente_id", clienteId)
    .order("fecha", { ascending: false })
    .limit(8);

  return { cliente, membresias: membresias ?? [], reservas: reservas ?? [] };
}
