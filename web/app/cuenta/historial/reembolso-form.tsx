"use client";

import { useState, useTransition } from "react";
import { pedirReembolso } from "./actions";

export default function ReembolsoForm({ membresiaId, monto }: { membresiaId: string; monto: number }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  if (msg?.ok) return <p className="mt-2 text-xs text-sage">{msg.texto}</p>;
  return (
    <div className="mt-2">
      {!abierto ? (
        <button className="text-xs text-ink/55 underline" onClick={() => setAbierto(true)}>Solicitar reembolso</button>
      ) : (
        <div className="grid gap-2">
          <input className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm" placeholder="Cuéntanos el motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <div className="flex items-center gap-3">
            <button className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-cream disabled:opacity-50" disabled={isPending || motivo.trim().length < 4}
              onClick={() => startTransition(async () => { const r = await pedirReembolso(membresiaId, monto, motivo); setMsg(r.error ? { ok: false, texto: r.error } : { ok: true, texto: "Solicitud enviada. El estudio te responderá." }); })}>Enviar solicitud</button>
            <button className="text-xs text-ink/55" onClick={() => setAbierto(false)}>Cancelar</button>
          </div>
          {msg && !msg.ok && <p className="text-xs text-ink">{msg.texto}</p>}
        </div>
      )}
    </div>
  );
}
