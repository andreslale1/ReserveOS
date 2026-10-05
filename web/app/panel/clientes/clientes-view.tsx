"use client";

import { useMemo, useState, useTransition } from "react";
import { crearCliente, obtenerDetalleCliente } from "./actions";

type Fila = {
  id: string;
  nombre: string;
  telefono: string;
  email: string | null;
  estadoMembresia: string;
  clasesRestantes: number | null;
  vencimiento: string | null;
  visitas: number;
  ultimaVisita: string | null;
  ltv: number;
};
type Sede = { id: string; name: string };

const FILTROS = ["Todas", "Activas", "Inactivas"] as const;

type Detalle = Awaited<ReturnType<typeof obtenerDetalleCliente>>;

const ESTADO_LABEL: Record<string, { label: string; className: string }> = {
  activa: { label: "Activa", className: "bg-sage-tint text-sage" },
  vencida: { label: "Vencida", className: "bg-neutral-tint text-ink/60" },
  pendiente_pago: {
    label: "Pago pendiente",
    className: "bg-peach-tint text-ink",
  },
  anulada: { label: "Anulada", className: "bg-neutral-tint text-ink/60" },
  sin_paquete: { label: "Sin paquete", className: "bg-neutral-tint text-ink/50" },
};

export default function ClientesView({
  clientes,
  tenantId,
  sedes,
  puedeCrear,
  puedeExportar,
}: {
  clientes: Fila[];
  tenantId: string;
  sedes: Sede[];
  puedeCrear: boolean;
  puedeExportar: boolean;
}) {
  const [abierto, setAbierto] = useState<Fila | null>(null);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [isPending, startTransition] = useTransition();
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>("Todas");

  const [mostrarAlta, setMostrarAlta] = useState(false);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [sedeHabitual, setSedeHabitual] = useState("");
  const [comoSeEntero, setComoSeEntero] = useState("");
  const [errorAlta, setErrorAlta] = useState<string | null>(null);

  function crear() {
    setErrorAlta(null);
    startTransition(async () => {
      const res = await crearCliente({
        tenantId,
        nombre,
        telefono,
        email,
        sedeHabitualId: sedeHabitual || null,
        comoSeEntero,
      });
      if (res.error) {
        setErrorAlta(res.error);
      } else {
        setNombre("");
        setTelefono("");
        setEmail("");
        setSedeHabitual("");
        setComoSeEntero("");
        setMostrarAlta(false);
      }
    });
  }

  function abrir(fila: Fila) {
    setAbierto(fila);
    setDetalle(null);
    startTransition(async () => {
      const d = await obtenerDetalleCliente(fila.id);
      setDetalle(d);
    });
  }

  const filtradas = useMemo(() => {
    if (filtro === "Activas") {
      return clientes.filter((c) => c.estadoMembresia === "activa");
    }
    if (filtro === "Inactivas") {
      return clientes.filter((c) => c.estadoMembresia !== "activa");
    }
    return clientes;
  }, [clientes, filtro]);

  return (
    <main className="min-h-screen bg-cream">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <div>
          <h1 className="font-serif text-2xl text-ink md:text-3xl">
            Clientas
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            {clientes.length} clientas registradas
          </p>
        </div>
        <div className="flex items-center gap-3">
          {puedeExportar && (
            <a
              href="/panel/clientes/export"
              className="rounded-full border border-white/15 px-4 py-2 text-sm text-ink/70 hover:text-ink"
            >
              Exportar CSV
            </a>
          )}
          {puedeCrear && (
            <button
              onClick={() => setMostrarAlta((v) => !v)}
              className="press-spring rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream"
            >
              {mostrarAlta ? "Cancelar" : "+ Nueva clienta"}
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 md:px-10">
        {mostrarAlta && (
          <div className="mb-6 grid gap-4 rounded-2xl border border-white/10 bg-card p-5 sm:grid-cols-2">
            <label className="text-sm text-ink/60">
              Nombre
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none focus:border-ink/30"
              />
            </label>
            <label className="text-sm text-ink/60">
              Teléfono
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none focus:border-ink/30"
              />
            </label>
            <label className="text-sm text-ink/60">
              Email (opcional)
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none focus:border-ink/30"
              />
            </label>
            {sedes.length > 0 && (
              <label className="text-sm text-ink/60">
                Sede habitual (opcional)
                <select
                  value={sedeHabitual}
                  onChange={(e) => setSedeHabitual(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none focus:border-ink/30"
                >
                  <option value="">Sin preferencia</option>
                  {sedes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="text-sm text-ink/60 sm:col-span-2">
              ¿Cómo se enteró? (opcional)
              <input
                type="text"
                value={comoSeEntero}
                onChange={(e) => setComoSeEntero(e.target.value)}
                placeholder="Instagram, referido, Google..."
                className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none focus:border-ink/30"
              />
            </label>
            <div className="sm:col-span-2">
              <button
                onClick={crear}
                disabled={isPending || !nombre || !telefono}
                className="press-spring rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-cream disabled:opacity-50"
              >
                {isPending ? "Creando…" : "Crear ficha"}
              </button>
              {errorAlta && (
                <span className="ml-4 text-sm text-red-500">{errorAlta}</span>
              )}
              <p className="mt-3 text-xs text-ink/45">
                Esto crea la ficha de la clienta. El acceso para que ella
                misma reserve (login propio) todavía se activa a mano por
                separado.
              </p>
            </div>
          </div>
        )}

        <div className="mb-5 flex gap-2">
          {FILTROS.map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors duration-200 ${
                filtro === f
                  ? "bg-ink text-cream"
                  : "bg-card text-ink/60 hover:text-ink"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 border-b border-white/10 px-4 pb-2 text-xs font-medium uppercase tracking-wide text-ink/40">
          <span>Clienta</span>
          <span className="w-24 text-right">Visitas</span>
          <span className="w-28 text-right">Última visita</span>
          <span className="w-20 text-right">LTV</span>
          <span className="w-28 text-right">Membresía</span>
        </div>

        <ul className="mt-2 space-y-2">
          {filtradas.map((c) => {
            const estado =
              ESTADO_LABEL[c.estadoMembresia] ?? ESTADO_LABEL.sin_paquete;
            return (
              <li key={c.id}>
                <button
                  onClick={() => abrir(c)}
                  className="grid w-full grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 rounded-2xl border border-white/10 bg-card p-4 text-left shadow-[0_2px_8px_-4px_rgba(17,17,17,0.08)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:shadow-[0_16px_28px_-12px_rgba(17,17,17,0.18)]"
                >
                  <div>
                    <p className="text-sm font-medium text-ink">{c.nombre}</p>
                    <p className="text-xs text-ink/50">{c.telefono}</p>
                  </div>
                  <span className="w-24 text-right text-sm tabular-nums text-ink/70">
                    {c.visitas}
                  </span>
                  <span className="w-28 text-right text-xs text-ink/50">
                    {c.ultimaVisita ?? "—"}
                  </span>
                  <span className="w-20 text-right text-sm tabular-nums text-ink/70">
                    Q{c.ltv}
                  </span>
                  <span
                    className={`w-28 rounded-full px-3 py-1 text-right text-xs font-medium ${estado.className}`}
                  >
                    {estado.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Drawer contextual — no navega, preserva el lugar exacto de la lista */}
      {abierto && (
        <>
          <div
            className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[2px] transition-opacity duration-300"
            onClick={() => setAbierto(null)}
          />
          <aside className="drawer-in fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-white/10 bg-card p-6 shadow-[0_0_60px_rgba(17,17,17,0.2)]">
            <button
              onClick={() => setAbierto(null)}
              className="text-sm text-ink/50 hover:text-ink"
            >
              ← Cerrar
            </button>

            <h2 className="mt-4 font-serif text-xl text-ink">
              {abierto.nombre}
            </h2>
            <p className="text-sm text-ink/55">
              {abierto.telefono}
              {abierto.email ? ` · ${abierto.email}` : ""}
            </p>

            {isPending || !detalle ? (
              <p className="mt-8 text-sm text-ink/40">Cargando…</p>
            ) : (
              <div className="mt-6 space-y-6">
                <div>
                  <h3 className="text-xs font-medium uppercase tracking-wide text-ink/45">
                    Membresías
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {detalle.membresias.length === 0 && (
                      <p className="text-sm text-ink/50">
                        Sin membresías registradas.
                      </p>
                    )}
                    {detalle.membresias.map((m) => {
                      const estado = ESTADO_LABEL[m.estado] ?? ESTADO_LABEL.sin_paquete;
                      return (
                        <li
                          key={m.id}
                          className="rounded-xl border border-white/10 bg-cream p-3 text-sm"
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${estado.className}`}
                            >
                              {estado.label}
                            </span>
                            <span className="text-xs text-ink/45">
                              Q{m.precio_final}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-ink/55">
                            {m.clases_usadas}/{m.clases_totales} clases usadas
                            {m.fecha_vencimiento
                              ? ` · vence ${m.fecha_vencimiento}`
                              : ""}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div>
                  <h3 className="text-xs font-medium uppercase tracking-wide text-ink/45">
                    Últimas reservas
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {detalle.reservas.length === 0 && (
                      <p className="text-sm text-ink/50">Sin reservas aún.</p>
                    )}
                    {detalle.reservas.map((r, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-cream p-3 text-sm"
                      >
                        <span className="text-ink/80">
                          {
                            (r.horarios as unknown as { nombre_clase: string } | null)
                              ?.nombre_clase
                          }
                        </span>
                        <span className="text-xs text-ink/45">
                          {r.fecha} ·{" "}
                          {r.asistio === true
                            ? "asistió"
                            : r.asistio === false
                              ? "no asistió"
                              : r.estado}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </aside>
        </>
      )}
    </main>
  );
}
