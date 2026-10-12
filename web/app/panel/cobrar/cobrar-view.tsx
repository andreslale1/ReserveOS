"use client";

import { useMemo, useState, useTransition } from "react";
import { cobrarPaquete } from "./actions";

export type PaqueteCat = { id: string; nombre: string; num_clases: number | null; precio: number; vigencia_dias: number; cobertura: string; sedes: string | null; sede_ids: string[] };
type Clienta = { id: string; nombre: string; telefono: string | null; email: string | null };

const q = (n: number) => `Q${Number(n).toLocaleString("es-GT")}`;
const input = "mt-1 w-full rounded-lg border border-white/15 bg-card px-3 py-2 text-ink outline-none focus:border-ink/40";
const METODOS = [
  { id: "efectivo", label: "Efectivo" },
  { id: "tarjeta_estudio", label: "Tarjeta (POS del estudio)" },
  { id: "transferencia", label: "Transferencia" },
];

export default function CobrarView({ clientas, paquetes, sedes, puedeCortesia }: { clientas: Clienta[]; paquetes: PaqueteCat[]; sedes: { id: string; name: string }[]; puedeCortesia: boolean }) {
  const [busca, setBusca] = useState("");
  const [clienta, setClienta] = useState<Clienta | null>(null);
  const [sedeId, setSedeId] = useState(sedes[0]?.id ?? "");
  const [paqueteId, setPaqueteId] = useState("");
  const [metodo, setMetodo] = useState("efectivo");
  const [codigo, setCodigo] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, startTransition] = useTransition();

  const resultados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (t.length < 2) return [];
    return clientas.filter((c) => c.nombre.toLowerCase().includes(t) || (c.telefono ?? "").includes(t) || (c.email ?? "").toLowerCase().includes(t)).slice(0, 8);
  }, [busca, clientas]);
  // Solo paquetes que sirven en la sede donde se cobra.
  const disponibles = paquetes.filter((p) => p.cobertura === "todas" || (p.sede_ids ?? []).includes(sedeId) || (p.sede_ids ?? []).length === 0);
  const paquete = paquetes.find((p) => p.id === paqueteId) ?? null;
  const listo = !!clienta && !!paquete && !!sedeId;

  function cobrar() {
    if (!clienta || !paquete) return;
    setMsg(null);
    startTransition(async () => {
      const r = await cobrarPaquete({ clienteId: clienta.id, paqueteId: paquete.id, sedeId, metodo, codigo });
      if (r.error) setMsg({ ok: false, texto: r.error });
      else {
        setMsg({ ok: true, texto: `Cobrado: ${paquete.nombre} a ${clienta.nombre}. La clienta ya puede reservar con él.` });
        setClienta(null); setBusca(""); setPaqueteId(""); setCodigo("");
      }
    });
  }

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <div className="mx-auto max-w-2xl">
        <h1 className="font-serif text-2xl text-ink md:text-3xl">Cobrar un paquete</h1>
        <p className="mt-1 text-sm text-ink/60">Busca a la clienta, elige el paquete y registra el cobro. Queda en la caja de la sede.</p>
        </div>
      </header>
      <div className="mx-auto grid max-w-2xl gap-6 px-6 py-8 md:px-10">
        {msg && <p role={msg.ok ? "status" : "alert"} className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-sage-tint text-sage" : "bg-peach-tint text-ink"}`}>{msg.texto}</p>}

        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-base font-semibold text-ink">1. ¿Quién paga?</h2>
          {clienta ? (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-cream px-4 py-3">
              <div><p className="text-sm font-medium text-ink">{clienta.nombre}</p><p className="text-xs text-ink/55">{clienta.telefono ?? clienta.email ?? ""}</p></div>
              <button className="text-xs text-ink/60 underline" onClick={() => setClienta(null)}>Cambiar</button>
            </div>
          ) : (
            <>
              <label className="mt-3 block text-sm text-ink/60">Nombre, teléfono o correo
                <input className={input} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Escribe al menos 2 letras" autoComplete="off" />
              </label>
              {resultados.length > 0 && (
                <ul className="mt-2 divide-y divide-white/10 rounded-xl border border-white/10">
                  {resultados.map((c) => (
                    <li key={c.id}><button className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-ink hover:bg-white/5" onClick={() => setClienta(c)}>
                      <span>{c.nombre}</span><span className="text-xs text-ink/50">{c.telefono ?? ""}</span></button></li>
                  ))}
                </ul>
              )}
              {busca.trim().length >= 2 && resultados.length === 0 && <p className="mt-2 text-sm text-ink/55">No hay coincidencias. Si es nueva, créala primero en <a className="underline" href="/panel/clientes">Clientas</a>.</p>}
            </>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-base font-semibold text-ink">2. ¿Qué compra?</h2>
          {sedes.length > 1 && (
            <label className="mt-3 block text-sm text-ink/60">Sede donde se cobra
              <select className={input} value={sedeId} onChange={(e) => { setSedeId(e.target.value); setPaqueteId(""); }}>{sedes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            </label>
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {disponibles.map((p) => (
              <button key={p.id} onClick={() => setPaqueteId(p.id)} aria-pressed={paqueteId === p.id}
                className={`rounded-xl border px-4 py-3 text-left transition ${paqueteId === p.id ? "border-ink bg-white/10" : "border-white/15 hover:border-white/30"}`}>
                <span className="block text-sm font-medium text-ink">{p.nombre}</span>
                <span className="block text-xs text-ink/55">{p.num_clases ?? "Ilimitadas"} clases · {p.vigencia_dias} días{p.sedes ? ` · ${p.sedes}` : ""}</span>
                <span className="mt-1 block text-base font-semibold text-ink">{q(p.precio)}</span>
              </button>
            ))}
            {disponibles.length === 0 && <p className="text-sm text-ink/55">No hay paquetes para esta sede.</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-base font-semibold text-ink">3. ¿Cómo paga?</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {[...METODOS, ...(puedeCortesia ? [{ id: "cortesia", label: "Cortesía (sin cobro)" }] : [])].map((m) => (
              <button key={m.id} onClick={() => setMetodo(m.id)} aria-pressed={metodo === m.id}
                className={`rounded-full border px-4 py-1.5 text-sm ${metodo === m.id ? "border-ink bg-ink text-cream" : "border-white/15 text-ink/70 hover:text-ink"}`}>{m.label}</button>
            ))}
          </div>
          {metodo !== "cortesia" && (
            <label className="mt-4 block text-sm text-ink/60">Código de descuento (opcional)
              <input className={input} value={codigo} onChange={(e) => setCodigo(e.target.value)} autoComplete="off" />
            </label>
          )}
        </section>

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-card p-5">
          <p className="text-sm text-ink/70">{listo ? <>Total: <strong className="text-lg text-ink">{metodo === "cortesia" ? "Q0" : q(paquete!.precio)}</strong>{codigo.trim() && metodo !== "cortesia" ? " (con descuento al confirmar)" : ""}</> : "Elige clienta y paquete."}</p>
          <button disabled={!listo || pendiente} onClick={cobrar} className="press-spring rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-cream disabled:opacity-40">
            {pendiente ? "Cobrando…" : "Cobrar"}
          </button>
        </div>
      </div>
    </main>
  );
}
