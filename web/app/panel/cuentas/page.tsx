import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";

type Cuenta = { membership_id: string; nombre: string | null; email: string; rol: string; ultimo_acceso: string | null; creada: string; sedes: string[] };
const ROL: Record<string, string> = { duena: "Dueña", gerente_general: "Gerente general", gerente_regional: "Gerente regional", admin_sede: "Administradora de sede", recepcion: "Recepción", instructora: "Instructora", contadora: "Contadora", marketing: "Marketing" };
const dias = (f: string | null) => (f ? Math.floor((Date.now() - new Date(f).getTime()) / 86_400_000) : null);

export default async function CuentasPage() {
  const { supabase, membership } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/cuentas")) redirect("/panel/hoy");
  const { data, error } = await supabase.rpc("revision_cuentas", { p_tenant_id: membership.tenant_id });
  if (error) return <main className="px-6 py-10 text-ink/70" role="alert">{error.message}</main>;
  const cuentas = (data ?? []) as Cuenta[];
  const inactivas = cuentas.filter((c) => { const d = dias(c.ultimo_acceso); return d === null || d > 60; });

  return (
    <main className="mx-auto max-w-4xl px-6 py-8 md:px-10">
      <h1 className="font-serif text-2xl text-ink">Cuentas del equipo</h1>
      <p className="mt-1 text-sm text-ink/60">Quién tiene acceso y cuándo entró por última vez. {inactivas.length > 0 ? `${inactivas.length} cuenta(s) sin entrar en más de 60 días: revisa si deben seguir con acceso.` : "Todas las cuentas están activas."}</p>
      <ul className="mt-6 divide-y divide-white/10 rounded-2xl border border-white/10 bg-card">
        {cuentas.map((c) => {
          const d = dias(c.ultimo_acceso);
          const alerta = d === null || d > 60;
          return (
            <li key={c.membership_id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
              <div>
                <p className="font-medium text-ink">{c.nombre ?? c.email}</p>
                <p className="text-xs text-ink/55">{ROL[c.rol] ?? c.rol} · {c.email}{c.sedes.length ? ` · ${c.sedes.join(", ")}` : c.rol === "duena" || c.rol === "gerente_general" ? " · todas las sedes" : ""}</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs ${alerta ? "bg-peach-tint text-ink" : "text-ink/60"}`}>
                {d === null ? "Nunca ha entrado" : d === 0 ? "Entró hoy" : `Entró hace ${d} día(s)`}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs text-ink/45">Para quitar o cambiar un acceso, ve a Personal.</p>
    </main>
  );
}
