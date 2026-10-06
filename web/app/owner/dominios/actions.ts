"use server";

import { resolveCname, resolve4 } from "node:dns/promises";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Comprueba que el dominio apunte a Vercel (CNAME cname.vercel-dns.com o A 76.76.21.21).
export async function comprobarDns(domain: string) {
  try {
    const cn = await resolveCname(domain).catch(() => [] as string[]);
    if (cn.some((c) => c.toLowerCase().includes("vercel-dns.com") || c.toLowerCase().includes("vercel.app"))) return { ok: true, detalle: `CNAME → ${cn[0]}` };
    const a = await resolve4(domain).catch(() => [] as string[]);
    if (a.includes("76.76.21.21")) return { ok: true, detalle: "A → 76.76.21.21" };
    return { ok: false, detalle: cn[0] ? `Apunta a ${cn[0]}, no a Vercel.` : a[0] ? `Apunta a ${a[0]}, no a Vercel.` : "Todavía no hay registro DNS para ese dominio." };
  } catch {
    return { ok: false, detalle: "No se pudo consultar el DNS." };
  }
}
export async function activarDominio(id: string, verificado: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("dominio_verificar", { p_id: id, p_verificado: verificado });
  if (error) return { error: error.message };
  revalidatePath("/owner/dominios");
  return { error: null };
}
export async function bajaDominio(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("dominio_baja", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/owner/dominios");
  return { error: null };
}
