import { redirect } from "next/navigation";
import { getPanelContext, puedeVer, rutaHabilitada } from "@/lib/panel-context";
import CheckinView from "./checkin-view";

export default async function CheckinPage() {
  const { membership, modulos } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/checkin") || !rutaHabilitada(modulos, "/panel/checkin")) redirect("/panel/hoy");
  return <CheckinView tenantId={membership.tenant_id} />;
}
