"use client";

import { useState, useTransition } from "react";
import { guardarMarca, guardarReglas, quitarDominio, solicitarDominio } from "./actions";

const input =
  "mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none focus:border-ink/30";

export default function ConfiguracionView({
  tenantId,
  nombre: n0,
  slug,
  baseUrl,
  color: c0,
  logo: l0,
  dominios,
  reglas,
}: {
  tenantId: string;
  nombre: string;
  slug: string;
  baseUrl: string;
  color: string;
  logo: string;
  dominios: { id: string; domain: string; verified: boolean }[];
  reglas: { horasCancelacion: number; horasConfirmacion: number; devuelveCredito: boolean; anticipacionDias: number; maxPorDia: number | null };
}) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [nombre, setNombre] = useState(n0);
  const [color, setColor] = useState(c0);
  const [logo, setLogo] = useState(l0);
  const [dom, setDom] = useState("");
  const [r, setR] = useState({ ...reglas, maxPorDia: reglas.maxPorDia === null ? "" : String(reglas.maxPorDia) });

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
          <h2 className="text-base font-semibold text-ink">Reglas de reserva</h2>
          <p className="mt-1 text-sm text-ink/60">Aplican a todas tus sedes y a todas tus clientas.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-ink/60">Horas mínimas para cancelar sin penalización
              <input type="number" min={0} max={72} className={input} value={r.horasCancelacion} onChange={(e) => setR({ ...r, horasCancelacion: Number(e.target.value) })} /></label>
            <label className="text-sm text-ink/60">Horas antes de la clase para pedir confirmación
              <input type="number" min={0} max={24} className={input} value={r.horasConfirmacion} onChange={(e) => setR({ ...r, horasConfirmacion: Number(e.target.value) })} /></label>
            <label className="text-sm text-ink/60">Días máximos de anticipación para reservar
              <input type="number" min={1} max={365} className={input} value={r.anticipacionDias} onChange={(e) => setR({ ...r, anticipacionDias: Number(e.target.value) })} /></label>
            <label className="text-sm text-ink/60">Máximo de clases por día por clienta (vacío = sin límite)
              <input type="number" min={1} className={input} value={r.maxPorDia} onChange={(e) => setR({ ...r, maxPorDia: e.target.value })} /></label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={r.devuelveCredito} onChange={(e) => setR({ ...r, devuelveCredito: e.target.checked })} /> Devolver la clase aunque cancele tarde</label>
          <button className="press-spring mt-4 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream disabled:opacity-50" disabled={isPending}
            onClick={() => { setMsg(null); startTransition(async () => { const x = await guardarReglas(tenantId, { horasCancelacion: r.horasCancelacion, horasConfirmacion: r.horasConfirmacion, devuelveCredito: r.devuelveCredito, anticipacionDias: r.anticipacionDias, maxPorDia: r.maxPorDia === "" ? null : Number(r.maxPorDia) }); setMsg(x.error ? { ok: false, texto: x.error } : { ok: true, texto: "Reglas guardadas." }); }); }}>Guardar reglas</button>
        </section>
        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-base font-semibold text-ink">Conectar con la web de tu estudio</h2>
          <p className="mt-2 text-sm text-ink/70">Tu página pública con horarios y botón de reserva:</p>
          <p className="mt-1 break-all rounded-lg bg-cream px-3 py-2 text-sm text-ink">{baseUrl}/e/{slug}</p>
          <p className="mt-4 text-sm text-ink/70">Para mostrar el horario dentro de tu web, pega este código:</p>
          <pre className="mt-1 overflow-x-auto rounded-lg bg-cream px-3 py-2 text-xs text-ink">{`<iframe src="${baseUrl}/e/${slug}" width="100%" height="900" style="border:0"></iframe>`}</pre>
          <p className="mt-4 text-sm text-ink/70">O solo un botón que lleve a tus clientas a reservar:</p>
          <pre className="mt-1 overflow-x-auto rounded-lg bg-cream px-3 py-2 text-xs text-ink">{`<a href="${baseUrl}/login?next=/reservar">Reservar mi clase</a>`}</pre>
        </section>
        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-base font-semibold text-ink">Tu propio dominio</h2>
          <p className="mt-1 text-sm text-ink/65">Identificador: <strong>{slug}</strong>. Tus clientas pueden entrar desde, por ejemplo, <em>reservas.tuestudio.com</em>.</p>
          <ul className="mt-3 divide-y divide-white/10">
            {dominios.length === 0 && <li className="py-2 text-sm text-ink/55">Aún no has solicitado un dominio.</li>}
            {dominios.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-ink">{d.domain} <span className={d.verified ? "text-sage" : "text-ink/50"}>· {d.verified ? "activo" : "pendiente de activar"}</span></span>
                <button className="text-xs text-ink/50 hover:text-ink" disabled={isPending} onClick={() => { setMsg(null); startTransition(async () => { const r = await quitarDominio(d.id); setMsg(r.error ? { ok: false, texto: r.error } : { ok: true, texto: "Dominio quitado." }); }); }}>Quitar</button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <input className={`${input} mt-0 flex-1`} placeholder="reservas.tuestudio.com" value={dom} onChange={(e) => setDom(e.target.value)} />
            <button className="press-spring rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream disabled:opacity-50" disabled={isPending || dom.trim().length < 4}
              onClick={() => { setMsg(null); startTransition(async () => { const r = await solicitarDominio(tenantId, dom); setMsg(r.error ? { ok: false, texto: r.error } : { ok: true, texto: "Solicitud enviada. En tu proveedor de dominio crea un registro CNAME hacia cname.vercel-dns.com; ReserveOS lo activa cuando lo verifique." }); if (!r.error) setDom(""); }); }}>Solicitar</button>
          </div>
        </section>
      </div>
    </main>
  );
}
