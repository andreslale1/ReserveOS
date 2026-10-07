import Link from "next/link";
import { getOwnerContext } from "@/lib/owner-context";
import VerificarBoton from "./verificar-boton";

type Estado = "sano" | "degradado" | "caido" | "sin_evidencia";
type Salud = {
  ultima_migracion: string; medido_at: string; ultima_verificacion: string | null;
  cron: { jobname: string; schedule: string; ultimo_estado: string | null; ultima_ejecucion: string | null; fallos_24h: number; estado: Estado; umbral: string }[];
  checks: { clave: string; nombre: string; estado: Estado; detalle: string }[];
  estudios: { tenant_id: string; estudio: string; status: string; estado: Estado; motivo: string; errores_24h: number; ultimo_error: string | null; reservas_24h: number; pagos_sin_revisar: number; tickets_abiertos: number; ticket_id: string | null; incidente_id: string | null; ultima_reserva: string | null }[];
};
type Hist = { medido_at: string; por: string | null; resumen: Record<string, unknown> };

const PUNTO: Record<Estado, string> = { sano: "bg-lime", degradado: "bg-yellow-300", caido: "bg-red-400", sin_evidencia: "bg-white/30" };
const ETIQ: Record<Estado, string> = { sano: "Sano", degradado: "Degradado", caido: "Caído", sin_evidencia: "Sin evidencia" };
const fecha = (s: string | null) => (s ? new Date(s).toLocaleString("es-GT", { timeZone: "America/Guatemala", dateStyle: "short", timeStyle: "short" }) : "—");
const Chip = ({ e }: { e: Estado }) => (
  <span className="inline-flex items-center gap-2"><span aria-hidden className={`h-2.5 w-2.5 rounded-full ${PUNTO[e]}`} /><span className="text-xs text-white/75">{ETIQ[e]}</span></span>
);

export default async function SaludPage() {
  const { supabase } = await getOwnerContext();
  const [{ data, error }, { data: hist }] = await Promise.all([supabase.rpc("plataforma_salud"), supabase.rpc("salud_historial")]);
  if (error) return <main className="mx-auto max-w-3xl px-6 py-16 text-center text-white/60" role="alert">{error.message}</main>;
  const s = data as Salud;
  const peor = (l: Estado[]): Estado => (l.includes("caido") ? "caido" : l.includes("degradado") ? "degradado" : l.includes("sano") ? "sano" : "sin_evidencia");
  const general = peor([...s.cron.map((c) => c.estado), ...s.checks.map((c) => c.estado), ...s.estudios.filter((e) => e.status === "activo").map((e) => e.estado)]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 md:px-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Salud técnica</h1>
          <p className="mt-1 text-sm text-white/60">Solo metadatos: no hay datos de clientas ni montos. «Sin evidencia» significa que no hay señales recientes: no se cuenta como sano.</p>
        </div>
        <VerificarBoton />
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/70">
        Estado general: <Chip e={general} /> <span className="text-xs text-white/50">Medido {fecha(s.medido_at)} · última verificación guardada {fecha(s.ultima_verificacion)} · migración {s.ultima_migracion}</span>
      </p>
      <p className="mt-1 text-xs text-white/50">La prueba sintética de reserva en un estudio de prueba no está activa: todavía no hay un estudio marcado como de pruebas.</p>

      <section className="mt-6 rounded-2xl border border-white/10 bg-void-card p-5" aria-labelledby="chk">
        <h2 id="chk" className="text-base font-semibold">Servicios</h2>
        <ul className="mt-3 divide-y divide-white/10">
          {s.checks.map((c) => <li key={c.clave} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"><span>{c.nombre} <span className="text-xs text-white/50">· {c.detalle}</span></span><Chip e={c.estado} /></li>)}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-void-card p-5" aria-labelledby="cron">
        <h2 id="cron" className="text-base font-semibold">Tareas automáticas</h2>
        <ul className="mt-3 divide-y divide-white/10">
          {s.cron.map((c) => (
            <li key={c.jobname} className="py-2.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{c.jobname} <span className="text-xs text-white/50">({c.schedule})</span></span>
                <span className="flex items-center gap-3"><span className="text-xs text-white/60">{c.ultimo_estado ?? "sin ejecutar"} · {fecha(c.ultima_ejecucion)}{c.fallos_24h > 0 ? ` · ${c.fallos_24h} fallos/24h` : ""}</span><Chip e={c.estado} /></span>
              </div>
              <p className="text-xs text-white/45">{c.umbral}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-void-card p-5" aria-labelledby="est">
        <h2 id="est" className="text-base font-semibold">Por estudio</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-white/55"><tr><th scope="col" className="py-2">Estado</th><th scope="col">Estudio</th><th scope="col">Motivo</th><th scope="col" className="text-right">Errores 24h</th><th scope="col" className="text-right">Reservas 24h</th><th scope="col" className="text-right">Última reserva</th><th scope="col" className="text-right">Seguimiento</th></tr></thead>
            <tbody className="divide-y divide-white/10">
              {s.estudios.map((e) => (
                <tr key={e.tenant_id}>
                  <td className="py-2"><Chip e={e.estado} /></td>
                  <td>{e.estudio}</td><td className="max-w-[16rem] text-xs text-white/65">{e.motivo}</td>
                  <td className={`text-right ${e.errores_24h > 0 ? "text-red-300" : ""}`}>{e.errores_24h}</td>
                  <td className="text-right">{e.reservas_24h}</td><td className="text-right text-xs text-white/60">{fecha(e.ultima_reserva)}</td>
                  <td className="text-right text-xs">{e.ticket_id || e.incidente_id ? <Link className="underline" href={e.ticket_id ? `/owner/soporte/${e.ticket_id}` : "/owner/soporte"}>{e.ticket_id ? "Ver ticket" : "Ver incidente"}</Link> : <Link className="text-white/55 underline" href="/owner/soporte">Abrir en Soporte</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-white/50">Caído: 10 o más errores sin resolver en 24 h o incidente crítico. Degradado: algún error, pagos sin revisar más de 3 días, mensajes atrasados o incidente abierto. Sano: hubo reservas en 7 días y ninguna alerta. Si no hay reservas en 7 días: sin evidencia.</p>
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-void-card p-5" aria-labelledby="his">
        <h2 id="his" className="text-base font-semibold">Verificaciones guardadas</h2>
        <ul className="mt-3 space-y-1 text-xs text-white/65">
          {((hist ?? []) as Hist[]).length === 0 && <li>Aún no se ha guardado ninguna. Pulsa «Verificar ahora».</li>}
          {((hist ?? []) as Hist[]).map((h, i) => <li key={i}>{fecha(h.medido_at)} · {h.por ?? "—"} · estudios: {String(h.resumen.estudios_sanos ?? 0)} sanos, {String(h.resumen.estudios_degradados ?? 0)} degradados, {String(h.resumen.estudios_caidos ?? 0)} caídos, {String(h.resumen.estudios_sin_evidencia ?? 0)} sin evidencia</li>)}
        </ul>
      </section>
    </main>
  );
}
