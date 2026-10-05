import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";
import RegistroView from "./registro-view";

export default async function RegistroPage() {
  const { supabase, membership, sedes } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/finanzas/registro")) redirect("/panel/hoy");

  const t = membership.tenant_id;
  const mes = new Date().toISOString().slice(0, 7) + "-01";
  const [{ data: gastos }, { data: activos }, { data: pasivos }, { data: meta }] = await Promise.all([
    supabase.from("gastos").select("id, fecha, categoria, descripcion, monto, tipo").eq("tenant_id", t).order("fecha", { ascending: false }).limit(40),
    supabase.from("activos").select("id, descripcion, fecha, monto").eq("tenant_id", t).order("fecha", { ascending: false }),
    supabase.from("pasivos").select("id, descripcion, fecha, monto").eq("tenant_id", t).order("fecha", { ascending: false }),
    supabase.from("metas_mensuales").select("meta").eq("tenant_id", t).eq("mes", mes).eq("tipo", "ingreso").maybeSingle(),
  ]);

  const rol = membership.role;
  return (
    <RegistroView
      tenantId={t}
      mes={mes}
      sedes={sedes.map((s) => ({ id: s.id, name: s.name }))}
      gastos={(gastos ?? []).map((g) => ({ ...g, monto: Number(g.monto) }))}
      activos={(activos ?? []).map((g) => ({ ...g, monto: Number(g.monto) }))}
      pasivos={(pasivos ?? []).map((g) => ({ ...g, monto: Number(g.monto) }))}
      meta={meta ? Number(meta.meta) : null}
      puedeBalance={["duena", "gerente_general", "contadora"].includes(rol)}
      puedeMeta={["duena", "gerente_general"].includes(rol)}
    />
  );
}
