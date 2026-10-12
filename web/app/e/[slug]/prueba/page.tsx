import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PruebaForm, { type Opcion } from "./prueba-form";

const TZ = "America/Guatemala";
const fmt = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);

export default async function PruebaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("horarios_publicos", { p_slug: slug });
  const e = data as { id: string; nombre: string; color: string | null; sedes: { id: string; nombre: string }[]; clases: { id: string; sede_id: string; dia: number; inicio: string; nombre: string; instructora: string }[] } | null;
  if (!e) notFound();

  // La clase de prueba necesita cuenta: quien aún no la tiene la crea y vuelve exactamente aquí.
  const { data: { user } } = await supabase.auth.getUser();
  const volver = `/registro/${slug}?next=${encodeURIComponent(`/e/${slug}/prueba`)}`;
  if (!user) redirect(volver);
  const { data: ctx } = await supabase.rpc("mis_contextos");
  const esClienta = ((ctx ?? []) as { tenant_id: string; es_clienta: boolean }[]).some((c) => c.tenant_id === e.id && c.es_clienta);
  if (!esClienta) redirect(volver);

  // Próximos 14 días (hora de Guatemala) con las clases de cada sede.
  const ahora = new Date();
  const hoy = fmt(ahora);
  const horaAhora = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(ahora);
  const opciones: Opcion[] = [];
  for (let i = 0; i < 14; i++) {
    const f = fmt(new Date(ahora.getTime() + i * 86_400_000));
    const dia = new Date(`${f}T12:00:00Z`).getUTCDay();
    for (const c of e.clases.filter((x) => x.dia === dia)) {
      if (f === hoy && c.inicio.slice(0, 5) <= horaAhora) continue;
      opciones.push({ horarioId: c.id, fecha: f, hora: c.inicio.slice(0, 5), clase: c.nombre, instructora: c.instructora, sede: e.sedes.find((s) => s.id === c.sede_id)?.nombre ?? "" });
    }
  }
  return <PruebaForm slug={slug} nombre={e.nombre} color={/^#[0-9a-fA-F]{6}$/.test(e.color ?? "") ? (e.color as string) : "#E8B89B"} opciones={opciones} />;
}
