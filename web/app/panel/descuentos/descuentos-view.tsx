type Codigo = {
  id: string;
  codigo: string;
  descuento_pct: number;
  aplica_a: string;
  activo: boolean;
  usos_maximos: number | null;
  usos_actuales: number;
  vigente_hasta: string | null;
  auto_aplicar_canal: string | null;
  created_at: string;
};

export default function DescuentosView({ codigos }: { codigos: Codigo[] }) {
  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <h1 className="text-2xl font-semibold text-ink md:text-3xl">
          Descuentos
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {codigos.length} código{codigos.length === 1 ? "" : "s"} creado
          {codigos.length === 1 ? "" : "s"}.
        </p>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 md:px-10">
        <div className="mb-6 rounded-2xl border border-dashed border-white/15 bg-card/60 p-4 text-xs text-ink-soft">
          Crear o editar códigos todavía no está disponible desde el panel —
          falta el permiso de escritura en la base de datos para esta tabla.
          Por ahora los códigos se crean por SQL directo.
        </div>

        {codigos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-card p-8 text-center text-sm text-ink-soft">
            No hay códigos de descuento creados.
          </div>
        ) : (
          <ul className="space-y-2">
            {codigos.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-card p-5"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-ink">
                      {c.codigo}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        c.activo
                          ? "bg-sage-tint text-sage"
                          : "bg-neutral-tint text-ink/50"
                      }`}
                    >
                      {c.activo ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-soft">
                    {c.descuento_pct}% · aplica a {c.aplica_a}
                    {c.auto_aplicar_canal
                      ? ` · auto para canal "${c.auto_aplicar_canal}"`
                      : ""}
                    {c.vigente_hasta ? ` · vence ${c.vigente_hasta}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-sm tabular-nums text-ink-soft">
                  {c.usos_actuales}
                  {c.usos_maximos ? ` / ${c.usos_maximos}` : ""} usos
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
