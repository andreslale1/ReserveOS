"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearEstudio } from "./actions";
import { ESTADOS, ESTADO_LABEL, EstadoModal } from "./estado-modal";

type Tenant = {
  id: string;
  slug: string;
  name: string;
  status: string;
  tipo: string;
  created_at: string;
  num_sedes: number;
  num_staff: number;
  clientas_registradas: number;
  clientas_con_acceso: number;
  estado_motivo: string | null;
};

const TIPO_LABEL: Record<string, string> = { demo: "Demo", interno: "Interno / prueba" };

export default function OwnerView({ tenants: todos }: { tenants: Tenant[] }) {
  const router = useRouter();
  const [incluirPruebas, setIncluirPruebas] = useState(false);
  const [cambio, setCambio] = useState<{ id: string; name: string; destino: string } | null>(null);
  const tenants = incluirPruebas ? todos : todos.filter((t) => (t.tipo ?? "cliente") === "cliente");
  const ocultos = todos.length - tenants.length;
  const [mostrarForm, setMostrarForm] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sedeNombre, setSedeNombre] = useState("Sede Principal");
  const [duenaEmail, setDuenaEmail] = useState("");
  const [duenaNombre, setDuenaNombre] = useState("");
  const [isPending, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [invLink, setInvLink] = useState<string | null>(null);

  function crear() {
    setMensaje(null);
    startTransition(async () => {
      const res = await crearEstudio({
        slug,
        name,
        sedeNombre,
        timezone: "America/Guatemala",
        duenaEmail,
        duenaNombre,
      });
      if (res.error) {
        setMensaje(`Error: ${res.error}`);
      } else if (res.token) {
        setInvLink(`${window.location.origin}/invitar/personal/${res.token}`);
      }
    });
  }

  function nuevoEstudio() {
    setName("");
    setSlug("");
    setSedeNombre("Sede Principal");
    setDuenaEmail("");
    setDuenaNombre("");
    setInvLink(null);
    setMensaje(null);
    setMostrarForm(false);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 md:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-white md:text-3xl">
            Estudios
          </h1>
          <p className="mt-1 text-sm text-white/50">
            {tenants.length} estudio{tenants.length === 1 ? "" : "s"} en la
            plataforma.
          </p>
          <label className="mt-2 flex items-center gap-2 text-xs text-white/60">
            <input type="checkbox" checked={incluirPruebas} onChange={(e) => setIncluirPruebas(e.target.checked)} />
            Incluir pruebas (demo e internos){!incluirPruebas && ocultos > 0 ? ` — ${ocultos} oculto${ocultos === 1 ? "" : "s"}` : ""}
          </label>
        </div>
        <button
          onClick={() => (mostrarForm ? nuevoEstudio() : setMostrarForm(true))}
          className="press-spring rounded-full bg-lime px-5 py-2 text-sm font-bold uppercase tracking-wide text-void"
        >
          {mostrarForm ? "Cancelar" : "+ Nuevo estudio"}
        </button>
      </div>

      {mostrarForm && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-void-card p-5">
          {invLink ? (
            <div>
              <p className="text-sm font-medium text-white">
                Estudio creado — mandale este link a la dueña:
              </p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  readOnly
                  value={invLink}
                  onFocus={(e) => e.target.select()}
                  className="w-full rounded-lg border border-white/15 bg-void px-3 py-2 text-xs text-white"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(invLink)}
                  className="shrink-0 rounded-full border border-white/15 px-3 py-2 text-xs text-white/60 hover:text-white"
                >
                  Copiar
                </button>
              </div>
              <button
                onClick={nuevoEstudio}
                className="mt-4 text-xs text-white/50 underline"
              >
                Crear otro estudio
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="text-sm text-white/60">
                Nombre del estudio
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VIM Pilates"
                  className="mt-1 w-full rounded-lg border border-white/15 bg-void px-3 py-2 text-white outline-none focus:border-lime/50"
                />
              </label>
              <label className="text-sm text-white/60">
                Slug
                <input
                  type="text"
                  value={slug}
                  onChange={(e) =>
                    setSlug(
                      e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                    )
                  }
                  placeholder="vim-pilates"
                  className="mt-1 w-full rounded-lg border border-white/15 bg-void px-3 py-2 text-white outline-none focus:border-lime/50"
                />
              </label>
              <label className="text-sm text-white/60">
                Primera sede
                <input
                  type="text"
                  value={sedeNombre}
                  onChange={(e) => setSedeNombre(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-void px-3 py-2 text-white outline-none focus:border-lime/50"
                />
              </label>
              <label className="text-sm text-white/60">
                Nombre de la dueña
                <input
                  type="text"
                  value={duenaNombre}
                  onChange={(e) => setDuenaNombre(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-void px-3 py-2 text-white outline-none focus:border-lime/50"
                />
              </label>
              <label className="text-sm text-white/60 sm:col-span-2">
                Correo de la dueña
                <input
                  type="email"
                  value={duenaEmail}
                  onChange={(e) => setDuenaEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-void px-3 py-2 text-white outline-none focus:border-lime/50"
                />
              </label>
              <div className="sm:col-span-3">
                <button
                  onClick={crear}
                  disabled={
                    isPending || !name || !slug || !duenaEmail || !duenaNombre
                  }
                  className="press-spring rounded-full bg-white px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-void disabled:opacity-50"
                >
                  {isPending ? "Creando…" : "Crear estudio"}
                </button>
                {mensaje && (
                  <span className="ml-4 text-sm text-white/50">
                    {mensaje}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <ul className="mt-8 space-y-2">
        {tenants.map((t) => {
          const estado = ESTADO_LABEL[t.status] ?? ESTADO_LABEL.cancelado;
          const otros = ESTADOS.filter((e) => e !== t.status);
          return (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-void-card p-5"
            >
              <Link href={`/owner/${t.id}`} className="group">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white group-hover:underline">
                    {t.name}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${estado.className}`}
                  >
                    {estado.label}
                  </span>
                  {t.tipo !== "cliente" && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/60">{TIPO_LABEL[t.tipo] ?? t.tipo}</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-white/40">
                  {t.slug} · {t.num_sedes} sede{t.num_sedes === 1 ? "" : "s"} ·{" "}
                  {t.num_staff} staff · {t.clientas_con_acceso} clientas con acceso · {t.clientas_registradas} registradas
                </p>
              </Link>
              <label className="flex items-center gap-2 text-xs text-white/50">
                Cambiar estado
                <select
                  value=""
                  onChange={(e) => e.target.value && setCambio({ id: t.id, name: t.name, destino: e.target.value })}
                  className="rounded-full border border-white/15 bg-void px-3 py-1 text-xs text-white/80"
                >
                  <option value="">Elegir…</option>
                  {otros.map((e) => (
                    <option key={e} value={e}>{ESTADO_LABEL[e].label}</option>
                  ))}
                </select>
              </label>
            </li>
          );
        })}
        {tenants.length === 0 && (
          <li className="rounded-2xl border border-dashed border-white/15 bg-void-card p-8 text-center text-sm text-white/40">
            No hay estudios todavía.
          </li>
        )}
      </ul>
      {cambio && (
        <EstadoModal tenant={cambio} destino={cambio.destino} onClose={() => setCambio(null)} onDone={() => router.refresh()} />
      )}
    </main>
  );
}
