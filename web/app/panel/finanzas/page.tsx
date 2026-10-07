import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";
import FinanzasView from "./finanzas-view";

export default async function FinanzasPage() {
  const { supabase, membership } = await getPanelContext();

  if (!membership) {
    return null;
  }
  if (!puedeVer(membership.role, "/panel/finanzas")) {
    redirect("/panel/hoy");
  }

  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  const [{ data: gastos }, { data: meta }] =
    await Promise.all([
      supabase
        .from("gastos")
        .select("categoria, descripcion, monto, fecha, tipo")
        .eq("tenant_id", membership.tenant_id)
        .gte("fecha", inicioMes)
        .lte("fecha", finMes)
        .order("fecha", { ascending: false }),
      supabase
        .from("metas_mensuales")
        .select("meta")
        .eq("tenant_id", membership.tenant_id)
        .eq("mes", inicioMes)
        .eq("tipo", "ingreso")
        .maybeSingle(),
    ]);

  const { data: atribucion } = await supabase.rpc("finanzas_atribucion", { p_tenant_id: membership.tenant_id, p_desde: inicioMes, p_hasta: finMes });

  // Ingresos NETOS: cobros confirmados en el mes menos devoluciones, atribuidos por sede (misma cifra que la tabla de abajo).
  const atr = atribucion as { sedes: { neto: number }[]; consolidado: number | null } | null;
  const ingresos = atr ? Number(atr.consolidado ?? atr.sedes.reduce((a, x) => a + Number(x.neto), 0)) : 0;
  const totalGastos = (gastos ?? []).reduce(
    (acc, g) => acc + Number(g.monto ?? 0),
    0,
  );

  return (
    <FinanzasView
      atribucion={atribucion as never}
      ingresos={ingresos}
      gastos={totalGastos}
      neto={ingresos - totalGastos}
      meta={meta?.meta ?? null}
      listaGastos={(gastos ?? []).map((g) => ({
        categoria: g.categoria,
        descripcion: g.descripcion,
        monto: Number(g.monto),
        fecha: g.fecha,
        tipo: g.tipo,
      }))}
    />
  );
}
