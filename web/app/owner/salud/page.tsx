import { getOwnerContext } from "@/lib/owner-context";

type Salud = {
  ultima_migracion: string; medido_at: string;
  cron: { jobname: string; schedule: string; ultimo_estado: string | null; ultima_ejecucion: string | null; fallos_24h: number }[];
  estudios: { tenant_id: string; estudio: string; status: string; errores_24h: number; ultimo_error: string | null; reservas_24h: number; pagos_sin_revisar: number; tickets_abiertos: number; ultima_reserva: string | null; orden: number }[];
};
const SEM = ["bg-white/20", "bg-lime", "bg-yellow-300", "bg-red-400"];
const SEM_L = ["Inactivo", "Sano", "Atención", "Crítico"];
const fecha = (s: string | null) => (s ? new Date(s).toLocaleString("es-GT", { timeZone: "America/Guatemala", dateStyle: "short", timeStyle: "short" }) : "—");

export default async function SaludPage() {
  const { supabase } = await getOwnerContext();
  const { data, error } = await supabase.rpc("plataforma_salud");
  if (error) return <main className="mx-auto max-w-3xl px-6 py-16 text-center text-white/60">{error.message}</main>;
  const s = data as Salud;
  return (
    <main className="mx-auto max-w-5xl px-6 py-8 md:px-10">
      <h1 className="text-2xl font-semibold">Salud técnica</h1>
      <p className="mt-1 text-sm text-white/50">Medido {fecha(s.medido_at)} · última migración {s.ultima_migracion}. Solo metadatos: no hay datos de clientas ni montos.</p>

      <section className="mt-6 rounded-2xl border border-white/10 bg-void-card p-5">
        <h2 className="text-base font-semibold">Tareas automáticas</h2>
        <ul className="mt-3 divide-y divide-white/10">
          {s.cron.map((c) => (
            <li key={c.jobname} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span>{c.jobname} <span className="text-xs text-white/40">({c.schedule})</span></span>
              <span className={c.ultimo_estado === "succeeded" && c.fallos_24h === 0 ? "text-lime" : "text-red-300"}>{c.ultimo_estado ?? "sin ejecutar"} · {fecha(c.ultima_ejecucion)}{c.fallos_24h > 0 ? ` · ${c.fallos_24h} fallos/24h` : ""}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-void-card p-5">
        <h2 className="text-base font-semibold">Por estudio</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-white/45"><tr><th className="py-2">Estado</th><th>Estudio</th><th className="text-right">Errores 24h</th><th className="text-right">Reservas 24h</th><th className="text-right">Pagos sin revisar</th><th className="text-right">Tickets</th><th className="text-right">Última reserva</th></tr></thead>
            <tbody className="divide-y divide-white/10">
              {s.estudios.map((e) => (
                <tr key={e.tenant_id}>
                  <td className="py-2"><span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${SEM[e.orden]}`} /><span className="text-xs text-white/60">{SEM_L[e.orden]}</span></span></td>
                  <td>{e.estudio}</td><td className={`text-right ${e.errores_24h > 0 ? "text-red-300" : ""}`}>{e.errores_24h}</td>
                  <td className="text-right">{e.reservas_24h}</td><td className={`text-right ${e.pagos_sin_revisar > 0 ? "text-yellow-300" : ""}`}>{e.pagos_sin_revisar}</td>
                  <td className="text-right">{e.tickets_abiertos}</td><td className="text-right text-xs text-white/50">{fecha(e.ultima_reserva)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-white/40">Crítico: 10 o más errores sin resolver en 24h. Atención: algún error o pagos por transferencia sin revisar hace más de 3 días.</p>
      </section>
    </main>
  );
}
