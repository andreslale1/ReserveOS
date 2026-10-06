import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";
import SalasView from "./salas-view";

export default async function SalasPage() {
  const { supabase, membership, sedes } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/salas")) redirect("/panel/hoy");
  const ids = sedes.map((s) => s.id);
  const { data } = ids.length ? await supabase.from("salas").select("id, sede_id, nombre, capacidad, equipamiento, activa").in("sede_id", ids).order("nombre") : { data: [] };
  return <SalasView sedes={sedes.map((s) => ({ id: s.id, name: s.name }))} salas={(data ?? []) as { id: string; sede_id: string; nombre: string; capacidad: number; equipamiento: string | null; activa: boolean }[]} />;
}
