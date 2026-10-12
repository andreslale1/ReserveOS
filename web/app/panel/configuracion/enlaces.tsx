"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

const caja = "mt-1 break-all rounded-lg bg-cream px-3 py-2 text-sm text-ink";

function Copiar({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="mt-1 text-xs text-ink/60 underline hover:text-ink" onClick={async () => { try { await navigator.clipboard.writeText(texto); setOk(true); setTimeout(() => setOk(false), 1500); } catch { /* sin portapapeles */ } }}>
      {ok ? "Copiado ✓" : "Copiar"}
    </button>
  );
}

export default function Enlaces({ baseUrl, slug, nombre, dominioActivo }: { baseUrl: string; slug: string; nombre: string; dominioActivo: string | null }) {
  // Si el estudio tiene dominio propio verificado, ese es su enlace principal.
  const raiz = dominioActivo ? `https://${dominioActivo}` : baseUrl;
  const publico = dominioActivo ? raiz : `${baseUrl}/e/${slug}`;
  const registro = `${baseUrl}/registro/${slug}?next=${encodeURIComponent("/cuenta/clases")}`;
  const reservar = `${baseUrl}/login?e=${slug}&next=${encodeURIComponent("/cuenta/clases")}`;
  const prueba = `${baseUrl}/e/${slug}/prueba`;
  const [qr, setQr] = useState("");
  const mensaje = `¡Hola! Reserva tus clases en ${nombre} desde aquí 👉 ${publico}`;

  useEffect(() => { QRCode.toDataURL(publico, { width: 512, margin: 2 }).then(setQr).catch(() => setQr("")); }, [publico]);

  return (
    <section className="rounded-2xl border border-white/10 bg-card p-5" aria-labelledby="enl-t">
      <h2 id="enl-t" className="text-base font-semibold text-ink">Enlaces para compartir</h2>
      <p className="mt-1 text-sm text-ink/65">Tu página pública con horarios, paquetes y botón de reserva. Úsala en WhatsApp, Instagram, Google y tu web.</p>

      <p className="mt-4 text-sm font-medium text-ink">Tu página</p><p className={caja}>{publico}</p><Copiar texto={publico} />
      <div className="mt-3 grid gap-2 text-sm">
        <div><span className="text-ink/60">Crear cuenta (para clientas nuevas):</span><p className={caja}>{registro}</p><Copiar texto={registro} /></div>
        <div><span className="text-ink/60">Entrar a reservar (clientas con cuenta):</span><p className={caja}>{reservar}</p><Copiar texto={reservar} /></div>
        <div><span className="text-ink/60">Clase de prueba:</span><p className={caja}>{prueba}</p><Copiar texto={prueba} /></div>
      </div>

      <div className="mt-5 grid items-start gap-4 sm:grid-cols-[auto_1fr]">
        <div>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={`Código QR de ${publico}`} width={160} height={160} className="rounded-lg bg-white p-2" />
          ) : <div className="h-40 w-40 rounded-lg bg-cream" aria-hidden />}
          {qr && <a href={qr} download={`qr-${slug}.png`} className="mt-1 block text-xs text-ink/60 underline hover:text-ink">Descargar QR (PNG)</a>}
        </div>
        <div className="text-sm text-ink/70">
          <p className="font-medium text-ink">Para WhatsApp Business</p>
          <p className="mt-1">Pon el enlace en el perfil (Herramientas del negocio → Enlaces) y esta respuesta rápida:</p>
          <p className="mt-2 whitespace-pre-line rounded-lg bg-cream px-3 py-2 text-ink">{mensaje}</p><Copiar texto={mensaje} />
        </div>
      </div>

      <div className="mt-5 border-t border-white/10 pt-4 text-sm text-ink/70">
        <p className="font-medium text-ink">En tu web actual</p>
        <p className="mt-1">Un botón que lleve a tus clientas a tu estudio (sin perder el contexto):</p>
        <pre className="mt-1 overflow-x-auto rounded-lg bg-cream px-3 py-2 text-xs text-ink">{`<a href="${reservar}">Reservar mi clase</a>`}</pre>
        <p className="mt-3">Para mostrar tus horarios y paquetes dentro de tu web (los botones abren el registro y el login en la ventana completa):</p>
        <pre className="mt-1 overflow-x-auto rounded-lg bg-cream px-3 py-2 text-xs text-ink">{`<iframe src="${baseUrl}/e/${slug}" title="Reservas ${nombre}" width="100%" height="1000" style="border:0" loading="lazy"></iframe>`}</pre>
        <p className="mt-2 text-xs text-ink/55">Solo esta página se puede incrustar; el login, la cuenta y el panel están protegidos contra incrustación.</p>
      </div>
    </section>
  );
}
