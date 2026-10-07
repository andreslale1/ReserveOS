"use client";

import { useState, useTransition } from "react";
import { verificarAhora } from "./actions";

export default function VerificarBoton() {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  return (
    <div className="flex items-center gap-3">
      <button className="rounded-full bg-lime px-4 py-2 text-sm font-semibold text-void disabled:opacity-50" disabled={isPending}
        onClick={() => { setMsg(null); startTransition(async () => { const r = await verificarAhora(); setMsg(r.error ? { ok: false, texto: r.error } : { ok: true, texto: "Verificación guardada." }); }); }}>
        {isPending ? "Verificando…" : "Verificar ahora"}
      </button>
      <span role="status" aria-live="polite" className={`text-xs ${msg?.ok ? "text-lime" : "text-red-300"}`}>{msg?.texto}</span>
    </div>
  );
}
