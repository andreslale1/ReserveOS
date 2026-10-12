type Resumen = { ingresos: number; gastos_fijos: number; gastos_variables: number; gastos_totales: number; margen_contribucion: number; margen_operativo: number; margen_operativo_pct: number | null; ocupacion_pct: number | null; punto_equilibrio_q: number | null; punto_equilibrio_clases: number | null; ocupacion_breakeven_pct: number | null } | null;
type Iva = { tasa: number; ingresos: number; gastos_operativos: number; debito_fiscal_estimado: number; credito_fiscal_estimado: number; iva_por_pagar_estimado: number } | null;
type Balance = { total_activos: number; total_pasivos: number; utilidad_acumulada: number; patrimonio_estimado: number } | null;
type Cuentas = { total: number; bucket_0_30: number; bucket_31_60: number; bucket_61_90: number; bucket_90_mas: number } | null;
type Gasto = { categoria: string; monto: number; tipo: string; etapa: string };

const q = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `Q${Number(n).toLocaleString("es-GT", { maximumFractionDigits: 2 })}`);

function Card({ t, v, s }: { t: string; v: string; s?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-card p-5">
      <p className="text-xs uppercase tracking-wide text-ink-soft">{t}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{v}</p>
      {s && <p className="mt-1 text-xs text-ink-soft">{s}</p>}
    </div>
  );
}
function Antiguedad({ titulo, c }: { titulo: string; c: Cuentas }) {
  if (!c) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-card p-5">
      <h3 className="text-base font-semibold text-ink">{titulo}: {q(c.total)}</h3>
      <table className="mt-3 w-full text-sm">
        <caption className="sr-only">Antigüedad de {titulo.toLowerCase()}</caption>
        <thead className="text-left text-xs uppercase text-ink-soft"><tr><th className="py-1">Antigüedad</th><th className="py-1 text-right">Monto</th></tr></thead>
        <tbody className="divide-y divide-white/10">
          {([["0 a 30 días", c.bucket_0_30], ["31 a 60 días", c.bucket_31_60], ["61 a 90 días", c.bucket_61_90], ["Más de 90 días", c.bucket_90_mas]] as const).map(([l, v]) => (
            <tr key={l}><td className="py-1.5 text-ink">{l}</td><td className="py-1.5 text-right">{q(v)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Resumen contable del mes con la misma regla de ingreso confirmado que el resto de Finanzas.
export default function Contabilidad({ resumen, iva, balance, cxc, cxp, gastos }: { resumen: Resumen; iva: Iva; balance: Balance; cxc: Cuentas; cxp: Cuentas; gastos: Gasto[] }) {
  const pre = gastos.filter((g) => g.etapa === "preinversion");
  const preTotal = pre.reduce((a, g) => a + g.monto, 0);
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 pb-12 md:px-10">
      {resumen && (
        <section aria-label="Resumen financiero">
          <h2 className="text-sm font-medium uppercase tracking-wide text-ink-soft">Resumen financiero (del 1.º a hoy)</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-4">
            <Card t="Ingreso confirmado" v={q(resumen.ingresos)} />
            <Card t="Gastos fijos / variables" v={`${q(resumen.gastos_fijos)} / ${q(resumen.gastos_variables)}`} />
            <Card t="Margen operativo" v={q(resumen.margen_operativo)} s={resumen.margen_operativo_pct === null ? undefined : `${(resumen.margen_operativo_pct * 100).toFixed(1)}% del ingreso`} />
            <Card t="Ocupación" v={resumen.ocupacion_pct === null ? "—" : `${resumen.ocupacion_pct}%`} s={resumen.ocupacion_breakeven_pct ? `Equilibrio: ${resumen.ocupacion_breakeven_pct}%` : undefined} />
            <Card t="Punto de equilibrio" v={q(resumen.punto_equilibrio_q)} s={resumen.punto_equilibrio_clases ? `${Math.ceil(Number(resumen.punto_equilibrio_clases))} clases al mes` : undefined} />
          </div>
        </section>
      )}
      {iva && (
        <section aria-label="IVA estimado">
          <h2 className="text-sm font-medium uppercase tracking-wide text-ink-soft">IVA estimado del mes ({Math.round(Number(iva.tasa) * 100)}%)</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <Card t="Débito fiscal" v={q(iva.debito_fiscal_estimado)} s="Sobre el ingreso confirmado" />
            <Card t="Crédito fiscal" v={q(iva.credito_fiscal_estimado)} s="Sobre gastos operativos" />
            <Card t="IVA por pagar" v={q(iva.iva_por_pagar_estimado)} />
          </div>
          <p className="mt-2 text-xs text-ink-soft">Estimado para planear: no sustituye la declaración ni las facturas electrónicas.</p>
        </section>
      )}
      {balance && (
        <section aria-label="Balance general">
          <h2 className="text-sm font-medium uppercase tracking-wide text-ink-soft">Balance general</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-4">
            <Card t="Activos" v={q(balance.total_activos)} />
            <Card t="Pasivos" v={q(balance.total_pasivos)} />
            <Card t="Utilidad acumulada" v={q(balance.utilidad_acumulada)} />
            <Card t="Patrimonio estimado" v={q(balance.patrimonio_estimado)} />
          </div>
        </section>
      )}
      {(cxc || cxp) && (
        <section aria-label="Cuentas por cobrar y por pagar">
          <h2 className="text-sm font-medium uppercase tracking-wide text-ink-soft">Cuentas por cobrar y por pagar</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2"><Antiguedad titulo="Por cobrar" c={cxc} /><Antiguedad titulo="Por pagar" c={cxp} /></div>
        </section>
      )}
      {pre.length > 0 && (
        <section aria-label="Gastos de preinversión">
          <h2 className="text-sm font-medium uppercase tracking-wide text-ink-soft">Gastos de preinversión de este mes: {q(preTotal)}</h2>
          <p className="mt-1 text-xs text-ink-soft">Se muestran aparte: no entran en el IVA, el margen operativo ni la utilidad.</p>
        </section>
      )}
    </div>
  );
}
