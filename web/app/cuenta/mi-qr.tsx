"use client";

import { useState, useTransition } from "react";
import { renovarCodigo } from "./actions";

export default function MiQr({ tenantId, imagen, codigo }: { tenantId: string; imagen: string; codigo: string }) {
  const [abierto, setAbierto] = useState(false);
  const [img, setImg] = useState(imagen);
  const [cod, setCod] = useState(codigo);
  const [isPending, startTransition] = useTransition();
  return (
    <div className="mt-3">
      <button className="w-full rounded-full border border-black/15 px-4 py-2.5 text-sm font-medium text-ink" onClick={() => setAbierto(!abierto)}>{abierto ? "Ocultar mi código QR" : "Mostrar mi código QR"}</button>
      {abierto && (
        <div className="mt-3 flex flex-col items-center rounded-2xl bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt="Mi código de check-in" width={220} height={220} />
          <p className="mt-2 font-mono text-sm tracking-widest text-ink">{cod}</p>
          <p className="mt-1 text-center text-xs text-ink/55">Muéstralo en recepción al llegar. Es personal: si lo compartiste, renuévalo.</p>
          <button className="mt-2 text-xs text-ink/55 underline" disabled={isPending} onClick={() => startTransition(async () => { const r = await renovarCodigo(tenantId); if (r) { setImg(r.imagen); setCod(r.codigo); } })}>Renovar código</button>
        </div>
      )}
    </div>
  );
}
