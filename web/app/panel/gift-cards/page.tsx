import { redirect } from "next/navigation";
import { getPanelContext, puedeVer, rutaHabilitada } from "@/lib/panel-context";
import GiftCardsView, { type Gift } from "./gift-cards-view";

export default async function GiftCardsPage() {
  const { supabase, membership, sedes, modulos } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/gift-cards") || !rutaHabilitada(modulos, "/panel/gift-cards")) redirect("/panel/hoy");
  const t = membership.tenant_id;
  const [{ data: lista }, { data: paquetes }] = await Promise.all([
    supabase.rpc("gift_cards_listar", { p_tenant_id: t }),
    supabase.from("paquetes").select("id, nombre, precio").eq("tenant_id", t).eq("activo", true).order("precio"),
  ]);
  return <GiftCardsView tenantId={t} sedes={sedes.map((s) => ({ id: s.id, name: s.name }))} paquetes={(paquetes ?? []).map((p) => ({ id: p.id, nombre: p.nombre, precio: Number(p.precio) }))} gifts={(lista ?? []) as Gift[]} puedeAnular={["duena", "gerente_general"].includes(membership.role)} />;
}
