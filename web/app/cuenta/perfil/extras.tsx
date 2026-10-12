"use client";

import { useState, useTransition } from "react";
import { marcarComunicadoVisto } from "./actions";

const card = "rounded-2xl border border-white/10 bg-card p-5";
export type Aviso = { id: string; titulo: string; mensaje: string; creado: string; visto: boolean };

export function Avisos({ avisos }: { avisos: Aviso[] }) {
  const [vistos, setVistos] = useState(new Set(avisos.filter((a) => a.visto).map((a) => a.id)));
  const [, startTransition] = useTransition();
  if (avisos.length === 0) return null;
  return (
    <section className={card} aria-labelledby="avisos-t">
      <h2 id="avisos-t" className="text-sm font-semibold uppercase tracking-wide text-ink/50">Avisos del estudio</h2>
      <ul className="mt-3 divide-y divide-white/10">
        {avisos.map((a) => (
          <li key={a.id} className="py-3">
            <p className="text-sm font-medium text-ink">{!vistos.has(a.id) && <span className="mr-2 rounded-full bg-peach-tint px-2 py-0.5 text-[10px] font-semibold uppercase">Nuevo</span>}{a.titulo}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-ink/70">{a.mensaje}</p>
            <p className="mt-1 text-xs text-ink/45">{new Date(a.creado).toLocaleDateString("es-GT", { day: "numeric", month: "long", timeZone: "America/Guatemala" })}</p>
            {!vistos.has(a.id) && (
              <button className="mt-1 text-xs text-ink/60 underline" onClick={() => startTransition(async () => { await marcarComunicadoVisto(a.id); setVistos(new Set([...vistos, a.id])); })}>Marcar como leído</button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function InvitarYGanar({ enlace, codigo, referidas, estudio }: { enlace: string; codigo: string; referidas: number; estudio: string }) {
  const [copiado, setCopiado] = useState(false);
  const texto = `Te invito a ${estudio}. Crea tu cuenta con mi enlace y reserva tu clase: ${enlace}`;
  return (
    <section className={card} aria-labelledby="inv-t">
      <h2 id="inv-t" className="text-sm font-semibold uppercase tracking-wide text-ink/50">Invitar y ganar</h2>
      <p className="mt-2 text-sm text-ink/70">Comparte tu enlace. Cuando una amiga se registre con él y compre su primer paquete, ganas un bono en clases.</p>
      <p className="mt-3 break-all rounded-lg bg-cream px-3 py-2 text-sm text-ink">{enlace}</p>
      <p className="mt-1 text-xs text-ink/50">Tu código: <span className="font-mono">{codigo}</span> · Amigas que ya compraron: <strong>{referidas}</strong></p>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <button className="rounded-full border border-white/15 px-4 py-2 font-medium text-ink" onClick={async () => { try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 1500); } catch { /* sin portapapeles */ } }}>{copiado ? "Copiado ✓" : "Copiar mensaje"}</button>
        <a className="rounded-full bg-ink px-4 py-2 font-medium text-cream" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer">Compartir por WhatsApp</a>
      </div>
    </section>
  );
}
