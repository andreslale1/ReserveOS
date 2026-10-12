"use client";

import { useState, useTransition } from "react";
import { asignarPrivada, cancelarPrivada, crearHorarioPrivado } from "./actions";

export type Hueco = { horario_id: string; fecha: string; hora_inicio: string; hora_fin: string; nombre_clase: string; sede_id: string; sede: string; instructora: string | null; reserva_id: string | null; cliente: string | null; asistio: boolean | null };
export type Opcion = { id: string; nombre: string };

const campo = "mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-ink/30";
const boton = "press-spring rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream disabled:opacity-50";
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default function PrivadasView({ tenantId, agenda, error, desde, hasta, sedeId, sedes, clientas, paquetes, instructoras, puedeAsignar, puedeCrear }: {
  tenantId: string; agenda: Hueco[]; error: string | null; desde: string; hasta: string; sedeId: string; sedes: { id: string; name: string }[];
  clientas: Opcion[]; paquetes: Opcion[]; instructoras: Opcion[]; puedeAsignar: boolean; puedeCrear: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [asig, setAsig] = useState({ cliente: "", paquete: "", hueco: "", metodo: "efectivo" });
  const [nuevo, setNuevo] = useState({ sede: sedes[0]?.id ?? "", dia: "1", inicio: "09:00", fin: "09:50", nombre: "Clase privada", instructora: "" });
  const libres = agenda.filter((h) => !h.reserva_id);

  function correr(fn: () => Promise<{ error: string | null }>, ok: string, despues?: () => void) {
    setMsg(null);
    startTransition(async () => { const r = await fn(); if (r.error) setMsg({ ok: false, texto: r.error }); else { setMsg({ ok: true, texto: ok }); despues?.(); } });
  }
  const [hid, hf] = asig.hueco.split("|");

  return (
    <div className="mx-auto grid max-w-5xl gap-5 px-6 py-8 md:px-10">
      {msg && <p role={msg.ok ? "status" : "alert"} className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-sage-tint text-sage" : "bg-peach-tint text-ink"}`}>{msg.texto}</p>}
      {error && <p role="alert" className="rounded-xl bg-peach-tint px-4 py-3 text-sm text-ink">{error}</p>}

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-card p-5" aria-label="Rango de la agenda">
        <label className="text-sm text-ink/70">Desde<input type="date" name="desde" defaultValue={desde} className={campo} /></label>
        <label className="text-sm text-ink/70">Hasta<input type="date" name="hasta" defaultValue={hasta} className={campo} /></label>
        {sedes.length > 1 && <label className="text-sm text-ink/70">Sede<select name="sede" defaultValue={sedeId} className={campo}><option value="">Todas</option>{sedes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
        <button className={boton}>Ver</button>
        <p className="w-full text-xs text-ink/50">Sin fechas se muestran los próximos 14 días.</p>
      </form>

      <section className="rounded-2xl border border-white/10 bg-card p-5" aria-label="Agenda de clases privadas">
        <h2 className="text-base font-semibold text-ink">Agenda</h2>
        <ul className="mt-3 divide-y divide-white/10">
          {agenda.length === 0 && <li className="py-3 text-sm text-ink/55">No hay horarios privados en ese período{puedeCrear ? ". Crea uno abajo." : "."}</li>}
          {agenda.map((h) => (
            <li key={`${h.horario_id}|${h.fecha}`} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div>
                <p className="font-medium text-ink">{h.fecha.split("-").reverse().join("/")} · {h.hora_inicio.slice(0, 5)}–{h.hora_fin.slice(0, 5)} · {h.nombre_clase}</p>
                <p className="text-xs text-ink/55">{h.sede}{h.instructora ? ` · ${h.instructora}` : ""}</p>
              </div>
              {h.reserva_id ? (
                <span className="flex items-center gap-3">
                  <span className="rounded-full bg-sage-tint px-3 py-1 text-xs text-sage">{h.cliente}</span>
                  {puedeAsignar && <button className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-ink/70 hover:text-ink disabled:opacity-50" disabled={isPending}
                    onClick={() => { if (window.confirm(`¿Cancelar la clase privada de ${h.cliente}? Se le devuelve la clase a su paquete.`)) correr(() => cancelarPrivada(h.reserva_id!), "Clase privada cancelada y devuelta al paquete."); }}>Cancelar</button>}
                </span>
              ) : <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-ink/60">Libre</span>}
            </li>
          ))}
        </ul>
      </section>

      {puedeAsignar && (
        <section className="rounded-2xl border border-white/10 bg-card p-5" aria-label="Asignar clase privada">
          <h2 className="text-base font-semibold text-ink">Asignar una clase privada</h2>
          <p className="mt-1 text-xs text-ink/55">Crea el paquete privado de la clienta, lo cobra al método elegido y le aparta el horario.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-ink/70">Clienta<select value={asig.cliente} onChange={(e) => setAsig({ ...asig, cliente: e.target.value })} className={campo}><option value="">Elige…</option>{clientas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
            <label className="text-sm text-ink/70">Paquete privado<select value={asig.paquete} onChange={(e) => setAsig({ ...asig, paquete: e.target.value })} className={campo}><option value="">{paquetes.length ? "Elige…" : "No hay paquetes privados activos"}</option>{paquetes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
            <label className="text-sm text-ink/70">Horario libre<select value={asig.hueco} onChange={(e) => setAsig({ ...asig, hueco: e.target.value })} className={campo}><option value="">{libres.length ? "Elige…" : "No hay horarios libres en el rango"}</option>{libres.map((h) => <option key={`${h.horario_id}|${h.fecha}`} value={`${h.horario_id}|${h.fecha}`}>{h.fecha.split("-").reverse().join("/")} {h.hora_inicio.slice(0, 5)} · {h.sede}{h.instructora ? ` · ${h.instructora}` : ""}</option>)}</select></label>
            <label className="text-sm text-ink/70">Método de pago<select value={asig.metodo} onChange={(e) => setAsig({ ...asig, metodo: e.target.value })} className={campo}><option value="efectivo">Efectivo</option><option value="tarjeta_estudio">Tarjeta del estudio</option><option value="transferencia">Transferencia</option></select></label>
          </div>
          <button className={`${boton} mt-4`} disabled={isPending || !asig.cliente || !asig.paquete || !asig.hueco} onClick={() => correr(() => asignarPrivada(asig.cliente, asig.paquete, hid, hf, asig.metodo), "Clase privada asignada.", () => setAsig({ ...asig, hueco: "" }))}>{isPending ? "Guardando…" : "Asignar"}</button>
        </section>
      )}

      {puedeCrear && (
        <section className="rounded-2xl border border-white/10 bg-card p-5" aria-label="Nuevo horario privado">
          <h2 className="text-base font-semibold text-ink">Nuevo horario privado</h2>
          <p className="mt-1 text-xs text-ink/55">Un lugar por horario (1 a 1). La instructora debe estar asignada a la sede.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-sm text-ink/70">Sede<select value={nuevo.sede} onChange={(e) => setNuevo({ ...nuevo, sede: e.target.value })} className={campo}>{sedes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <label className="text-sm text-ink/70">Día<select value={nuevo.dia} onChange={(e) => setNuevo({ ...nuevo, dia: e.target.value })} className={campo}>{DIAS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></label>
            <label className="text-sm text-ink/70">Instructora<select value={nuevo.instructora} onChange={(e) => setNuevo({ ...nuevo, instructora: e.target.value })} className={campo}><option value="">Sin asignar</option>{instructoras.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}</select></label>
            <label className="text-sm text-ink/70">Inicio<input type="time" value={nuevo.inicio} onChange={(e) => setNuevo({ ...nuevo, inicio: e.target.value })} className={campo} /></label>
            <label className="text-sm text-ink/70">Fin<input type="time" value={nuevo.fin} onChange={(e) => setNuevo({ ...nuevo, fin: e.target.value })} className={campo} /></label>
            <label className="text-sm text-ink/70">Nombre<input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} className={campo} /></label>
          </div>
          <button className={`${boton} mt-4`} disabled={isPending || !nuevo.sede || nuevo.nombre.trim().length < 2 || nuevo.fin <= nuevo.inicio}
            onClick={() => correr(() => crearHorarioPrivado({ tenantId, sedeId: nuevo.sede, dia: Number(nuevo.dia), inicio: nuevo.inicio, fin: nuevo.fin, nombre: nuevo.nombre, instructoraId: nuevo.instructora }), "Horario privado creado.")}>{isPending ? "Creando…" : "Crear horario"}</button>
          {nuevo.fin <= nuevo.inicio && <p className="mt-2 text-xs text-ink/50">La hora de fin debe ser después de la de inicio.</p>}
        </section>
      )}
    </div>
  );
}
