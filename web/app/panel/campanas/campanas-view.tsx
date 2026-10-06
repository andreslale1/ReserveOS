"use client";

import { useState, useTransition } from "react";
import { cancelarCampana, crearSegmento, enviarCampana, guardarPlantilla } from "./actions";

export type Campana = { id: string; nombre: string; segmento: string; plantilla: string; canal: string; estado: string; programada_para: string | null; encolados: number; omitidos_consentimiento: number; omitidos_sin_destino: number; enviados: number; pendientes: number; fallidos: number; created_at: string };
export type Segmento = { id: string; nombre: string; criterio: { tipo: string; dias?: number }; personas: number; con_consentimiento: number };
export type Plantilla = { id: string; clave: string; nombre: string; canal: string; tipo: string; asunto: string | null; cuerpo: string; activa: boolean };
export type Resumen = { pendientes: number; enviados: number; fallidos: number; email_conectado: boolean; whatsapp_conectado: boolean };

const TIPOS: Record<string, string> = { todas: "Todas las clientas", inactivas: "Sin venir hace N días", por_vencer: "Paquete por vencer en N días", sin_paquete: "Sin paquete activo", nuevas: "Nuevas (últimos N días)", cumple_mes: "Cumplen años este mes" };
const input = "mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none focus:border-ink/30";
const describe = (c: { tipo: string; dias?: number }) => (TIPOS[c.tipo] ?? c.tipo).replace("N", String(c.dias ?? ""));

export default function CampanasView({ tenantId, campanas, segmentos, plantillas, resumen }: { tenantId: string; campanas: Campana[]; segmentos: Segmento[]; plantillas: Plantilla[]; resumen: Resumen }) {
  const [tab, setTab] = useState<"campanas" | "segmentos" | "plantillas">("campanas");
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [c, setC] = useState({ nombre: "", segmento: "", plantilla: "", programada: "" });
  const [s, setS] = useState({ nombre: "", tipo: "inactivas", dias: "30" });
  const [p, setP] = useState({ id: null as string | null, nombre: "", canal: "email", asunto: "", cuerpo: "" });
  const mkt = plantillas.filter((x) => x.tipo === "marketing" && x.activa);
  const conectado = resumen.email_conectado || resumen.whatsapp_conectado;

  function correr(fn: () => Promise<{ error: string | null }>, ok: string, despues?: () => void) {
    setMsg(null);
    startTransition(async () => { const r = await fn(); if (r.error) setMsg({ ok: false, texto: r.error }); else { setMsg({ ok: true, texto: ok }); despues?.(); } });
  }
  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <h1 className="font-serif text-2xl text-ink md:text-3xl">Campañas y mensajes</h1>
        <p className="mt-1 text-sm text-ink/60">Escribe a tus clientas con su consentimiento. Los avisos de reserva y de paquete por vencer salen solos.</p>
        <div className="mt-4 flex gap-2 text-sm">
          {(["campanas", "segmentos", "plantillas"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 ${tab === t ? "bg-ink text-cream" : "border border-white/15 text-ink/70"}`}>{t === "campanas" ? "Campañas" : t === "segmentos" ? "Segmentos" : "Plantillas"}</button>)}
        </div>
      </header>
      <div className="mx-auto grid max-w-4xl gap-6 px-6 py-8 md:px-10">
        {!conectado && (
          <p className="rounded-xl bg-peach-tint px-4 py-3 text-sm text-ink">Todavía no hay un proveedor de correo o WhatsApp conectado. Tus mensajes se guardan en cola ({resumen.pendientes} pendientes) y salen cuando se conecte uno.</p>
        )}
        {msg && <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-sage-tint text-sage" : "bg-peach-tint text-ink"}`}>{msg.texto}</p>}

        {tab === "campanas" && (<>
          <section className="rounded-2xl border border-white/10 bg-card p-5">
            <h2 className="text-base font-semibold text-ink">Nueva campaña</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-ink/60">Nombre<input className={input} value={c.nombre} onChange={(e) => setC({ ...c, nombre: e.target.value })} /></label>
              <label className="text-sm text-ink/60">Programar para (opcional)<input type="datetime-local" className={input} value={c.programada} onChange={(e) => setC({ ...c, programada: e.target.value })} /></label>
              <label className="text-sm text-ink/60">A quién<select className={input} value={c.segmento} onChange={(e) => setC({ ...c, segmento: e.target.value })}><option value="">Elige un segmento…</option>{segmentos.map((x) => <option key={x.id} value={x.id}>{x.nombre} · {x.con_consentimiento} de {x.personas} con consentimiento</option>)}</select></label>
              <label className="text-sm text-ink/60">Mensaje<select className={input} value={c.plantilla} onChange={(e) => setC({ ...c, plantilla: e.target.value })}><option value="">Elige una plantilla…</option>{mkt.map((x) => <option key={x.id} value={x.id}>{x.nombre} ({x.canal})</option>)}</select></label>
            </div>
            <p className="mt-3 text-xs text-ink/55">Solo reciben el mensaje las clientas que aceptaron recibir promociones. Máximo 3 campañas cada 24 horas.</p>
            <button className="press-spring mt-3 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream disabled:opacity-50" disabled={isPending || c.nombre.trim().length < 2 || !c.segmento || !c.plantilla}
              onClick={() => { setMsg(null); startTransition(async () => { const r = await enviarCampana(tenantId, c.nombre, c.segmento, c.plantilla, c.programada); if (r.error) setMsg({ ok: false, texto: r.error }); else { setMsg({ ok: true, texto: `Campaña lista: ${r.resumen?.encolados} mensajes en cola. Sin consentimiento (omitidas): ${r.resumen?.omitidos_sin_consentimiento}. Sin dato de contacto: ${r.resumen?.omitidos_sin_destino}.` }); setC({ nombre: "", segmento: "", plantilla: "", programada: "" }); } }); }}>Crear campaña</button>
          </section>
          <section className="rounded-2xl border border-white/10 bg-card p-5">
            <h2 className="text-base font-semibold text-ink">Mis campañas</h2>
            <ul className="mt-3 divide-y divide-white/10">
              {campanas.length === 0 && <li className="py-3 text-sm text-ink/50">Aún no has creado campañas.</li>}
              {campanas.map((x) => (
                <li key={x.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-ink"><strong>{x.nombre}</strong> · {x.segmento} · {x.plantilla} ({x.canal})<span className="block text-xs text-ink/55">{x.estado === "cancelada" ? "Cancelada" : `${x.enviados} enviados · ${x.pendientes} en cola · ${x.fallidos} fallidos`} · omitidas: {x.omitidos_consentimiento} sin consentimiento, {x.omitidos_sin_destino} sin contacto</span></span>
                    {x.estado !== "cancelada" && x.pendientes > 0 && <button className="text-xs text-ink/55 hover:text-ink" disabled={isPending} onClick={() => correr(() => cancelarCampana(x.id), "Campaña cancelada: lo pendiente no se enviará.")}>Cancelar envío</button>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>)}

        {tab === "segmentos" && (<>
          <section className="rounded-2xl border border-white/10 bg-card p-5">
            <h2 className="text-base font-semibold text-ink">Nuevo segmento</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-sm text-ink/60">Nombre<input className={input} value={s.nombre} onChange={(e) => setS({ ...s, nombre: e.target.value })} /></label>
              <label className="text-sm text-ink/60">Quiénes<select className={input} value={s.tipo} onChange={(e) => setS({ ...s, tipo: e.target.value })}>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label className="text-sm text-ink/60">Días (N)<input type="number" min={1} max={365} className={input} value={s.dias} onChange={(e) => setS({ ...s, dias: e.target.value })} /></label>
            </div>
            <button className="press-spring mt-3 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream disabled:opacity-50" disabled={isPending || s.nombre.trim().length < 2} onClick={() => correr(() => crearSegmento(tenantId, s.nombre, s.tipo, Number(s.dias || 30)), "Segmento creado.", () => setS({ ...s, nombre: "" }))}>Guardar segmento</button>
          </section>
          <section className="rounded-2xl border border-white/10 bg-card p-5">
            <ul className="divide-y divide-white/10">
              {segmentos.length === 0 && <li className="py-3 text-sm text-ink/50">Aún no tienes segmentos.</li>}
              {segmentos.map((x) => <li key={x.id} className="py-3 text-sm text-ink"><strong>{x.nombre}</strong> <span className="text-ink/55">· {describe(x.criterio)}</span><span className="block text-xs text-ink/55">{x.personas} personas · {x.con_consentimiento} aceptaron recibir promociones</span></li>)}
            </ul>
          </section>
        </>)}

        {tab === "plantillas" && (<>
          <section className="rounded-2xl border border-white/10 bg-card p-5">
            <h2 className="text-base font-semibold text-ink">{p.id ? "Editar plantilla" : "Nueva plantilla de promoción"}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-ink/60">Nombre<input className={input} value={p.nombre} onChange={(e) => setP({ ...p, nombre: e.target.value })} /></label>
              <label className="text-sm text-ink/60">Canal<select className={input} disabled={!!p.id} value={p.canal} onChange={(e) => setP({ ...p, canal: e.target.value })}><option value="email">Correo</option><option value="whatsapp">WhatsApp</option></select></label>
              {p.canal === "email" && <label className="text-sm text-ink/60 sm:col-span-2">Asunto<input className={input} value={p.asunto} onChange={(e) => setP({ ...p, asunto: e.target.value })} /></label>}
              <label className="text-sm text-ink/60 sm:col-span-2">Mensaje (puedes usar {"{{nombre}}"} y {"{{estudio}}"})<textarea rows={4} className={input} value={p.cuerpo} onChange={(e) => setP({ ...p, cuerpo: e.target.value })} /></label>
            </div>
            <div className="mt-3 flex gap-3">
              <button className="press-spring rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream disabled:opacity-50" disabled={isPending || p.nombre.trim().length < 2}
                onClick={() => correr(() => guardarPlantilla({ id: p.id, tenantId, clave: p.nombre, nombre: p.nombre, canal: p.canal, asunto: p.asunto, cuerpo: p.cuerpo, activa: true }), "Plantilla guardada.", () => setP({ id: null, nombre: "", canal: "email", asunto: "", cuerpo: "" }))}>Guardar</button>
              {p.id && <button className="text-sm text-ink/55" onClick={() => setP({ id: null, nombre: "", canal: "email", asunto: "", cuerpo: "" })}>Cancelar edición</button>}
            </div>
          </section>
          <section className="rounded-2xl border border-white/10 bg-card p-5">
            <ul className="divide-y divide-white/10">
              {plantillas.map((x) => (
                <li key={x.id} className="py-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-ink"><strong>{x.nombre}</strong> <span className="text-ink/55">· {x.canal} · {x.tipo === "transaccional" ? "automático" : "promoción"}</span><span className="block text-xs text-ink/60">{x.cuerpo}</span></span>
                    <button className="shrink-0 text-xs text-ink/55 hover:text-ink" onClick={() => { setP({ id: x.id, nombre: x.nombre, canal: x.canal, asunto: x.asunto ?? "", cuerpo: x.cuerpo }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Editar</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>)}
      </div>
    </main>
  );
}
