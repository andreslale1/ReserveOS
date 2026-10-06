import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";
import ImportarView from "./importar-view";

export default async function ImportarPage() {
  const { membership } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/clientes")) redirect("/panel/hoy");
  return <ImportarView tenantId={membership.tenant_id} />;
}
