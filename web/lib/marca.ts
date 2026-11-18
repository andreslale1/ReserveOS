import { cache, type CSSProperties } from "react";
import { vocab, type Vocabulario } from "@/lib/giros";
import { createClient } from "@/lib/supabase/server";

export type Marca = { color: string | null; logo: string | null; nombre: string; giro: string };

const HEX = /^#[0-9a-fA-F]{6}$/;
const https = (u: unknown): string | null => (typeof u === "string" && /^https:\/\//i.test(u) ? u : null);

function luz(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
// Tema de estudio claro: el acento lleva texto crema encima, así que si el color de la marca es muy claro se oscurece
// hasta que se lea (nunca se rechaza la marca).
function legible(hex: string) {
  let h = hex;
  for (let i = 0; i < 14 && luz(h) > 0.22; i++) {
    const n = [1, 3, 5].map((k) => Math.max(0, Math.round(parseInt(h.slice(k, k + 2), 16) * 0.88)));
    h = "#" + n.map((v) => v.toString(16).padStart(2, "0")).join("");
  }
  return h;
}

export function estiloMarca(color: string | null | undefined): CSSProperties | undefined {
  if (!color || !HEX.test(color)) return undefined;
  const a = legible(color);
  return {
    "--color-lime": a, "--color-peach": a, "--color-blue": a, "--color-sage": a,
    "--color-lime-dim": `color-mix(in srgb, ${a} 85%, white)`,
    "--color-peach-tint": `color-mix(in srgb, ${a} 14%, #f3f0ea)`,
    "--color-blue-tint": `color-mix(in srgb, ${a} 14%, #f3f0ea)`,
    "--color-sage-tint": `color-mix(in srgb, ${a} 14%, #f3f0ea)`,
  } as CSSProperties;
}

// Marca pública del estudio por slug (misma función pública que usa la página /e/[slug]). Cacheada por petición.
export const marcaPorSlug = cache(async (slug: string | null | undefined): Promise<Marca | null> => {
  if (!slug) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("horarios_publicos", { p_slug: slug });
  const e = data as { nombre?: string; color?: string | null; logo?: string | null; giro?: string | null } | null;
  if (!e) return null;
  return { color: HEX.test(e.color ?? "") ? (e.color as string) : null, logo: https(e.logo), nombre: e.nombre ?? "", giro: e.giro ?? "pilates" };
});

/** Vocabulario del giro del estudio (atleta/clienta, WOD/clase, coach/instructora). */
export async function vocabularioDe(slug: string | null | undefined): Promise<Vocabulario> {
  const m = await marcaPorSlug(slug);
  return vocab(m?.giro);
}
