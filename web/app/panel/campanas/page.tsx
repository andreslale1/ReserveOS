import { redirect } from "next/navigation";
import { getPanelContext, puedeVer, rutaHabilitada } from "@/lib/panel-context";
import CampanasView, { type Campana, type Segmento, type Plantilla, type Resumen } from "./campanas-view";

export default async function CampanasPage() {
  const { supabase, membership, modulos } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/campanas") || !rutaHabilitada(modulos, "/panel/campanas")) redirect("/panel/hoy");
  const t = membership.tenant_id;
  const [c, s, p, r] = await Promise.all([
    supabase.rpc("campanas_listar", { p_tenant_id: t }),
    supabase.rpc("segmentos_listar", { p_tenant_id: t }),
    supabase.rpc("plantillas_listar", { p_tenant_id: t }),
    supabase.rpc("cola_resumen", { p_tenant_id: t }),
  ]);
  if (c.error) return <main className="p-10 text-sm text-ink">{c.error.message}</main>;
  return <CampanasView tenantId={t} campanas={(c.data ?? []) as Campana[]} segmentos={(s.data ?? []) as Segmento[]} plantillas={(p.data ?? []) as Plantilla[]} resumen={r.data as Resumen} />;
}
