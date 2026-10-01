type Activa = { nombre: string; frecuencia: string; descripcion: string };
type Pendiente = { nombre: string; requiere: string };

export default function AutomatizacionesView({
  activas,
  pendientes,
}: {
  activas: Activa[];
  pendientes: Pendiente[];
}) {
  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-black/[0.06] bg-card px-6 py-6 md:px-10">
        <h1 className="text-2xl font-semibold text-ink md:text-3xl">
          Automatizaciones
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Lo que el sistema ya hace solo, y lo que falta conectar.
        </p>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 md:px-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-ink-soft">
          Activas
        </h2>
        <ul className="mt-4 space-y-3">
          {activas.map((a) => (
            <li
              key={a.nombre}
              className="flex items-start justify-between gap-4 rounded-2xl border border-black/[0.06] bg-card p-5"
            >
              <div>
                <p className="text-sm font-medium text-ink">{a.nombre}</p>
                <p className="mt-1 text-xs text-ink-soft">{a.descripcion}</p>
              </div>
              <span className="shrink-0 rounded-full bg-sage-tint px-3 py-1 text-xs font-medium text-sage">
                {a.frecuencia}
              </span>
            </li>
          ))}
        </ul>

        <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-ink-soft">
          Listas, pendientes de canal
        </h2>
        <p className="mt-1 text-xs text-ink-soft">
          La lógica ya existe en el backend — falta conectar WhatsApp, email
          o push para que realmente se envíen.
        </p>
        <ul className="mt-4 space-y-2">
          {pendientes.map((p) => (
            <li
              key={p.nombre}
              className="flex items-center justify-between gap-4 rounded-2xl border border-dashed border-black/[0.1] bg-card/60 p-4"
            >
              <span className="text-sm text-ink">{p.nombre}</span>
              <span className="shrink-0 rounded-full bg-neutral-tint px-3 py-1 text-xs font-medium text-ink-soft">
                requiere {p.requiere}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
