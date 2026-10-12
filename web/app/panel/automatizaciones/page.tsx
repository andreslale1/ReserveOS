import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";
import AutomatizacionesView, { type Panel } from "./automatizaciones-view";

export default async function AutomatizacionesPage() {
  const { supabase, membership } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/automatizaciones")) {
    redirect("/panel/hoy");
  }

  const { data, error } = await supabase.rpc("automatizaciones_panel", { p_tenant_id: membership.tenant_id });
  if (error || !data) {
    return (
      <main className="min-h-screen bg-cream px-6 py-16 text-center text-sm text-ink-soft">
        Las automatizaciones las administra la dueña del estudio.
      </main>
    );
  }
  return <AutomatizacionesView tenantId={membership.tenant_id} panel={data as Panel} />;
}
