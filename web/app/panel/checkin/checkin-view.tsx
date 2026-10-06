"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { registrarCheckin } from "./actions";

type BarcodeDetectorLike = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
declare global { interface Window { BarcodeDetector?: new (o: { formats: string[] }) => BarcodeDetectorLike } }

export default function CheckinView({ tenantId }: { tenantId: string }) {
  const [codigo, setCodigo] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [camara, setCamara] = useState(false);
  const [isPending, startTransition] = useTransition();
  const video = useRef<HTMLVideoElement>(null);
  const ocupado = useRef(false);
  const soportaCamara = typeof window !== "undefined" && !!window.BarcodeDetector && !!navigator.mediaDevices;

  function enviar(c: string) {
    if (ocupado.current || !c.trim()) return;
    ocupado.current = true;
    setMsg(null);
    startTransition(async () => {
      const r = await registrarCheckin(tenantId, c);
      if (r.error) setMsg({ ok: false, texto: r.error });
      else if (r.resultado) setMsg({ ok: true, texto: r.resultado.ya_registrada ? `${r.resultado.cliente} ya estaba registrada en ${r.resultado.clase}.` : `✓ ${r.resultado.cliente} · ${r.resultado.clase} (${String(r.resultado.hora).slice(0, 5)})` });
      setCodigo("");
      setTimeout(() => { ocupado.current = false; }, 2500);
    });
  }

  useEffect(() => {
    if (!camara) return;
    let stop = false; let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (video.current) { video.current.srcObject = stream; await video.current.play(); }
        const det = new window.BarcodeDetector!({ formats: ["qr_code"] });
        const ciclo = async () => {
          if (stop || !video.current) return;
          try { const r = await det.detect(video.current); if (r[0]) enviar(r[0].rawValue); } catch {}
          setTimeout(ciclo, 400);
        };
        ciclo();
      } catch { setMsg({ ok: false, texto: "No se pudo abrir la cámara. Escribe el código a mano." }); setCamara(false); }
    })();
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camara]);

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <h1 className="font-serif text-2xl text-ink md:text-3xl">Check-in</h1>
        <p className="mt-1 text-sm text-ink/60">Escanea el QR de la clienta o escribe su código. Marca su asistencia a la clase de ahora.</p>
      </header>
      <div className="mx-auto grid max-w-md gap-4 px-6 py-8">
        {msg && <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-sage-tint text-sage" : "bg-peach-tint text-ink"}`}>{msg.texto}</p>}
        {soportaCamara && (
          <button className="press-spring rounded-full bg-ink px-5 py-3 text-sm font-medium text-cream" onClick={() => setCamara(!camara)}>{camara ? "Cerrar cámara" : "Escanear con la cámara"}</button>
        )}
        {camara && <video ref={video} className="w-full rounded-2xl bg-black" muted playsInline />}
        <div className="rounded-2xl border border-white/10 bg-card p-5">
          <label className="text-sm text-ink/60">Código de la clienta
            <input className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 font-mono uppercase tracking-widest text-ink outline-none focus:border-ink/30" value={codigo} onChange={(e) => setCodigo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && enviar(codigo)} placeholder="A1B2C3D4E5" />
          </label>
          <button className="press-spring mt-3 rounded-full border border-white/20 px-4 py-2 text-sm text-ink disabled:opacity-50" disabled={isPending || codigo.trim().length < 4} onClick={() => enviar(codigo)}>Registrar llegada</button>
        </div>
        {!soportaCamara && <p className="text-xs text-ink/50">Este navegador no puede leer QR con la cámara; usa el campo de arriba o abre esta página en Chrome.</p>}
      </div>
    </main>
  );
}
