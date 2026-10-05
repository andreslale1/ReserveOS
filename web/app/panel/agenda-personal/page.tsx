import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default async function AgendaPersonalPage() {
  const { supabase, membership, sedes } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/agenda-personal")) redirect("/panel/hoy");

  const sedeIds = sedes.map((s) => s.id);
  const { data } = sedeIds.length
    ? await supabase
        .from("horarios")
        .select("id, nombre_clase, dia_semana, hora_inicio, hora_fin, sede_id, instructor_membership_id, tenant_memberships(nombre)")
        .in("sede_id", sedeIds)
        .eq("activo", true)
        .is("fecha_especifica", null)
        .order("hora_inicio")
    : { data: [] };

  const porPersona = new Map<string, { nombre: string; clases: NonNullable<typeof data>[number][] }>();
  for (const h of data ?? []) {
    const nombre =
      (h.tenant_memberships as unknown as { nombre: string } | null)?.nombre ?? "Sin asignar";
    const k = h.instructor_membership_id ?? "sin";
    if (!porPersona.has(k)) porPersona.set(k, { nombre, clases: [] });
    porPersona.get(k)!.clases.push(h);
  }
  const personas = [...porPersona.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <h1 className="font-serif text-2xl text-ink md:text-3xl">Agenda del personal</h1>
        <p className="mt-1 text-sm text-ink/60">Clases semanales por instructora</p>
      </header>
      <div className="mx-auto grid max-w-4xl gap-6 px-6 py-8 md:px-10">
        {personas.length === 0 && <p className="text-sm text-ink/50">No hay clases semanales activas.</p>}
        {personas.map((p) => (
          <section key={p.nombre} className="rounded-2xl border border-white/10 bg-card p-5">
            <h2 className="text-base font-semibold text-ink">
              {p.nombre} <span className="text-sm font-normal text-ink/50">· {p.clases.length} clases por semana</span>
            </h2>
            <ul className="mt-3 divide-y divide-white/10">
              {[...p.clases]
                .sort((a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio))
                .map((c) => (
                  <li key={c.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                    <span className="text-ink">
                      {DIAS[c.dia_semana]} {c.hora_inicio.slice(0, 5)}–{c.hora_fin.slice(0, 5)} · {c.nombre_clase}
                    </span>
                    <span className="text-ink/55">{sedes.find((s) => s.id === c.sede_id)?.name}</span>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
