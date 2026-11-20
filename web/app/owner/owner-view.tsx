"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearEstudio } from "./actions";
import { BarrasH, Distribucion, type Tono } from "@/components/graficas/graficas";
import { LISTA_GIROS } from "@/lib/giros";
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
  // Si todavía no hay ningún estudio cliente, se muestran las pruebas: la primera pantalla del owner no debe estar vacía.
  const [incluirPruebas, setIncluirPruebas] = useState(() => !todos.some((t) => (t.tipo ?? "cliente") === "cliente"));
  const [cambio, setCambio] = useState<{ id: string; name: string; destino: string } | null>(null);
  const tenants = incluirPruebas ? todos : todos.filter((t) => (t.tipo ?? "cliente") === "cliente");
  const ocultos = todos.length - tenants.length;
  const [mostrarForm, setMostrarForm] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sedeNombre, setSedeNombre] = useState("Sede Principal");
  const [duenaEmail, setDuenaEmail] = useState("");
  const [duenaNombre, setDuenaNombre] = useState("");
  const [giro, setGiro] = useState("pilates");
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
        giro,
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
    setGiro("pilates");
    setInvLink(null);
    setMensaje(null);
    setMostrarForm(false);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 md:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-ink md:text-3xl">
            Estudios
          </h1>
          <p className="mt-1 text-sm text-ink/50">
            {tenants.length} estudio{tenants.length === 1 ? "" : "s"} en la
            plataforma.
          </p>
          <label className="mt-2 flex items-center gap-2 text-xs text-ink/60">
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
        <div className="mt-6 rounded-2xl border border-ink/10 bg-void-card p-5">
          {invLink ? (
            <div>
              <p className="text-sm font-medium text-ink">
                Estudio creado — mandale este link a la dueña:
              </p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  readOnly
                  value={invLink}
                  onFocus={(e) => e.target.select()}
                  className="w-full rounded-lg border border-ink/15 bg-void px-3 py-2 text-xs text-ink"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(invLink)}
                  className="shrink-0 rounded-full border border-ink/15 px-3 py-2 text-xs text-ink/60 hover:text-ink"
                >
                  Copiar
                </button>
              </div>
              <button
                onClick={nuevoEstudio}
                className="mt-4 text-xs text-ink/50 underline"
              >
                Crear otro estudio
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="text-sm text-ink/60 sm:col-span-3">
                Giro del negocio
                <select value={giro} onChange={(e) => setGiro(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-void px-3 py-2 text-ink">
                  {LISTA_GIROS.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                </select>
              </label>
              <label className="text-sm text-ink/60">
                Nombre del estudio
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VIM Pilates"
                  className="mt-1 w-full rounded-lg border border-ink/15 bg-void px-3 py-2 text-ink outline-none focus:border-lime/50"
                />
              </label>
              <label className="text-sm text-ink/60">
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
                  className="mt-1 w-full rounded-lg border border-ink/15 bg-void px-3 py-2 text-ink outline-none focus:border-lime/50"
                />
              </label>
              <label className="text-sm text-ink/60">
                Primera sede
                <input
                  type="text"
                  value={sedeNombre}
                  onChange={(e) => setSedeNombre(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-ink/15 bg-void px-3 py-2 text-ink outline-none focus:border-lime/50"
                />
              </label>
              <label className="text-sm text-ink/60">
                Nombre de la dueña
                <input
                  type="text"
                  value={duenaNombre}
                  onChange={(e) => setDuenaNombre(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-ink/15 bg-void px-3 py-2 text-ink outline-none focus:border-lime/50"
                />
              </label>
              <label className="text-sm text-ink/60 sm:col-span-2">
                Correo de la dueña
                <input
                  type="email"
                  value={duenaEmail}
                  onChange={(e) => setDuenaEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-ink/15 bg-void px-3 py-2 text-ink outline-none focus:border-lime/50"
                />
              </label>
              <div className="sm:col-span-3">
                <button
                  onClick={crear}
                  disabled={
                    isPending || !name || !slug || !duenaEmail || !duenaNombre
                  }
                  className="press-spring rounded-full bg-ink px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-void disabled:opacity-50"
                >
                  {isPending ? "Creando…" : "Crear estudio"}
                </button>
                {mensaje && (
                  <span className="ml-4 text-sm text-ink/50">
                    {mensaje}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tenants.length > 0 && (() => {
        const TONO: Record<string, Tono> = { activo: "bueno", en_implantacion: "marca", borrador: "gris", pausado: "aviso", suspendido: "malo", cancelado: "gris" };
        const partes = ESTADOS.map((e) => ({ nombre: ESTADO_LABEL[e]?.label ?? e, valor: tenants.filter((t) => t.status === e).length, tono: TONO[e] ?? "gris" }));
        const clientas = [...tenants].sort((a, b) => b.clientas_registradas - a.clientas_registradas).slice(0, 6).map((t) => ({ nombre: t.name, valor: t.clientas_registradas, texto: `${t.clientas_registradas} · ${t.clientas_con_acceso} con acceso` }));
        return (
          <section aria-label="Resumen de estudios" className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="border border-ink/15 bg-void-card p-5 lg:col-span-2"><h2 className="mb-4 text-[10px] font-medium uppercase tracking-[0.12em] text-ink/60">Estudios por estado · {tenants.length}</h2><Distribucion partes={partes} /></div>
            <div className="border border-ink/15 bg-void-card p-5"><h2 className="mb-4 text-[10px] font-medium uppercase tracking-[0.12em] text-ink/60">Clientas por estudio</h2><BarrasH filas={clientas} vacio="Aún no hay clientas." /></div>
          </section>
        );
      })()}

      <ul className="mt-8 space-y-2">
        {tenants.map((t) => {
          const estado = ESTADO_LABEL[t.status] ?? ESTADO_LABEL.cancelado;
          const otros = ESTADOS.filter((e) => e !== t.status);
          return (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-void-card p-5"
            >
              <Link href={`/owner/${t.id}`} className="group">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink group-hover:underline">
                    {t.name}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${estado.className}`}
                  >
                    {estado.label}
                  </span>
                  {t.tipo !== "cliente" && (
                    <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[11px] text-ink/60">{TIPO_LABEL[t.tipo] ?? t.tipo}</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-ink/40">
                  {t.slug} · {t.num_sedes} sede{t.num_sedes === 1 ? "" : "s"} ·{" "}
                  {t.num_staff} staff · {t.clientas_con_acceso} clientas con acceso · {t.clientas_registradas} registradas
                </p>
              </Link>
              <label className="flex items-center gap-2 text-xs text-ink/50">
                Cambiar estado
                <select
                  value=""
                  onChange={(e) => e.target.value && setCambio({ id: t.id, name: t.name, destino: e.target.value })}
                  className="rounded-full border border-ink/15 bg-void px-3 py-1 text-xs text-ink/80"
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
          <li className="rounded-2xl border border-dashed border-ink/15 bg-void-card p-8 text-center text-sm text-ink/40">
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
