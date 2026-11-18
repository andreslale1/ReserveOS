import { notFound } from "next/navigation";
import SitioEstudio, { type DatosSitio } from "@/components/sitio/sitio-estudio";
import type { LylDay } from "@/components/sitio/landing-estudio";
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

const DIAS_LARGOS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export default async function EstudioPublico({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = await cargar(slug);
  if (!e) notFound();
  const c = e.contenido;

  // Los próximos 7 días en hora de Guatemala; cada día muestra las clases de ese día de la semana, de todas las sedes.
  const hoy = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Guatemala" }));
  const nomSede = new Map(e.sedes.map((s) => [s.id, s.nombre]));
  const multi = e.sedes.length > 1;
  const days: LylDay[] = Array.from({ length: 7 }, (_, i) => {
    const f = new Date(hoy); f.setDate(hoy.getDate() + i);
    const dow = f.getDay();
    return {
      label: `${DIAS_CORTOS[dow]} ${f.getDate()}`, full: `${DIAS_LARGOS[dow]} ${f.getDate()} de ${MESES[f.getMonth()]}`,
      sessions: e.clases.filter((k) => k.dia === dow).sort((a, b) => a.inicio.localeCompare(b.inicio)).map((k) => {
        const [h1, m1] = k.inicio.split(":").map(Number), [h2, m2] = k.fin.split(":").map(Number);
        return { id: `${k.id}-${i}`, time: k.inicio.slice(0, 5), name: k.nombre, note: [k.instructora, multi ? nomSede.get(k.sede_id) : ""].filter(Boolean).join(" · "), minutes: Math.max(0, (h2 * 60 + m2) - (h1 * 60 + m1)), capacity: k.cupo, booked: 0, price: 0 };
      }),
    };
  });
  const datos: DatosSitio = {
    slug: e.slug, nombre: e.nombre, color: e.color,
    tagline: txt(c, "hero_tagline") || (multi ? e.sedes.map((s) => s.nombre).join(" · ") : "Reservas en línea"),
    titulo: txt(c, "hero_titulo_linea1") || e.nombre,
    lede: txt(c, "hero_lede") || "Reserva tus clases, compra tu paquete y sigue tu cuenta desde cualquier dispositivo.",
    cierre: txt(c, "footer_frase_cierre"),
    clasesSemana: e.clases.length,
    days,
    sedes: e.sedes.map((s) => ({ nombre: s.nombre, direccion: s.direccion, clases: e.clases.filter((k) => k.sede_id === s.id).length })),
    paquetes: e.paquetes, testimonios: e.testimonios, contacto: e.contacto,
  };
  return <SitioEstudio d={datos} />;
}
