"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { marcarEtapa, publicarProyecto, vincularEstudio } from "./actions";

type Etapa = { key: string; nombre: string; obligatoria: boolean; hecha: boolean };
export type Proyecto = { id: string; nombre: string; estado: string; tenant_id: string | null; lead_id: string | null; etapas: Etapa[]; created_at: string; en_vivo_at: string | null };

export default function ActivacionesView({ proyectos, tenants }: { proyectos: Proyecto[]; tenants: { id: string; name: string }[] }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [sel, setSel] = useState<Record<string, string>>({});

  function correr(fn: () => Promise<{ error: string | null }>, ok?: string) {
    setMsg(null);
    startTransition(async () => { const r = await fn(); setMsg(r.error ?? ok ?? null); });
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8 md:px-10">
      <h1 className="text-2xl font-semibold">Activaciones</h1>
      <p className="mt-1 text-sm text-white/50">Cada oportunidad ganada crea un proyecto para dejar al estudio funcionando. No se puede salir en vivo con etapas obligatorias pendientes.</p>
      {msg && <p className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm">{msg}</p>}
      {proyectos.length === 0 && <p className="mt-8 text-sm text-white/50">Aún no hay proyectos. Aparecen solos cuando marcas una oportunidad como «ganado» en el Pipeline.</p>}
      <div className="mt-6 grid gap-5">
        {proyectos.map((p) => {
          const hechas = p.etapas.filter((e) => e.hecha).length;
          const obligFalta = p.etapas.filter((e) => e.obligatoria && !e.hecha).length;
          return (
            <section key={p.id} className="rounded-2xl border border-white/10 bg-void-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">{p.nombre}</h2>
                  <p className="text-xs text-white/45">{hechas}/{p.etapas.length} etapas · {p.estado === "en_vivo" ? `en vivo desde ${p.en_vivo_at?.slice(0, 10)}` : p.estado === "cancelado" ? "cancelado" : `${obligFalta} obligatorias pendientes`}
                    {p.lead_id && <> · <Link href={`/owner/pipeline/${p.lead_id}`} className="text-lime">ver oportunidad</Link></>}</p>
                </div>
                {p.estado === "en_curso" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select className="rounded-lg border border-white/15 bg-void px-2 py-1.5 text-sm" value={sel[p.id] ?? p.tenant_id ?? ""} onChange={(e) => setSel({ ...sel, [p.id]: e.target.value })}>
                      <option value="">Vincular estudio creado…</option>
                      {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <button className="rounded-full border border-white/15 px-3 py-1.5 text-xs disabled:opacity-50" disabled={isPending || !(sel[p.id])} onClick={() => correr(() => vincularEstudio(p.id, sel[p.id]), "Estudio vinculado.")}>Vincular</button>
                    <button className="rounded-full bg-lime px-4 py-1.5 text-xs font-semibold text-void disabled:opacity-50" disabled={isPending} onClick={() => correr(() => publicarProyecto(p.id), "¡Estudio en vivo!")}>Salir en vivo</button>
                  </div>
                )}
              </div>
              <ul className="mt-3 grid gap-1 sm:grid-cols-2">
                {p.etapas.map((e) => (
                  <li key={e.key} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={e.hecha} disabled={isPending || p.estado !== "en_curso"} onChange={(x) => correr(() => marcarEtapa(p.id, e.key, x.target.checked))} />
                    <span className={e.hecha ? "text-white/40 line-through" : ""}>{e.nombre}{!e.obligatoria && <span className="text-xs text-white/35"> (opcional)</span>}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
