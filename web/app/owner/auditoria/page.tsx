import { getOwnerContext } from "@/lib/owner-context";

type Fila = { created_at: string; actor: string | null; tabla: string; operacion: string; registro: string | null; estudio: string | null };

export default async function AuditoriaPlataformaPage() {
  const { supabase } = await getOwnerContext();
  const { data, error } = await supabase.rpc("plataforma_auditoria_listar", { p_limite: 300 });
  if (error) return <main className="mx-auto max-w-3xl px-6 py-16 text-center text-white/60">{error.message}</main>;
  return (
    <main className="mx-auto max-w-5xl px-6 py-8 md:px-10">
      <h1 className="text-2xl font-semibold">Auditoría de plataforma</h1>
      <p className="mt-1 text-sm text-white/50">Cambios de planes, cobros, pagos, costos, equipo, módulos y proyectos. Últimos 300.</p>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-void-card">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-white/45"><tr><th className="px-4 py-3">Fecha</th><th>Quién</th><th>Qué</th><th>Dónde</th><th>Estudio</th></tr></thead>
          <tbody className="divide-y divide-white/10">
            {((data ?? []) as Fila[]).map((f, i) => (
              <tr key={i}>
                <td className="whitespace-nowrap px-4 py-2.5 text-white/60">{new Date(f.created_at).toLocaleString("es-GT", { timeZone: "America/Guatemala", dateStyle: "short", timeStyle: "short" })}</td>
                <td>{f.actor ?? "—"}</td><td>{f.operacion}</td><td className="text-white/70">{f.tabla}</td><td className="text-white/60">{f.estudio ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
