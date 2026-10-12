"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmarReserva } from "./clases/actions";

// «Confirmo que voy»: si la clase se llena y no confirmas, tu lugar puede pasar a la lista de espera.
export default function ConfirmarReserva({ reservaId }: { reservaId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="mt-2 flex flex-wrap items-center gap-2">
      <button
        className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-cream disabled:opacity-50" disabled={isPending}
        onClick={() => { setError(null); startTransition(async () => { const r = await confirmarReserva(reservaId); if (r.error) setError(r.error); else router.refresh(); }); }}
      >{isPending ? "Confirmando…" : "Confirmo que voy"}</button>
      <span className="text-xs text-ink/55">Confirma para conservar tu lugar si la clase se llena.</span>
      {error && <span role="alert" className="w-full text-xs text-ink">{error}</span>}
    </span>
  );
}
