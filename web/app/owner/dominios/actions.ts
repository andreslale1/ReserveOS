"use server";

import { resolve4, resolveCname, resolveTxt } from "node:dns/promises";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Est = "ok" | "error" | "pendiente";
export type Comprobacion = { dns: Est; dns_detalle: string; txt: Est; tls: Est; tls_detalle: string };

const esPublica = (ip: string) => {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return false;
  const [a, b] = p;
  return !(a === 10 || a === 127 || a === 0 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127));
};

// Comprueba DNS (CNAME a Vercel o A 76.76.21.21), el TXT de propiedad y que HTTPS responda con certificado válido sirviendo el estudio.
// Recibe el id (no el texto del dominio) y lo lee con permisos del operador, así no se puede apuntar el servidor a direcciones arbitrarias.
export async function comprobarDominio(id: string): Promise<{ error: string | null; r?: Comprobacion }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dominios_plataforma");
  if (error) return { error: error.message };
  const d = ((data ?? []) as { id: string; domain: string; slug: string; token_verificacion: string }[]).find((x) => x.id === id);
  if (!d) return { error: "Dominio no encontrado" };

  let dns: Est = "error", dnsDetalle = "";
  const cn = await resolveCname(d.domain).catch(() => [] as string[]);
  const a = await resolve4(d.domain).catch(() => [] as string[]);
  if (cn.some((c) => /vercel-dns\.com\.?$|vercel\.app\.?$/i.test(c))) { dns = "ok"; dnsDetalle = `CNAME → ${cn[0]}`; }
  else if (a.includes("76.76.21.21")) { dns = "ok"; dnsDetalle = "A → 76.76.21.21"; }
  else dnsDetalle = cn[0] ? `El CNAME apunta a ${cn[0]}, no a Vercel.` : a[0] ? `Apunta a ${a[0]}, no a Vercel.` : "Todavía no hay registro DNS para ese dominio.";

  const txts = await resolveTxt(`_reserveos.${d.domain}`).catch(() => [] as string[][]);
  const txt: Est = txts.some((t) => t.join("") === `reserveos-verify=${d.token_verificacion}`) ? "ok" : "pendiente";

  let tls: Est = "pendiente", tlsDetalle = "Se comprueba cuando el DNS esté bien.";
  if (dns === "ok") {
    const ips = a.length ? a : await resolve4(d.domain).catch(() => [] as string[]);
    if (ips.length && !ips.every(esPublica)) { tls = "error"; tlsDetalle = "El dominio resuelve a una dirección no pública; no se consulta."; }
    else {
      try {
        const res = await fetch(`https://${d.domain}/e/${d.slug}`, { redirect: "manual", signal: AbortSignal.timeout(8000), cache: "no-store" });
        if (res.status === 200) { tls = "ok"; tlsDetalle = "HTTPS válido y la página del estudio responde (200)."; }
        else { tls = "error"; tlsDetalle = `HTTPS responde ${res.status}: agrega el dominio al proyecto en Vercel y espera el certificado.`; }
      } catch (e) {
        tls = "error"; tlsDetalle = `Sin HTTPS válido (${e instanceof Error ? (e.cause as { code?: string } | undefined)?.code ?? e.message : "error"}). Si acabas de configurarlo, reintenta en unos minutos.`;
      }
    }
  }
  const { error: e2 } = await supabase.rpc("dominio_registrar_comprobacion", { p_id: id, p_dns: dns, p_dns_detalle: dnsDetalle, p_txt: txt, p_tls: tls, p_tls_detalle: tlsDetalle });
  if (e2) return { error: e2.message };
  revalidatePath("/owner/dominios");
  return { error: null, r: { dns, dns_detalle: dnsDetalle, txt, tls, tls_detalle: tlsDetalle } };
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
