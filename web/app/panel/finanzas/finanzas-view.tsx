type Gasto = {
  categoria: string;
  descripcion: string | null;
  monto: number;
  fecha: string;
  tipo: string;
};

function fmt(n: number) {
  return `Q${n.toLocaleString("es-GT", { maximumFractionDigits: 0 })}`;
}

export default function FinanzasView({
  ingresos,
  gastos,
  neto,
  meta,
  listaGastos,
}: {
  ingresos: number;
  gastos: number;
  neto: number;
  meta: number | null;
  listaGastos: Gasto[];
}) {
  const mesLabel = new Date().toLocaleDateString("es-GT", {
    month: "long",
    year: "numeric",
  });
  const pctMeta = meta ? Math.min(100, Math.round((ingresos / meta) * 100)) : null;

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <h1 className="text-2xl font-semibold text-ink md:text-3xl">
          Finanzas
        </h1>
        <p className="mt-1 text-sm capitalize text-ink-soft">{mesLabel}</p>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 md:px-10">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-ink-soft">
              Ingresos del mes
            </p>
            <p className="mt-2 text-3xl font-bold text-ink">{fmt(ingresos)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-ink-soft">
              Gastos del mes
            </p>
            <p className="mt-2 text-3xl font-bold text-ink">{fmt(gastos)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-ink-soft">
              Neto
            </p>
            <p
              className={`mt-2 text-3xl font-bold ${neto >= 0 ? "text-sage" : "text-red-500"}`}
            >
              {fmt(neto)}
            </p>
          </div>
        </div>

        {meta !== null && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-card p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-ink">Meta del mes</span>
              <span className="text-ink-soft">
                {fmt(ingresos)} / {fmt(meta)} ({pctMeta}%)
              </span>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-tint">
              <div
                className="h-full rounded-full bg-peach transition-[width] duration-1000"
                style={{ width: `${pctMeta}%` }}
              />
            </div>
          </div>
        )}

        <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-ink-soft">
          Gastos registrados
        </h2>
        {listaGastos.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-ink/15 bg-card p-8 text-center text-sm text-ink-soft">
            No hay gastos registrados este mes.
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {listaGastos.map((g, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-card p-4"
              >
                <div>
                  <p className="text-sm font-medium text-ink">
                    {g.descripcion ?? g.categoria}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {g.categoria} · {g.tipo} · {g.fecha}
                  </p>
                </div>
                <span className="text-sm font-semibold text-ink">
                  {fmt(g.monto)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
