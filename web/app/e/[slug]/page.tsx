import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const ORDEN = [1, 2, 3, 4, 5, 6, 0];

type Publico = {
  nombre: string;
  slug: string;
  color: string | null;
  logo: string | null;
  sedes: { id: string; nombre: string; direccion: string | null }[];
  clases: { sede_id: string; dia: number; inicio: string; fin: string; nombre: string; cupo: number; instructora: string }[];
};

export default async function EstudioPublico({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("horarios_publicos", { p_slug: slug });
  const e = data as Publico | null;
  if (!e) notFound();

  const color = /^#[0-9a-fA-F]{6}$/.test(e.color ?? "") ? (e.color as string) : "#E8B89B";

  return (
    <main className="min-h-screen bg-cream px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {e.logo && /^https?:\/\//.test(e.logo) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.logo} alt={e.nombre} className="h-10 w-auto" />
            )}
            <h1 className="font-serif text-3xl text-ink">{e.nombre}</h1>
          </div>
          <Link
            href={`/login?next=/reservar`}
            target="_top"
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-ink"
            style={{ backgroundColor: color }}
          >
            Reservar mi clase
          </Link>
        </header>

        {e.sedes.map((s) => {
          const clases = e.clases.filter((c) => c.sede_id === s.id);
          return (
            <section key={s.id} className="mt-8 rounded-2xl border border-white/10 bg-card p-5">
              <h2 className="text-lg font-semibold text-ink">{s.nombre}</h2>
              {s.direccion && <p className="text-sm text-ink/60">{s.direccion}</p>}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {ORDEN.map((d) => {
                  const del = clases.filter((c) => c.dia === d);
                  if (del.length === 0) return null;
                  return (
                    <div key={d}>
                      <p className="text-xs font-medium uppercase tracking-wide text-ink/45">{DIAS[d]}</p>
                      <ul className="mt-1 space-y-1">
                        {del.map((c, i) => (
                          <li key={i} className="text-sm text-ink">
                            {c.inicio.slice(0, 5)} · {c.nombre}
                            {c.instructora ? <span className="text-ink/55"> · {c.instructora}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
                {clases.length === 0 && <p className="text-sm text-ink/50">Próximamente.</p>}
              </div>
            </section>
          );
        })}
        <p className="mt-8 text-center text-xs text-ink/40">Reservas con ReserveOS</p>
      </div>
    </main>
  );
}
