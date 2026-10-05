"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { definirMeta, eliminarActivoPasivo, eliminarGasto, registrarActivoPasivo, registrarGasto } from "./actions";

type Fila = { id: string; fecha: string; descripcion: string | null; monto: number };
type Gasto = Fila & { categoria: string; tipo: string };

const input =
  "mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none focus:border-ink/30";
const boton =
  "press-spring rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream disabled:opacity-50";
const q = (n: number) => `Q${n.toLocaleString("es-GT", { maximumFractionDigits: 2 })}`;

export default function RegistroView({
  tenantId,
  mes,
  sedes,
  gastos,
  activos,
  pasivos,
  meta,
  puedeBalance,
  puedeMeta,
}: {
  tenantId: string;
  mes: string;
  sedes: { id: string; name: string }[];
  gastos: Gasto[];
  activos: Fila[];
  pasivos: Fila[];
  meta: number | null;
  puedeBalance: boolean;
  puedeMeta: boolean;
}) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [g, setG] = useState({ sedeId: sedes[0]?.id ?? "", fecha: hoy, categoria: "", descripcion: "", monto: "", tipo: "variable", metodo: "" });
  const [ap, setAp] = useState({ tabla: "activos" as "activos" | "pasivos", descripcion: "", fecha: hoy, monto: "" });
  const [metaIn, setMetaIn] = useState(meta === null ? "" : String(meta));

  function correr(fn: () => Promise<{ error: string | null }>, ok: string, despues?: () => void) {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setMsg({ ok: false, texto: r.error });
      else {
        setMsg({ ok: true, texto: ok });
        despues?.();
      }
    });
  }

  const totActivos = activos.reduce((a, x) => a + x.monto, 0);
  const totPasivos = pasivos.reduce((a, x) => a + x.monto, 0);

  const Tarjeta = ({ children, titulo }: { children: React.ReactNode; titulo: string }) => (
    <section className="rounded-2xl border border-white/10 bg-card p-5">
      <h2 className="text-base font-semibold text-ink">{titulo}</h2>
      {children}
    </section>
  );

  return (
    <main className="min-h-screen bg-cream">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <div>
          <Link href="/panel/finanzas" className="text-sm text-ink/60 hover:text-ink">
            ← Finanzas
          </Link>
          <h1 className="mt-2 font-serif text-2xl text-ink md:text-3xl">Gastos y balance</h1>
        </div>
        {puedeBalance && (
          <a href="/panel/finanzas/export" className="rounded-full border border-white/15 px-4 py-2 text-sm text-ink/70 hover:text-ink">
            Exportar a CSV
          </a>
        )}
      </header>

      <div className="mx-auto grid max-w-4xl gap-6 px-6 py-8 md:px-10">
        {msg && (
          <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-sage-tint text-sage" : "bg-peach-tint text-ink"}`}>{msg.texto}</p>
        )}

        <Tarjeta titulo="Registrar gasto">
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-sm text-ink/60">
              Sede
              <select value={g.sedeId} onChange={(e) => setG({ ...g, sedeId: e.target.value })} className={input}>
                {sedes.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-ink/60">
              Fecha
              <input type="date" value={g.fecha} onChange={(e) => setG({ ...g, fecha: e.target.value })} className={input} />
            </label>
            <label className="text-sm text-ink/60">
              Monto (Q)
              <input type="number" min={0} value={g.monto} onChange={(e) => setG({ ...g, monto: e.target.value })} className={input} />
            </label>
            <label className="text-sm text-ink/60">
              Categoría
              <input value={g.categoria} onChange={(e) => setG({ ...g, categoria: e.target.value })} placeholder="Renta, luz, sueldos…" className={input} />
            </label>
            <label className="text-sm text-ink/60">
              Tipo
              <select value={g.tipo} onChange={(e) => setG({ ...g, tipo: e.target.value })} className={input}>
                <option value="variable">Variable</option>
                <option value="fijo">Fijo</option>
              </select>
            </label>
            <label className="text-sm text-ink/60">
              Nota
              <input value={g.descripcion} onChange={(e) => setG({ ...g, descripcion: e.target.value })} className={input} />
            </label>
          </div>
          <button
            className={`${boton} mt-4`}
            disabled={isPending || !g.categoria.trim() || !(Number(g.monto) > 0)}
            onClick={() =>
              correr(
                () => registrarGasto({ tenantId, sedeId: g.sedeId || null, fecha: g.fecha, categoria: g.categoria, descripcion: g.descripcion, monto: Number(g.monto), tipo: g.tipo, metodo: g.metodo }),
                "Gasto registrado.",
                () => setG({ ...g, categoria: "", descripcion: "", monto: "" }),
              )
            }
          >
            Guardar gasto
          </button>
          <ul className="mt-5 divide-y divide-white/10">
            {gastos.length === 0 && <li className="py-3 text-sm text-ink/50">Sin gastos registrados.</li>}
            {gastos.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-ink">
                  {x.fecha} · {x.categoria}
                  {x.descripcion ? <span className="text-ink/55"> · {x.descripcion}</span> : null}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-ink">{q(x.monto)}</span>
                  {puedeBalance && (
                    <button className="text-xs text-ink/50 hover:text-ink" disabled={isPending} onClick={() => correr(() => eliminarGasto(x.id), "Gasto eliminado.")}>
                      Eliminar
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Tarjeta>

        {puedeMeta && (
          <Tarjeta titulo="Meta de ingresos del mes">
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-sm text-ink/60">
                Meta (Q)
                <input type="number" min={0} value={metaIn} onChange={(e) => setMetaIn(e.target.value)} className={`${input} w-48`} />
              </label>
              <button className={boton} disabled={isPending || metaIn === ""} onClick={() => correr(() => definirMeta(tenantId, mes, Number(metaIn)), "Meta guardada.")}>
                Guardar meta
              </button>
            </div>
          </Tarjeta>
        )}

        {puedeBalance && (
          <Tarjeta titulo={`Activos ${q(totActivos)} · Pasivos ${q(totPasivos)} · Patrimonio ${q(totActivos - totPasivos)}`}>
            <div className="mt-3 grid gap-3 sm:grid-cols-[140px_1fr_150px_140px_auto]">
              <select value={ap.tabla} onChange={(e) => setAp({ ...ap, tabla: e.target.value as "activos" | "pasivos" })} className={input}>
                <option value="activos">Activo</option>
                <option value="pasivos">Pasivo</option>
              </select>
              <input placeholder="Descripción" value={ap.descripcion} onChange={(e) => setAp({ ...ap, descripcion: e.target.value })} className={input} />
              <input type="date" value={ap.fecha} onChange={(e) => setAp({ ...ap, fecha: e.target.value })} className={input} />
              <input type="number" min={0} placeholder="Monto" value={ap.monto} onChange={(e) => setAp({ ...ap, monto: e.target.value })} className={input} />
              <button
                className={`${boton} self-end`}
                disabled={isPending || !ap.descripcion.trim() || !(Number(ap.monto) > 0)}
                onClick={() =>
                  correr(
                    () => registrarActivoPasivo({ tenantId, tabla: ap.tabla, descripcion: ap.descripcion, fecha: ap.fecha, monto: Number(ap.monto) }),
                    "Registrado.",
                    () => setAp({ ...ap, descripcion: "", monto: "" }),
                  )
                }
              >
                Agregar
              </button>
            </div>
            {(
              [
                ["Activos", "activos", activos],
                ["Pasivos", "pasivos", pasivos],
              ] as const
            ).map(([titulo, tabla, filas]) => (
              <div key={tabla} className="mt-5">
                <p className="text-xs uppercase tracking-wide text-ink/45">{titulo}</p>
                <ul className="mt-1 divide-y divide-white/10">
                  {filas.length === 0 && <li className="py-2 text-sm text-ink/50">Ninguno.</li>}
                  {filas.map((x) => (
                    <li key={x.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-ink">
                        {x.fecha} · {x.descripcion}
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-ink">{q(x.monto)}</span>
                        <button className="text-xs text-ink/50 hover:text-ink" disabled={isPending} onClick={() => correr(() => eliminarActivoPasivo(tabla, x.id), "Eliminado.")}>
                          Eliminar
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Tarjeta>
        )}
      </div>
    </main>
  );
}
