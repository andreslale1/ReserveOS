import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";

export default async function AuditoriaPage() {
  const { supabase, membership } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/auditoria")) redirect("/panel/hoy");

  const { data } = await supabase
    .from("admin_acciones_log")
    .select("id, actor_nombre, tabla, operacion, registro_id, created_at")
    .eq("tenant_id", membership.tenant_id)
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <h1 className="font-serif text-2xl text-ink md:text-3xl">Auditoría</h1>
        <p className="mt-1 text-sm text-ink/60">Últimas 200 acciones administrativas</p>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-8 md:px-10">
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-card">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-ink/45">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Quién</th>
                <th className="px-4 py-3">Qué</th>
                <th className="px-4 py-3">Dónde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {(data ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-ink/50">Sin registros.</td>
                </tr>
              )}
              {(data ?? []).map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-ink/70">
                    {new Date(r.created_at).toLocaleString("es-GT", { timeZone: "America/Guatemala", dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-2.5 text-ink">{r.actor_nombre ?? "—"}</td>
                  <td className="px-4 py-2.5 text-ink">{r.operacion}</td>
                  <td className="px-4 py-2.5 text-ink/70">{r.tabla}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
