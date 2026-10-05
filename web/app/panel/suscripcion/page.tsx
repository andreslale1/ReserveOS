import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";

type Cobro = { periodo: string; monto: number; estado: string; fecha_vencimiento: string; fecha_pago: string | null };

export default async function SuscripcionPage() {
  const { supabase, membership } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/suscripcion")) redirect("/panel/hoy");

  const { data } = await supabase.rpc("mi_suscripcion", { p_tenant_id: membership.tenant_id });
  const s = (data as { suscripcion: { plan: string; precio_mensual: number; dia_cobro: number; estado: string; fecha_alta: string } | null; cobros: Cobro[] } | null) ?? null;
  const { data: mods } = await supabase.rpc("modulos_tenant", { p_tenant_id: membership.tenant_id });
  const incluidos = ((mods ?? []) as { nombre: string; activo: boolean }[]).filter((m) => m.activo);
  const hoy = new Date().toISOString().slice(0, 10);
  const q = (n: number) => `Q${Number(n).toLocaleString("es-GT")}`;

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <h1 className="font-serif text-2xl text-ink md:text-3xl">Mi suscripción a ReserveOS</h1>
        <p className="mt-1 text-sm text-ink/60">Tu plan y tus pagos</p>
      </header>
      <div className="mx-auto grid max-w-3xl gap-6 px-6 py-8 md:px-10">
        <section className="rounded-2xl border border-white/10 bg-card p-5">
          {s?.suscripcion ? (
            <p className="text-sm text-ink">
              Plan <strong>{s.suscripcion.plan}</strong> · {q(s.suscripcion.precio_mensual)} al mes · se cobra el día {s.suscripcion.dia_cobro} · {s.suscripcion.estado}
            </p>
          ) : (
            <p className="text-sm text-ink/60">Todavía no tienes una suscripción registrada. Contacta a ReserveOS.</p>
          )}
        </section>
        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-base font-semibold text-ink">Qué incluye tu plan</h2>
          <ul className="mt-3 grid gap-1 sm:grid-cols-2">
            {incluidos.map((m) => (
              <li key={m.nombre} className="text-sm text-ink">✓ {m.nombre}</li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-base font-semibold text-ink">Pagos</h2>
          <ul className="mt-3 divide-y divide-white/10">
            {(s?.cobros ?? []).length === 0 && <li className="py-3 text-sm text-ink/50">Sin cobros todavía.</li>}
            {(s?.cobros ?? []).map((c) => (
              <li key={c.periodo} className="flex flex-wrap items-center justify-between py-2.5 text-sm">
                <span className="text-ink">{c.periodo.slice(0, 7)} · {q(c.monto)}</span>
                <span className={c.estado === "pagado" ? "text-sage" : c.fecha_vencimiento < hoy ? "text-ink font-medium" : "text-ink/60"}>
                  {c.estado === "pagado" ? `Pagado ${c.fecha_pago}` : c.fecha_vencimiento < hoy ? `Vencido (${c.fecha_vencimiento})` : `Vence ${c.fecha_vencimiento}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
