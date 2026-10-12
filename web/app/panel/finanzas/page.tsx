import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";
import FinanzasView from "./finanzas-view";
import Contabilidad from "./contabilidad";
import { primerDiaMesGT, ultimoDiaMes, mesGT, hoyGT } from "@/lib/fechas";

export default async function FinanzasPage() {
  const { supabase, membership } = await getPanelContext();

  if (!membership) {
    return null;
  }
  if (!puedeVer(membership.role, "/panel/finanzas")) {
    redirect("/panel/hoy");
  }

  const inicioMes = primerDiaMesGT();
  const finMes = ultimoDiaMes(mesGT());

  const [{ data: gastos }, { data: meta }] =
    await Promise.all([
      supabase
        .from("gastos")
        .select("categoria, descripcion, monto, fecha, tipo, etapa")
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

  const t = membership.tenant_id;
  const verContable = ["duena", "gerente_general", "contadora"].includes(membership.role);
  const [{ data: atribucion }, resumen, iva, balance, cxc, cxp] = await Promise.all([
    supabase.rpc("finanzas_atribucion", { p_tenant_id: t, p_desde: inicioMes, p_hasta: finMes }),
    verContable ? supabase.rpc("kpi_finanzas_resumen", { p_tenant_id: t, p_desde: inicioMes, p_hasta: hoyGT() }) : Promise.resolve({ data: null }),
    verContable ? supabase.rpc("kpi_iva_resumen", { p_tenant_id: t, p_desde: inicioMes, p_hasta: finMes }) : Promise.resolve({ data: null }),
    verContable ? supabase.rpc("kpi_balance_general", { p_tenant_id: t }) : Promise.resolve({ data: null }),
    verContable ? supabase.rpc("kpi_cuentas_por_cobrar", { p_tenant_id: t }) : Promise.resolve({ data: null }),
    verContable ? supabase.rpc("kpi_cuentas_por_pagar", { p_tenant_id: t }) : Promise.resolve({ data: null }),
  ]);

  // Ingresos NETOS: cobros confirmados en el mes menos devoluciones, atribuidos por sede (misma cifra que la tabla de abajo).
  const atr = atribucion as { sedes: { neto: number }[]; consolidado: number | null } | null;
  const ingresos = atr ? Number(atr.consolidado ?? atr.sedes.reduce((a, x) => a + Number(x.neto), 0)) : 0;
  // Gastos operativos del mes: los de preinversión se muestran aparte y no entran en IVA, margen ni utilidad.
  const totalGastos = (gastos ?? []).filter((g) => g.etapa !== "preinversion").reduce(
    (acc, g) => acc + Number(g.monto ?? 0),
    0,
  );

  return (
    <>
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
      {verContable && <Contabilidad resumen={resumen.data as never} iva={iva.data as never} balance={balance.data as never} cxc={cxc.data as never} cxp={cxp.data as never} gastos={(gastos ?? []).map((g) => ({ categoria: g.categoria, monto: Number(g.monto), tipo: g.tipo, etapa: g.etapa ?? "operativo" }))} />}
    </>
);
}
