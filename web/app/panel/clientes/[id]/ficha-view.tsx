"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ajustarCreditos,
  cancelarReservaDeClienta,
  congelar,
  descongelar,
  guardarFicha,
  reservarPorClienta,
  transferir,
  venderPaquete,
} from "./actions";

type Cliente = {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
  notas: string;
  cuidados: string;
  emergencia: string;
  nacimiento: string;
  consentimiento: boolean;
};
type Membresia = {
  id: string;
  estado: string;
  totales: number | null;
  usadas: number;
  inicio: string | null;
  vence: string | null;
  precio: number | null;
  metodo: string | null;
  origen: string | null;
  paquete: string;
};
type Reserva = {
  id: string;
  fecha: string;
  estado: string;
  asistio: boolean | null;
  clase: string;
  hora: string;
  sede: string;
};

const METODOS = [
  { v: "efectivo", l: "Efectivo" },
  { v: "tarjeta_estudio", l: "Tarjeta (en el estudio)" },
  { v: "transferencia", l: "Transferencia" },
];

const ESTADO: Record<string, string> = {
  activa: "Activa",
  vencida: "Vencida",
  pendiente_pago: "Pago pendiente",
  anulada: "Anulada",
  congelada: "Congelada",
};

const input =
  "mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none focus:border-ink/30";
const boton =
  "press-spring rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream disabled:opacity-50";
const botonSec =
  "rounded-full border border-white/15 px-3 py-1.5 text-xs text-ink/70 hover:text-ink disabled:opacity-50";

export default function FichaView({
  cliente,
  membresias,
  reservas,
  paquetes,
  sedes,
  opcionesClase,
  otrasClientas,
  puedeVender,
  puedeCortesia,
  puedeEditar,
}: {
  cliente: Cliente;
  membresias: Membresia[];
  reservas: Reserva[];
  paquetes: { id: string; nombre: string; precio: number }[];
  sedes: { id: string; name: string }[];
  opcionesClase: { horarioId: string; fecha: string; texto: string }[];
  otrasClientas: { id: string; nombre: string }[];
  puedeVender: boolean;
  puedeCortesia: boolean;
  puedeEditar: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  // ficha
  const [f, setF] = useState({
    nombre: cliente.nombre,
    telefono: cliente.telefono,
    email: cliente.email,
    notas: cliente.notas,
    cuidados: cliente.cuidados,
    emergencia: cliente.emergencia,
    nacimiento: cliente.nacimiento,
  });
  // venta
  const [paqueteId, setPaqueteId] = useState("");
  const [sedeId, setSedeId] = useState(sedes[0]?.id ?? "");
  const [metodo, setMetodo] = useState("efectivo");
  const [codigo, setCodigo] = useState("");
  // reserva
  const [claseSel, setClaseSel] = useState("");
  // ajuste / transferir
  const [ajusteDe, setAjusteDe] = useState<string | null>(null);
  const [delta, setDelta] = useState("");
  const [motivo, setMotivo] = useState("");
  const [transferDe, setTransferDe] = useState<string | null>(null);
  const [destino, setDestino] = useState("");

  function correr(fn: () => Promise<{ error: string | null }>, okTexto: string, despues?: () => void) {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) {
        setMsg({ ok: false, texto: res.error });
      } else {
        setMsg({ ok: true, texto: okTexto });
        despues?.();
      }
    });
  }

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <Link href="/panel/clientes" className="text-sm text-ink/60 hover:text-ink">
          ← Clientas
        </Link>
        <h1 className="mt-2 font-serif text-2xl text-ink md:text-3xl">
          {cliente.nombre}
        </h1>
        <p className="mt-1 text-sm text-ink/60">
          {cliente.telefono}
          {cliente.email ? ` · ${cliente.email}` : ""} ·{" "}
          {cliente.consentimiento ? "Consentimiento firmado" : "Consentimiento pendiente"}
        </p>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-6 py-8 md:px-10">
        {msg && (
          <p
            className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-sage-tint text-sage" : "bg-peach-tint text-ink"}`}
          >
            {msg.texto}
          </p>
        )}

        {/* Membresías: saldo y consumo (P27) */}
        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-base font-semibold text-ink">Paquetes y saldo</h2>
          {membresias.length === 0 && (
            <p className="mt-3 text-sm text-ink/50">Sin paquetes todavía.</p>
          )}
          <ul className="mt-3 divide-y divide-white/10">
            {membresias.map((m) => {
              const restantes =
                m.totales === null ? null : m.totales - m.usadas;
              const vigente = m.estado === "activa" || m.estado === "congelada";
              return (
                <li key={m.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {m.paquete}{" "}
                        <span className="text-xs text-ink/50">
                          · {ESTADO[m.estado] ?? m.estado}
                          {m.origen === "cortesia" ? " · cortesía" : ""}
                        </span>
                      </p>
                      <p className="text-xs text-ink/60">
                        {restantes === null
                          ? "Ilimitado"
                          : `${restantes} de ${m.totales} clases disponibles`}
                        {" · usadas "}
                        {m.usadas}
                        {m.vence ? ` · vence ${m.vence}` : ""}
                        {m.precio !== null ? ` · Q${Number(m.precio).toLocaleString("es-GT")}` : ""}
                      </p>
                    </div>
                    {puedeVender && vigente && (
                      <div className="flex flex-wrap gap-2">
                        {m.estado === "activa" ? (
                          <button
                            className={botonSec}
                            disabled={isPending}
                            onClick={() => correr(() => congelar(cliente.id, m.id), "Membresía congelada.")}
                          >
                            Congelar
                          </button>
                        ) : (
                          <button
                            className={botonSec}
                            disabled={isPending}
                            onClick={() => correr(() => descongelar(cliente.id, m.id), "Membresía reactivada.")}
                          >
                            Reactivar
                          </button>
                        )}
                        <button
                          className={botonSec}
                          onClick={() => setTransferDe(transferDe === m.id ? null : m.id)}
                        >
                          Transferir
                        </button>
                        {puedeCortesia && m.totales !== null && (
                          <button
                            className={botonSec}
                            onClick={() => setAjusteDe(ajusteDe === m.id ? null : m.id)}
                          >
                            Ajustar créditos
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {ajusteDe === m.id && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-[120px_1fr_auto]">
                      <label className="text-xs text-ink/60">
                        Clases (+/−)
                        <input
                          type="number"
                          value={delta}
                          onChange={(e) => setDelta(e.target.value)}
                          className={input}
                          placeholder="ej. 2 o -1"
                        />
                      </label>
                      <label className="text-xs text-ink/60">
                        Motivo
                        <input
                          value={motivo}
                          onChange={(e) => setMotivo(e.target.value)}
                          className={input}
                        />
                      </label>
                      <button
                        className={`${boton} self-end`}
                        disabled={isPending}
                        onClick={() =>
                          correr(
                            () => ajustarCreditos(cliente.id, m.id, Number(delta), motivo),
                            "Créditos ajustados.",
                            () => {
                              setAjusteDe(null);
                              setDelta("");
                              setMotivo("");
                            },
                          )
                        }
                      >
                        Guardar
                      </button>
                    </div>
                  )}

                  {transferDe === m.id && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                      <label className="text-xs text-ink/60">
                        Transferir a
                        <select
                          value={destino}
                          onChange={(e) => setDestino(e.target.value)}
                          className={input}
                        >
                          <option value="">Elige una clienta…</option>
                          {otrasClientas.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nombre}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className={`${boton} self-end`}
                        disabled={isPending || !destino}
                        onClick={() =>
                          correr(
                            () => transferir(cliente.id, m.id, destino),
                            "Membresía transferida.",
                            () => setTransferDe(null),
                          )
                        }
                      >
                        Transferir
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Venta / cortesía (P24, P25) */}
        {puedeVender && (
          <section className="rounded-2xl border border-white/10 bg-card p-5">
            <h2 className="text-base font-semibold text-ink">Vender o regalar paquete</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-ink/60">
                Paquete
                <select value={paqueteId} onChange={(e) => setPaqueteId(e.target.value)} className={input}>
                  <option value="">Elige…</option>
                  {paquetes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} · Q{p.precio.toLocaleString("es-GT")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-ink/60">
                Sede
                <select value={sedeId} onChange={(e) => setSedeId(e.target.value)} className={input}>
                  {sedes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-ink/60">
                Forma de pago
                <select value={metodo} onChange={(e) => setMetodo(e.target.value)} className={input}>
                  {METODOS.map((m) => (
                    <option key={m.v} value={m.v}>
                      {m.l}
                    </option>
                  ))}
                  {puedeCortesia && <option value="cortesia">Cortesía (gratis)</option>}
                </select>
              </label>
              <label className="text-sm text-ink/60">
                Código de descuento (opcional)
                <input
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  disabled={metodo === "cortesia"}
                  className={input}
                />
              </label>
            </div>
            <button
              className={`${boton} mt-4`}
              disabled={isPending || !paqueteId || !sedeId}
              onClick={() =>
                correr(
                  () => venderPaquete(cliente.id, { paqueteId, sedeId, metodo, codigo }),
                  metodo === "cortesia" ? "Paquete regalado." : "Venta registrada.",
                  () => {
                    setPaqueteId("");
                    setCodigo("");
                  },
                )
              }
            >
              {metodo === "cortesia" ? "Regalar paquete" : "Registrar venta"}
            </button>
          </section>
        )}

        {/* Reservas (P18) */}
        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-base font-semibold text-ink">Reservas</h2>
          {puedeVender && (
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
              <select
                value={claseSel}
                onChange={(e) => setClaseSel(e.target.value)}
                className={input}
              >
                <option value="">Reservar en una clase (próximos 14 días)…</option>
                {opcionesClase.map((o) => (
                  <option key={`${o.horarioId}|${o.fecha}`} value={`${o.horarioId}|${o.fecha}`}>
                    {o.texto}
                  </option>
                ))}
              </select>
              <button
                className={boton}
                disabled={isPending || !claseSel}
                onClick={() => {
                  const [h, fch] = claseSel.split("|");
                  correr(() => reservarPorClienta(cliente.id, h, fch), "Reserva creada.", () =>
                    setClaseSel(""),
                  );
                }}
              >
                Reservar
              </button>
            </div>
          )}
          <ul className="mt-3 divide-y divide-white/10">
            {reservas.length === 0 && (
              <li className="py-3 text-sm text-ink/50">Sin reservas.</li>
            )}
            {reservas.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-ink">
                  {r.fecha} · {r.hora} · {r.clase}
                  {r.sede ? <span className="text-ink/50"> · {r.sede}</span> : null}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-ink/60">
                    {r.estado === "cancelada"
                      ? "Cancelada"
                      : r.asistio === true
                        ? "Asistió"
                        : r.asistio === false
                          ? "No asistió"
                          : r.fecha >= hoy
                            ? "Próxima"
                            : "Sin marcar"}
                  </span>
                  {puedeVender && r.estado === "confirmada" && r.fecha >= hoy && (
                    <button
                      className={botonSec}
                      disabled={isPending}
                      onClick={() =>
                        correr(() => cancelarReservaDeClienta(cliente.id, r.id), "Reserva cancelada.")
                      }
                    >
                      Cancelar
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Ficha (P12) */}
        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-base font-semibold text-ink">Datos de la clienta</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["nombre", "Nombre"],
                ["telefono", "Teléfono"],
                ["email", "Correo"],
                ["emergencia", "Contacto de emergencia"],
              ] as const
            ).map(([k, l]) => (
              <label key={k} className="text-sm text-ink/60">
                {l}
                <input
                  value={f[k]}
                  onChange={(e) => setF({ ...f, [k]: e.target.value })}
                  disabled={!puedeEditar}
                  className={input}
                />
              </label>
            ))}
            <label className="text-sm text-ink/60">
              Fecha de nacimiento
              <input
                type="date"
                value={f.nacimiento}
                onChange={(e) => setF({ ...f, nacimiento: e.target.value })}
                disabled={!puedeEditar}
                className={input}
              />
            </label>
            <label className="text-sm text-ink/60 sm:col-span-2">
              Cuidados especiales (lesiones, embarazo…)
              <textarea
                value={f.cuidados}
                onChange={(e) => setF({ ...f, cuidados: e.target.value })}
                disabled={!puedeEditar}
                rows={2}
                className={input}
              />
            </label>
            <label className="text-sm text-ink/60 sm:col-span-2">
              Notas internas
              <textarea
                value={f.notas}
                onChange={(e) => setF({ ...f, notas: e.target.value })}
                disabled={!puedeEditar}
                rows={2}
                className={input}
              />
            </label>
          </div>
          {puedeEditar && (
            <button
              className={`${boton} mt-4`}
              disabled={isPending}
              onClick={() => correr(() => guardarFicha(cliente.id, f), "Datos guardados.")}
            >
              Guardar datos
            </button>
          )}
        </section>
      </div>
    </main>
  );
}
