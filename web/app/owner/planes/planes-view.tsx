"use client";

import { useState, useTransition } from "react";
import { guardarPlan, impactoPlan } from "./actions";

export type Plan = {
  key: string; nombre: string; descripcion: string | null; precio_mensual: number;
  max_sedes: number | null; max_staff: number | null; modulos: string[]; activo: boolean;
  estado?: string; moneda?: string; prueba_gratuita?: boolean; version?: number;
};
export type ModuloCat = { key: string; name: string; description: string; depends_on: string[] };

const input = "mt-1 w-full rounded-lg border border-white/15 bg-void px-3 py-2 text-white outline-none focus:border-lime/60";
const vacio = { key: "", nombre: "", descripcion: "", precio: "", moneda: "GTQ", pruebaGratuita: false, estado: "borrador", maxSedes: "", maxStaff: "", modulos: [] as string[] };
const ESTADOS: Record<string, { texto: string; clase: string }> = {
  borrador: { texto: "Borrador · no se puede vender", clase: "text-yellow-300" },
  publicado: { texto: "Publicado · disponible para vender", clase: "text-lime" },
  retirado: { texto: "Retirado · no se ofrece más", clase: "text-white/55" },
};
const simbolo = (m?: string) => (m === "USD" ? "US$" : "Q");

export default function PlanesView({ planes, modulos, soloLectura = false }: { planes: Plan[]; modulos: ModuloCat[]; soloLectura?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [f, setF] = useState(vacio);
  const [editando, setEditando] = useState(false);
  const [esNuevo, setEsNuevo] = useState(true);
  const [impacto, setImpacto] = useState<{ suscripciones_activas: number; estudios: number; mrr: number; propuestas_abiertas: number } | null>(null);

  function editar(p: Plan) {
    setF({ key: p.key, nombre: p.nombre, descripcion: p.descripcion ?? "", precio: String(p.precio_mensual), moneda: p.moneda ?? "GTQ", pruebaGratuita: !!p.prueba_gratuita,
      estado: p.estado ?? (p.activo ? "publicado" : "retirado"), maxSedes: p.max_sedes === null ? "" : String(p.max_sedes), maxStaff: p.max_staff === null ? "" : String(p.max_staff), modulos: p.modulos });
    setEsNuevo(false); setEditando(true); setImpacto(null); setMsg(null);
    impactoPlan(p.key).then((r) => setImpacto(r.impacto));
  }
  function toggle(k: string) {
    const quitar = f.modulos.includes(k);
    let nuevos = quitar ? f.modulos.filter((x) => x !== k) : [...f.modulos, k];
    if (!quitar) {
      const req = modulos.find((m) => m.key === k)?.depends_on ?? [];
      nuevos = Array.from(new Set([...nuevos, ...req]));
    } else {
      nuevos = nuevos.filter((x) => !(modulos.find((m) => m.key === x)?.depends_on ?? []).includes(k));
    }
    setF({ ...f, modulos: nuevos });
  }

  const precio = Number(f.precio || 0);
  const nombreDe = (k: string) => modulos.find((m) => m.key === k)?.name ?? k;
  const falta = !/^[a-z0-9_]{2,30}$/.test(f.key) ? "La clave debe tener 2 a 30 caracteres: minúsculas, números o guion bajo"
    : !f.nombre.trim() ? "Escribe el nombre del plan"
    : f.precio === "" ? "El precio mensual es obligatorio"
    : f.estado === "publicado" && precio <= 0 && !f.pruebaGratuita ? "Para publicar un plan en Q0 márcalo como prueba gratuita; si no, déjalo en borrador"
    : "";

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Planes</h1>
          <p className="mt-1 text-sm text-white/60">Catálogo de lo que se vende: precio, límites y módulos. Solo los planes <strong>publicados</strong> se pueden ofrecer en propuestas y asignar a un estudio. Un plan en Q0 queda en borrador, salvo prueba gratuita explícita.</p>
        </div>
        {soloLectura ? <p className="text-xs text-white/60">Solo lectura: crear o editar planes requiere el rol operador.</p> : <button className="rounded-full bg-lime px-4 py-2 text-sm font-semibold text-void" onClick={() => { setF(vacio); setEsNuevo(true); setImpacto(null); setMsg(null); setEditando(true); }}>+ Nuevo plan</button>}
      </div>
      {msg && <p role="status" className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm">{msg}</p>}

      {editando && (
        <section className="mt-6 rounded-2xl border border-white/10 bg-void-card p-5" aria-label={esNuevo ? "Nuevo plan" : `Editar plan ${f.nombre}`}>
          <p className="text-xs text-white/55">Los campos con * son obligatorios.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-sm text-white/70">Clave única * (minúsculas, sin espacios)<input className={input} value={f.key} disabled={!esNuevo} onChange={(e) => setF({ ...f, key: e.target.value })} /></label>
            <label className="text-sm text-white/70">Nombre *<input className={input} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></label>
            <label className="text-sm text-white/70">Estado
              <select className={input} value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}>
                <option value="borrador">Borrador</option><option value="publicado">Publicado</option><option value="retirado">Retirado</option>
              </select>
            </label>
            <label className="text-sm text-white/70">Precio mensual * (por mes)<input type="number" min={0} className={input} value={f.precio} onChange={(e) => setF({ ...f, precio: e.target.value })} /></label>
            <label className="text-sm text-white/70">Moneda
              <select className={input} value={f.moneda} onChange={(e) => setF({ ...f, moneda: e.target.value })}><option value="GTQ">Quetzales (Q)</option><option value="USD">Dólares (US$)</option></select>
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm text-white/70"><input type="checkbox" checked={f.pruebaGratuita} onChange={(e) => setF({ ...f, pruebaGratuita: e.target.checked })} /> Es una prueba gratuita (permite Q0)</label>
            <label className="text-sm text-white/70">Máx. sedes (vacío = sin límite)<input type="number" min={1} className={input} value={f.maxSedes} onChange={(e) => setF({ ...f, maxSedes: e.target.value })} /></label>
            <label className="text-sm text-white/70">Máx. personal (vacío = sin límite)<input type="number" min={1} className={input} value={f.maxStaff} onChange={(e) => setF({ ...f, maxStaff: e.target.value })} /></label>
            <label className="text-sm text-white/70">Descripción<input className={input} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></label>
          </div>
          <p className="mt-4 text-xs font-medium text-white/60">Módulos incluidos</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {modulos.map((m) => (
              <label key={m.key} className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={f.modulos.includes(m.key)} onChange={() => toggle(m.key)} className="mt-1" />
                <span>
                  {m.name}
                  {m.depends_on.length > 0 && <span className="text-xs text-white/50"> · requiere {m.depends_on.map(nombreDe).join(", ")}</span>}
                </span>
              </label>
            ))}
          </div>
          {!esNuevo && impacto && (
            <div className="mt-4 rounded-xl border border-white/10 bg-void p-3 text-sm text-white/75" role="note">
              <strong>Impacto de cambiar este plan:</strong> {impacto.estudios} estudio(s) lo usan ({impacto.suscripciones_activas} con suscripción activa, {simbolo(f.moneda)}{Number(impacto.mrr).toLocaleString("es-GT")}/mes) y hay {impacto.propuestas_abiertas} propuesta(s) abierta(s). Un cambio de precio o módulos crea una versión nueva; las suscripciones existentes conservan su precio hasta que las actualices.
            </div>
          )}
          {falta && <p className="mt-3 text-xs text-white/60">Para guardar: {falta}.</p>}
          <div className="mt-4 flex gap-3">
            <button
              className="rounded-full bg-lime px-4 py-2 text-sm font-semibold text-void disabled:opacity-50"
              disabled={isPending || !!falta}
              onClick={() => {
                setMsg(null);
                startTransition(async () => {
                  const r = await guardarPlan({ key: f.key.trim(), nombre: f.nombre, descripcion: f.descripcion, precio, moneda: f.moneda, pruebaGratuita: f.pruebaGratuita, estado: f.estado, crear: esNuevo,
                    maxSedes: f.maxSedes ? Number(f.maxSedes) : null, maxStaff: f.maxStaff ? Number(f.maxStaff) : null, modulos: f.modulos });
                  if (r.error) setMsg(r.error);
                  else { setMsg("Plan guardado."); setEditando(false); }
                });
              }}
            >
              {isPending ? "Guardando…" : "Guardar plan"}
            </button>
            <button className="text-sm text-white/60" onClick={() => setEditando(false)}>Cancelar</button>
          </div>
        </section>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {planes.map((p) => {
          const est = ESTADOS[p.estado ?? (p.activo ? "publicado" : "retirado")];
          return (
            <section key={p.key} className={`rounded-2xl border p-5 ${p.estado === "retirado" ? "border-white/5 bg-void opacity-70" : "border-white/10 bg-void-card"}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{p.nombre}</h2>
                  <p className="text-xs text-white/55">{p.key} · versión {p.version ?? 1}</p>
                </div>
                {!soloLectura && <button className="text-xs text-white/60 hover:text-white" onClick={() => editar(p)} aria-label={`Editar plan ${p.nombre}`}>Editar</button>}
              </div>
              <p className={`mt-2 text-xs ${est.clase}`}>{est.texto}</p>
              <p className="mt-3 text-2xl font-semibold text-lime">{simbolo(p.moneda)}{Number(p.precio_mensual).toLocaleString("es-GT")}<span className="text-sm font-normal text-white/55"> / mes</span></p>
              {p.prueba_gratuita && <p className="text-xs text-white/60">Prueba gratuita</p>}
              <p className="mt-1 text-xs text-white/60">{p.max_sedes ?? "Sin límite de"} sede(s) · {p.max_staff ?? "sin límite de"} personal</p>
              {p.descripcion && <p className="mt-2 text-sm text-white/70">{p.descripcion}</p>}
              <p className="mt-3 text-xs text-white/55">{p.modulos.length} módulos: {p.modulos.map(nombreDe).slice(0, 3).join(", ")}{p.modulos.length > 3 ? "…" : ""}</p>
            </section>
          );
        })}
        {planes.length === 0 && <p className="text-sm text-white/60">No hay planes. Crea el primero con «+ Nuevo plan».</p>}
      </div>
    </main>
  );
}
