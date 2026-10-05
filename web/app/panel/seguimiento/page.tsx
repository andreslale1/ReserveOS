import Link from "next/link";
import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";

type Fuga = {
  cliente_id: string;
  nombre: string;
  telefono: string;
  ultima_clase: string | null;
  dias_sin_reservar: number;
  tiene_membresia_activa: boolean;
};
type Pend = { id: string; nombre: string; telefono: string };

export default async function SeguimientoPage() {
  const { supabase, membership } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/seguimiento")) redirect("/panel/hoy");

  const tenantId = membership.tenant_id;
  const [{ data: fuga }, { data: pendientes }, { data: porVencer }] = await Promise.all([
    supabase.rpc("clientas_riesgo_fuga", { p_tenant_id: tenantId, p_dias: 14 }),
    supabase.rpc("clientas_consentimiento_pendiente", { p_tenant_id: tenantId }),
    supabase.rpc("membresias_por_vencer", { p_tenant_id: tenantId }),
  ]);

  const enRiesgo = (fuga ?? []) as Fuga[];
  const sinConsentimiento = (pendientes ?? []) as Pend[];
  const vencen = (porVencer ?? []) as Record<string, unknown>[];

  const Lista = ({ titulo, vacio, children }: { titulo: string; vacio: string; children: React.ReactNode[] }) => (
    <section className="rounded-2xl border border-white/10 bg-card p-5">
      <h2 className="text-base font-semibold text-ink">
        {titulo} <span className="text-sm font-normal text-ink/50">({children.length})</span>
      </h2>
      <ul className="mt-3 divide-y divide-white/10">
        {children.length === 0 && <li className="py-3 text-sm text-ink/50">{vacio}</li>}
        {children}
      </ul>
    </section>
  );

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <h1 className="font-serif text-2xl text-ink md:text-3xl">Seguimiento de clientas</h1>
        <p className="mt-1 text-sm text-ink/60">A quién contactar hoy</p>
      </header>
      <div className="mx-auto grid max-w-4xl gap-6 px-6 py-8 md:px-10">
        <Lista titulo="En riesgo de irse (14+ días sin reservar)" vacio="Nadie en riesgo por ahora.">
          {enRiesgo.map((c) => (
            <li key={c.cliente_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <Link href={`/panel/clientes/${c.cliente_id}`} className="font-medium text-ink hover:underline">
                {c.nombre}
              </Link>
              <span className="text-ink/60">
                {c.telefono} · {c.dias_sin_reservar} días sin reservar
                {c.tiene_membresia_activa ? " · con paquete activo" : ""}
              </span>
            </li>
          ))}
        </Lista>
        <Lista titulo="Paquetes por vencer" vacio="Ningún paquete por vencer pronto.">
          {vencen.map((m, i) => (
            <li key={i} className="py-2.5 text-sm text-ink">
              {String(m.nombre ?? m.cliente_nombre ?? "Clienta")}
              <span className="text-ink/60"> · vence {String(m.fecha_vencimiento ?? "")}</span>
            </li>
          ))}
        </Lista>
        <Lista titulo="Consentimiento pendiente" vacio="Todas firmaron.">
          {sinConsentimiento.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <Link href={`/panel/clientes/${c.id}`} className="font-medium text-ink hover:underline">
                {c.nombre}
              </Link>
              <span className="text-ink/60">{c.telefono}</span>
            </li>
          ))}
        </Lista>
      </div>
    </main>
  );
}
