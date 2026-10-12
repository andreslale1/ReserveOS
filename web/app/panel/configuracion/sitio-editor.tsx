"use client";

import { useState, useTransition } from "react";
import { guardarContacto, guardarSitio } from "./actions";

type Campo = { k: string; label: string; tipo?: "area" | "url"; ayuda?: string };
type Bloque = { id: string; titulo: string; visible?: string; campos: Campo[] };

// Bloques de la página pública. Cada uno con su interruptor «mostrar en el sitio» cuando aplica.
const BLOQUES: Bloque[] = [
  { id: "portada", titulo: "Portada", campos: [
    { k: "hero_tagline", label: "Frase corta sobre el título" }, { k: "hero_titulo_linea1", label: "Título (si lo dejas vacío se usa el nombre del estudio)" },
    { k: "hero_lede", label: "Descripción breve", tipo: "area" }, { k: "hero_imagen_url", label: "Imagen de portada (dirección https://…)", tipo: "url" } ] },
  { id: "acerca", titulo: "Acerca de nosotras", visible: "filosofia_visible", campos: [
    { k: "filosofia_eyebrow", label: "Etiqueta pequeña" }, { k: "filosofia_titulo", label: "Título" }, { k: "filosofia_texto", label: "Texto", tipo: "area" } ] },
  { id: "programas", titulo: "Programas (hasta 3)", visible: "programas_visible", campos: [
    { k: "programas_titulo", label: "Título de la sección" }, { k: "programas_texto", label: "Introducción", tipo: "area" },
    ...[1, 2, 3].flatMap((i) => [{ k: `programa${i}_titulo`, label: `Programa ${i}: nombre` }, { k: `programa${i}_texto`, label: `Programa ${i}: descripción`, tipo: "area" as const }, { k: `programa${i}_imagen_url`, label: `Programa ${i}: imagen (https://…)`, tipo: "url" as const }]) ] },
  { id: "paquetes", titulo: "Paquetes (precios y cobertura salen de tu catálogo)", visible: "paquetes_visible", campos: [
    { k: "paquetes_titulo", label: "Título de la sección" }, { k: "paquetes_texto", label: "Introducción", tipo: "area" },
    { k: "paquetes_nota_titulo", label: "Nota: título" }, { k: "paquetes_nota_texto", label: "Nota: texto (vigencias, políticas…)", tipo: "area" } ] },
  { id: "ubicacion", titulo: "Ubicación", visible: "ubicacion_visible", campos: [
    { k: "ubicacion_titulo", label: "Título" }, { k: "ubicacion_lugar_nombre", label: "Nombre del lugar" }, { k: "ubicacion_direccion_linea1", label: "Dirección (línea 1)" },
    { k: "ubicacion_direccion_linea2", label: "Dirección (línea 2)" }, { k: "ubicacion_google_maps_url", label: "Enlace de Google Maps (https://…)", tipo: "url" }, { k: "ubicacion_waze_url", label: "Enlace de Waze (https://…)", tipo: "url" } ] },
  { id: "opiniones", titulo: "Opiniones de clientas (solo las aprobadas)", visible: "reviews_visible", campos: [{ k: "reviews_titulo", label: "Título" }] },
  { id: "contacto", titulo: "Contacto", visible: "contacto_visible", campos: [{ k: "contacto_titulo", label: "Título" }, { k: "contacto_texto", label: "Texto", tipo: "area" }] },
  { id: "pie", titulo: "Pie de página", campos: [{ k: "footer_frase_cierre", label: "Frase de cierre" }] },
];

const input = "mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none focus:border-ink/30";
type Valor = string | boolean | null | undefined;

export default function SitioEditor({ tenantId, contenido, contacto }: { tenantId: string; contenido: Record<string, Valor> | null; contacto: { whatsapp: string; instagram: string; facebook: string } }) {
  const inicial: Record<string, string | boolean> = {};
  for (const b of BLOQUES) {
    if (b.visible) inicial[b.visible] = typeof contenido?.[b.visible] === "boolean" ? (contenido[b.visible] as boolean) : true;
    for (const c of b.campos) inicial[c.k] = typeof contenido?.[c.k] === "string" ? (contenido[c.k] as string) : "";
  }
  const [v, setV] = useState(inicial);
  const [ct, setCt] = useState(contacto);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [abierto, setAbierto] = useState<string | null>("portada");
  const [isPending, startTransition] = useTransition();

  return (
    <section className="rounded-2xl border border-white/10 bg-card p-5" aria-labelledby="sitio-t">
      <h2 id="sitio-t" className="text-base font-semibold text-ink">Tu página pública</h2>
      <p className="mt-1 text-sm text-ink/65">Textos, imágenes y bloques de <code>/e/tu-estudio</code>. Apaga un bloque con «Mostrar en el sitio» y deja de verse al instante. Las imágenes deben ser direcciones <strong>https://</strong>.</p>
      {msg && <p role="status" className={`mt-3 rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-sage-tint text-sage" : "bg-peach-tint text-ink"}`}>{msg.texto}</p>}

      <div className="mt-4 rounded-xl border border-white/10 p-4">
        <h3 className="text-sm font-semibold text-ink">Contacto y redes</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <label className="text-sm text-ink/60">WhatsApp (con código de país)<input inputMode="tel" placeholder="50255551234" className={input} value={ct.whatsapp} onChange={(e) => setCt({ ...ct, whatsapp: e.target.value })} /></label>
          <label className="text-sm text-ink/60">Instagram (https://…)<input className={input} value={ct.instagram} onChange={(e) => setCt({ ...ct, instagram: e.target.value })} /></label>
          <label className="text-sm text-ink/60">Facebook (https://…)<input className={input} value={ct.facebook} onChange={(e) => setCt({ ...ct, facebook: e.target.value })} /></label>
        </div>
        <button className="press-spring mt-3 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream disabled:opacity-50" disabled={isPending}
          onClick={() => { setMsg(null); startTransition(async () => { const r = await guardarContacto(tenantId, ct.whatsapp, ct.instagram, ct.facebook); setMsg(r.error ? { ok: false, texto: r.error } : { ok: true, texto: "Contacto guardado." }); }); }}>Guardar contacto</button>
      </div>

      <div className="mt-3 divide-y divide-white/10 rounded-xl border border-white/10">
        {BLOQUES.map((b) => (
          <div key={b.id} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <button type="button" className="text-left text-sm font-semibold text-ink" aria-expanded={abierto === b.id} aria-controls={`bl-${b.id}`} onClick={() => setAbierto(abierto === b.id ? null : b.id)}>
                {abierto === b.id ? "▾" : "▸"} {b.titulo}
              </button>
              {b.visible && (
                <label className="flex items-center gap-2 text-xs text-ink/70">
                  <input type="checkbox" checked={!!v[b.visible]} onChange={(e) => setV({ ...v, [b.visible!]: e.target.checked })} /> Mostrar en el sitio
                </label>
              )}
            </div>
            {abierto === b.id && (
              <div id={`bl-${b.id}`} className="mt-3 grid gap-3">
                {b.campos.map((c) => (
                  <label key={c.k} className="text-sm text-ink/60">{c.label}
                    {c.tipo === "area"
                      ? <textarea rows={3} maxLength={2000} className={input} value={String(v[c.k] ?? "")} onChange={(e) => setV({ ...v, [c.k]: e.target.value })} />
                      : <input type={c.tipo === "url" ? "url" : "text"} maxLength={c.tipo === "url" ? 500 : 300} className={input} value={String(v[c.k] ?? "")} onChange={(e) => setV({ ...v, [c.k]: e.target.value })} />}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <button className="press-spring mt-4 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream disabled:opacity-50" disabled={isPending}
        onClick={() => { setMsg(null); startTransition(async () => { const r = await guardarSitio(tenantId, v); setMsg(r.error ? { ok: false, texto: r.error } : { ok: true, texto: "Página guardada. Ya se ve en tu sitio." }); }); }}>
        {isPending ? "Guardando…" : "Guardar página"}
      </button>
    </section>
  );
}
