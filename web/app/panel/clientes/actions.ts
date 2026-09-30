"use server";

import { createClient } from "@/lib/supabase/server";

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
