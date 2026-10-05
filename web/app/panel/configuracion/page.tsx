import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";
import ConfiguracionView from "./configuracion-view";

export default async function ConfiguracionPage() {
  const { supabase, membership } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/configuracion")) redirect("/panel/hoy");

  const [{ data: t }, { data: dominios }] = await Promise.all([
    supabase.from("tenants").select("name, slug, branding").eq("id", membership.tenant_id).maybeSingle(),
    supabase.from("tenant_domains").select("domain, verified").eq("tenant_id", membership.tenant_id),
  ]);
  const b = (t?.branding ?? {}) as { color_primario?: string; logo_url?: string };

  return (
    <ConfiguracionView
      tenantId={membership.tenant_id}
      nombre={t?.name ?? ""}
      slug={t?.slug ?? ""}
      color={b.color_primario ?? ""}
      logo={b.logo_url ?? ""}
      dominios={dominios ?? []}
    />
  );
}
