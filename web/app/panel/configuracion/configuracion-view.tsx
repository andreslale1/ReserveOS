"use client";

import { useState, useTransition } from "react";
import { guardarMarca } from "./actions";

const input =
  "mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none focus:border-ink/30";

export default function ConfiguracionView({
  tenantId,
  nombre: n0,
  slug,
  color: c0,
  logo: l0,
  dominios,
}: {
  tenantId: string;
  nombre: string;
  slug: string;
  color: string;
  logo: string;
  dominios: { domain: string; verified: boolean }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [nombre, setNombre] = useState(n0);
  const [color, setColor] = useState(c0);
  const [logo, setLogo] = useState(l0);

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <h1 className="font-serif text-2xl text-ink md:text-3xl">Configuración del estudio</h1>
        <p className="mt-1 text-sm text-ink/60">Nombre, marca y dominio</p>
      </header>
      <div className="mx-auto grid max-w-2xl gap-6 px-6 py-8 md:px-10">
        {msg && (
          <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-sage-tint text-sage" : "bg-peach-tint text-ink"}`}>{msg.texto}</p>
        )}
        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <div className="grid gap-3">
            <label className="text-sm text-ink/60">
              Nombre del estudio
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={input} />
            </label>
            <label className="text-sm text-ink/60">
              Color principal (ej. #E8B89B)
              <input value={color} onChange={(e) => setColor(e.target.value)} className={input} />
            </label>
            <label className="text-sm text-ink/60">
              Dirección (URL) del logo
              <input value={logo} onChange={(e) => setLogo(e.target.value)} className={input} />
            </label>
          </div>
          <button
            className="press-spring mt-4 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream disabled:opacity-50"
            disabled={isPending || !nombre.trim()}
            onClick={() => {
              setMsg(null);
              startTransition(async () => {
                const r = await guardarMarca(tenantId, nombre, color, logo);
                setMsg(r.error ? { ok: false, texto: r.error } : { ok: true, texto: "Guardado." });
              });
            }}
          >
            Guardar
          </button>
        </section>
        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-base font-semibold text-ink">Dirección web</h2>
          <p className="mt-2 text-sm text-ink/70">Identificador: {slug}</p>
          <ul className="mt-2 text-sm text-ink/70">
            {dominios.length === 0 && <li>Sin dominio propio conectado. Para conectarlo, contacta a ReserveOS.</li>}
            {dominios.map((d) => (
              <li key={d.domain}>
                {d.domain} · {d.verified ? "verificado" : "pendiente de verificar"}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
