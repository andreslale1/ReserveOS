import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const ORDEN = [1, 2, 3, 4, 5, 6, 0];

type Contenido = Record<string, string | boolean | null>;
type Publico = {
  id: string; nombre: string; slug: string; color: string | null; logo: string | null;
  sedes: { id: string; nombre: string; direccion: string | null }[];
  clases: { id: string; sede_id: string; dia: number; inicio: string; fin: string; nombre: string; cupo: number; instructora: string }[];
  paquetes: { id: string; nombre: string; descripcion: string | null; num_clases: number | null; precio: number; vigencia_dias: number; destacado: boolean; etiqueta: string | null; cobertura: string | null }[];
  contacto: { whatsapp: string | null; instagram: string | null; facebook: string | null } | null;
  contenido: Contenido | null;
  testimonios: { nombre: string; texto: string; calificacion: number }[];
};

const https = (u: unknown): string | null => (typeof u === "string" && /^https:\/\//i.test(u) ? u : null);
const txt = (c: Contenido | null, k: string): string => (typeof c?.[k] === "string" ? (c[k] as string).trim() : "");
const visible = (c: Contenido | null, k: string, porDefecto: boolean) => (c && typeof c[k] === "boolean" ? (c[k] as boolean) : porDefecto);
const q = (n: number) => `Q${Number(n).toLocaleString("es-GT")}`;

async function cargar(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("horarios_publicos", { p_slug: slug });
  return data as Publico | null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const e = await cargar((await params).slug);
  if (!e) return { title: "Estudio no encontrado" };
  const desc = txt(e.contenido, "hero_lede") || `Reserva tus clases en ${e.nombre}: horarios, paquetes y tu cuenta en un solo lugar.`;
  return { title: `${e.nombre} · Reservas`, description: desc, openGraph: { title: e.nombre, description: desc, images: https(e.contenido?.hero_imagen_url) ? [https(e.contenido?.hero_imagen_url)!] : undefined } };
}

export default async function EstudioPublico({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = await cargar(slug);
  if (!e) notFound();

  const c = e.contenido;
  const color = /^#[0-9a-fA-F]{6}$/.test(e.color ?? "") ? (e.color as string) : "#E8B89B";
  const wa = (e.contacto?.whatsapp ?? "").replace(/\D/g, "");
  const waUrl = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(`Hola ${e.nombre}, quiero información sobre las clases.`)}` : null;
  const registro = (next: string) => `/registro/${e.slug}?next=${encodeURIComponent(next)}`;
  const entrar = `/login?e=${e.slug}&next=${encodeURIComponent("/cuenta/clases")}`;
  const heroImg = https(c?.hero_imagen_url);
  const titulo = txt(c, "hero_titulo_linea1") || e.nombre;
  const btn = "rounded-full px-5 py-2.5 text-sm font-semibold text-ink";

  return (
    <main className="min-h-screen bg-cream text-ink">
      <header className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-6 py-6">
        <div className="flex items-center gap-3">
          {(https(e.logo)) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={https(e.logo)!} alt={`Logo de ${e.nombre}`} className="h-10 w-auto" />
          )}
          <span className="font-serif text-xl">{e.nombre}</span>
        </div>
        <nav aria-label="Acciones" className="flex flex-wrap items-center gap-2 text-sm">
          <Link href={entrar} target="_top" className="rounded-full border border-ink/20 px-4 py-2 hover:border-ink/50">Entrar</Link>
          <Link href={registro("/cuenta/clases")} target="_top" className={btn} style={{ backgroundColor: color }}>Crear cuenta</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-10 pt-4">
        <div className={heroImg ? "grid items-center gap-8 md:grid-cols-2" : ""}>
          <div>
            {txt(c, "hero_tagline") && <p className="text-xs font-medium uppercase tracking-widest text-ink/55">{txt(c, "hero_tagline")}</p>}
            <h1 className="mt-2 font-serif text-4xl leading-tight md:text-5xl">{titulo}</h1>
            <p className="mt-4 max-w-xl text-base text-ink/70">{txt(c, "hero_lede") || "Reserva tus clases, compra tu paquete y sigue tu cuenta desde cualquier dispositivo."}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={`/e/${e.slug}/prueba`} target="_top" className={btn} style={{ backgroundColor: color }}>Agendar clase de prueba</Link>
              <Link href={entrar} target="_top" className="rounded-full border border-ink/25 px-5 py-2.5 text-sm font-semibold hover:border-ink/50">Reservar mi clase</Link>
              {waUrl && <a href={waUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-ink/25 px-5 py-2.5 text-sm font-semibold hover:border-ink/50">Escribir por WhatsApp</a>}
            </div>
          </div>
          {heroImg && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroImg} alt="" className="aspect-[4/3] w-full rounded-3xl object-cover" />
          )}
        </div>
      </section>

      {visible(c, "filosofia_visible", true) && (txt(c, "filosofia_titulo") || txt(c, "filosofia_texto")) && (
        <section className="mx-auto max-w-4xl px-6 py-8" aria-labelledby="acerca">
          {txt(c, "filosofia_eyebrow") && <p className="text-xs font-medium uppercase tracking-widest text-ink/55">{txt(c, "filosofia_eyebrow")}</p>}
          <h2 id="acerca" className="mt-1 font-serif text-2xl">{txt(c, "filosofia_titulo") || "Acerca de nosotras"}</h2>
          <p className="mt-3 max-w-2xl whitespace-pre-line text-ink/70">{txt(c, "filosofia_texto")}</p>
        </section>
      )}

      {visible(c, "programas_visible", true) && [1, 2, 3].some((i) => txt(c, `programa${i}_titulo`)) && (
        <section className="mx-auto max-w-4xl px-6 py-8" aria-labelledby="programas">
          <h2 id="programas" className="font-serif text-2xl">{txt(c, "programas_titulo") || "Nuestros programas"}</h2>
          {txt(c, "programas_texto") && <p className="mt-2 max-w-2xl text-ink/70">{txt(c, "programas_texto")}</p>}
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].filter((i) => txt(c, `programa${i}_titulo`)).map((i) => (
              <article key={i} className="overflow-hidden rounded-2xl border border-ink/10 bg-card">
                {https(c?.[`programa${i}_imagen_url`]) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={https(c?.[`programa${i}_imagen_url`])!} alt="" className="aspect-[4/3] w-full object-cover" />
                )}
                <div className="p-4"><h3 className="font-semibold">{txt(c, `programa${i}_titulo`)}</h3><p className="mt-1 text-sm text-ink/65">{txt(c, `programa${i}_texto`)}</p></div>
              </article>
            ))}
          </div>
        </section>
      )}

      {e.paquetes.length > 0 && (
        <section className="mx-auto max-w-4xl px-6 py-8" aria-labelledby="paquetes">
          <h2 id="paquetes" className="font-serif text-2xl">{txt(c, "paquetes_titulo") || "Paquetes"}</h2>
          {txt(c, "paquetes_texto") && <p className="mt-2 max-w-2xl text-ink/70">{txt(c, "paquetes_texto")}</p>}
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {e.paquetes.map((p) => (
              <article key={p.id} className={`flex flex-col rounded-2xl border bg-card p-5 ${p.destacado ? "border-2" : "border-ink/10"}`} style={p.destacado ? { borderColor: color } : undefined}>
                {(p.etiqueta || p.destacado) && <span className="mb-2 w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: color }}>{p.etiqueta || "Recomendado"}</span>}
                <h3 className="text-lg font-semibold">{p.nombre}</h3>
                <p className="mt-1 font-serif text-3xl">{q(p.precio)}</p>
                <p className="mt-1 text-sm text-ink/60">
                  {p.num_clases ? `${p.num_clases} clase${p.num_clases === 1 ? "" : "s"}` : "Clases ilimitadas"} · vigencia {p.vigencia_dias} días
                </p>
                {p.cobertura && <p className="mt-1 text-xs text-ink/55">Válido en: {p.cobertura}</p>}
                {p.descripcion && <p className="mt-2 text-sm text-ink/65">{p.descripcion}</p>}
                <Link href={registro(`/cuenta/paquetes?paquete=${p.id}`)} target="_top" className="mt-4 rounded-full border border-ink/25 px-4 py-2 text-center text-sm font-semibold hover:border-ink/50">Elegir este paquete</Link>
              </article>
            ))}
          </div>
          {txt(c, "paquetes_nota_texto") && <p className="mt-4 text-sm text-ink/60"><strong>{txt(c, "paquetes_nota_titulo")}</strong> {txt(c, "paquetes_nota_texto")}</p>}
        </section>
      )}

      <section className="mx-auto max-w-4xl px-6 py-8" aria-labelledby="horarios">
        <h2 id="horarios" className="font-serif text-2xl">Horarios</h2>
        {e.sedes.map((s) => {
          const clases = e.clases.filter((x) => x.sede_id === s.id);
          return (
            <div key={s.id} className="mt-4 rounded-2xl border border-ink/10 bg-card p-5">
              <h3 className="text-lg font-semibold">{s.nombre}</h3>
              {s.direccion && <p className="text-sm text-ink/60">{s.direccion}</p>}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {ORDEN.map((d) => {
                  const del = clases.filter((x) => x.dia === d);
                  if (del.length === 0) return null;
                  return (
                    <div key={d}>
                      <p className="text-xs font-medium uppercase tracking-wide text-ink/45">{DIAS[d]}</p>
                      <ul className="mt-1 space-y-1">
                        {del.map((x) => (
                          <li key={x.id} className="text-sm">
                            <Link href={registro(`/cuenta/clases?sede=${s.id}&horario=${x.id}`)} target="_top" className="underline decoration-ink/25 underline-offset-2 hover:decoration-ink">
                              {x.inicio.slice(0, 5)} · {x.nombre}
                            </Link>
                            {x.instructora ? <span className="text-ink/55"> · {x.instructora}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
                {clases.length === 0 && <p className="text-sm text-ink/50">Próximamente.</p>}
              </div>
            </div>
          );
        })}
      </section>

      {visible(c, "ubicacion_visible", true) && (txt(c, "ubicacion_direccion_linea1") || https(c?.ubicacion_google_maps_url)) && (
        <section className="mx-auto max-w-4xl px-6 py-8" aria-labelledby="ubicacion">
          <h2 id="ubicacion" className="font-serif text-2xl">{txt(c, "ubicacion_titulo") || "Cómo llegar"}</h2>
          <p className="mt-2 text-ink/70">{[txt(c, "ubicacion_lugar_nombre"), txt(c, "ubicacion_direccion_linea1"), txt(c, "ubicacion_direccion_linea2")].filter(Boolean).join(" · ")}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {https(c?.ubicacion_google_maps_url) && <a className="underline" href={https(c?.ubicacion_google_maps_url)!} target="_blank" rel="noopener noreferrer">Abrir en Google Maps</a>}
            {https(c?.ubicacion_waze_url) && <a className="underline" href={https(c?.ubicacion_waze_url)!} target="_blank" rel="noopener noreferrer">Abrir en Waze</a>}
          </div>
        </section>
      )}

      {e.testimonios.length > 0 && (
        <section className="mx-auto max-w-4xl px-6 py-8" aria-labelledby="opiniones">
          <h2 id="opiniones" className="font-serif text-2xl">{txt(c, "reviews_titulo") || "Lo que dicen nuestras clientas"}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {e.testimonios.map((t, i) => (
              <figure key={i} className="rounded-2xl border border-ink/10 bg-card p-5">
                <p aria-label={`${t.calificacion} de 5 estrellas`} className="text-sm" style={{ color: "#B7791F" }}>{"★".repeat(Math.max(0, Math.min(5, t.calificacion)))}</p>
                <blockquote className="mt-1 text-sm text-ink/80">“{t.texto}”</blockquote>
                <figcaption className="mt-2 text-xs text-ink/55">{t.nombre}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {visible(c, "contacto_visible", true) && (waUrl || e.contacto?.instagram || e.contacto?.facebook || txt(c, "contacto_texto")) && (
        <section className="mx-auto max-w-4xl px-6 py-8" aria-labelledby="contacto">
          <h2 id="contacto" className="font-serif text-2xl">{txt(c, "contacto_titulo") || "Contacto"}</h2>
          {txt(c, "contacto_texto") && <p className="mt-2 text-ink/70">{txt(c, "contacto_texto")}</p>}
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            {waUrl && <a className="underline" href={waUrl} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
            {https(e.contacto?.instagram) && <a className="underline" href={https(e.contacto?.instagram)!} target="_blank" rel="noopener noreferrer">Instagram</a>}
            {https(e.contacto?.facebook) && <a className="underline" href={https(e.contacto?.facebook)!} target="_blank" rel="noopener noreferrer">Facebook</a>}
          </div>
        </section>
      )}

      <footer className="mx-auto max-w-4xl px-6 pb-10 pt-6 text-center text-xs text-ink/45">
        {txt(c, "footer_frase_cierre") && <p className="mb-2 text-sm text-ink/60">{txt(c, "footer_frase_cierre")}</p>}
        Reservas con ReserveOS
      </footer>
    </main>
  );
}
