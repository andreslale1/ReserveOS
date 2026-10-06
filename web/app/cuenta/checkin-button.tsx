"use client";

import { useState, useTransition } from "react";
import { hacerCheckin } from "./actions";

export default function CheckinButton() {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  return (
    <div className="mt-3">
      <button className="w-full rounded-full border border-black/15 px-4 py-2.5 text-sm font-medium text-ink disabled:opacity-50" disabled={isPending}
        onClick={() => { setMsg(null); startTransition(async () => { const r = await hacerCheckin(); setMsg(r.error ? { ok: false, texto: r.error } : { ok: true, texto: `¡Listo! Marcamos tu llegada a ${r.clase}.` }); }); }}>
        Ya llegué (check-in)
      </button>
      {msg && <p className={`mt-2 rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-sage-tint text-sage" : "bg-peach-tint text-ink"}`}>{msg.texto}</p>}
    </div>
  );
}
