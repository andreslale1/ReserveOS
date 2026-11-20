import Link from "next/link";
import { getCuenta } from "@/lib/cuenta-context";
import QRCode from "qrcode";
import CheckinButton from "./checkin-button";
import MiQr from "./mi-qr";
import ConfirmarReserva from "./confirmar-reserva";
import { vocabularioDe } from "@/lib/marca";
import { hoyGT } from "@/lib/fechas";
import { Anillo, Meta, Tendencia } from "@/components/graficas/graficas";

type Resumen = {
  nombre: string; consentimiento_pendiente: boolean;
  paquetes: { id: string; paquete: string; estado: string; totales: number | null; usadas: number; vence: string; congelada: boolean; sedes: string | null }[];
  proximas: { id: string; fecha: string; hora: string; clase: string; sede: string; confirmada: boolean; para: string }[];
};

export default async function InicioPage() {
  const { supabase, actual } = await getCuenta();
  const { data } = await supabase.rpc("mi_resumen", { p_tenant_id: actual!.tenant_id });
  const r = data as Resumen | null;
  if (!r) return null;
  const { data: retoData } = await supabase.rpc("mi_reto_mensual", { p_tenant_id: actual!.tenant_id });
  const reto = retoData as { meta: number; asistidas: number; por_asistir: number; porcentaje: number; cumplido: boolean } | null;
  const { data: codigo } = await supabase.rpc("mi_codigo_checkin", { p_tenant_id: actual!.tenant_id, p_renovar: false });
  const qrImagen = codigo ? await QRCode.toDataURL(`RSCK:${codigo}`, { margin: 1, width: 440 }) : null;
  const v = await vocabularioDe(actual!.slug);
  const activos = r.paquetes.filter((p) => p.estado === "activa");
  // Mi constancia: reservas asistidas o próximas por semana, últimas 8 semanas (solo las mías).
  const hoyIso = hoyGT();
  const lunes = (d: Date) => { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const semana0 = lunes(new Date());
  const inicio = new Date(semana0); inicio.setDate(inicio.getDate() - 49);
  const { data: mias } = actual!.cliente_id
    ? await supabase.from("reservas").select("fecha, asistio").eq("cliente_id", actual!.cliente_id).eq("estado", "confirmada").gte("fecha", inicio.toISOString().slice(0, 10)).lte("fecha", hoyIso)
    : { data: [] };
  const semanas = Array.from({ length: 8 }, (_, i) => { const d = new Date(inicio); d.setDate(d.getDate() + i * 7); const f = d.toISOString().slice(0, 10); const g = new Date(d); g.setDate(g.getDate() + 6); const t = g.toISOString().slice(0, 10);
    return { etiqueta: `${d.getDate()} ${d.toLocaleDateString("es-GT", { month: "short" }).replace(".", "")}`, valor: (mias ?? []).filter((x) => x.fecha >= f && x.fecha <= t && x.asistio !== false).length }; });
  let racha = 0; for (let i = semanas.length - 1; i >= 0; i--) { if (semanas[i].valor > 0) racha++; else if (i === semanas.length - 1) continue; else break; }
  const pa = activos[0];
  const usoPct = pa && pa.totales ? Math.round((pa.usadas / pa.totales) * 100) : null;
  const fmt = (f: string) => new Date(f + "T00:00:00").toLocaleDateString("es-GT", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-4xl text-ink">Hola, {r.nombre.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-ink/60">Bienvenida a tu espacio {actual!.estudio}.</p>
      </div>
      {r.consentimiento_pendiente && (
        <Link href="/cuenta/perfil#consentimiento" className="rounded-2xl bg-peach-tint px-5 py-4 text-sm text-ink">Completa tu consentimiento y datos de salud antes de tu primera clase →</Link>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link href="/cuenta/clases" className="rounded-2xl border border-ink/10 bg-card p-5 transition-colors hover:border-peach">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/50">{v.clases.charAt(0).toUpperCase() + v.clases.slice(1)} disponibles</p>
          <p className="mt-2 font-serif text-5xl text-ink">{activos[0] ? (activos[0].totales === null ? "∞" : activos[0].totales - activos[0].usadas) : 0}</p>
          <p className="mt-1 text-sm text-ink/65">{activos[0] ? "De tu paquete activo — reservar" : "Compra un paquete para seguir"}</p>
        </Link>
        <Link href="/cuenta/paquetes" className="rounded-2xl border border-ink/10 bg-card p-5 transition-colors hover:border-peach">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/50">Tu {v.paquete}</p>
          <p className="mt-2 font-serif text-2xl text-ink">{activos[0]?.paquete ?? "Sin paquete activo"}</p>
          <p className="mt-1 text-sm text-ink/65">{activos[0] ? `Vence ${fmt(activos[0].vence)}` : "Comprar paquete"}</p>
          {activos[0]?.sedes && <p className="mt-1 text-xs text-ink/50">Válido en: {activos[0].sedes}</p>}
        </Link>
        <Link href="/cuenta/historial" className="rounded-2xl border border-ink/10 bg-card p-5 transition-colors hover:border-peach">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/50">Próxima {v.clase}</p>
          <p className="mt-2 font-serif text-2xl text-ink">{r.proximas[0] ? fmt(r.proximas[0].fecha) : "—"}</p>
          <p className="mt-1 text-sm text-ink/65">{r.proximas[0] ? `${r.proximas[0].clase} · ${r.proximas[0].hora.slice(0, 5)}` : "Sin reservas"}</p>
          {r.proximas[0] && <p className="mt-1 text-xs text-ink/50">Sede {r.proximas[0].sede}{r.proximas[0].para !== r.nombre ? ` · para ${r.proximas[0].para}` : ""}</p>}
        </Link>
      </div>
      <section aria-label="Mi progreso" className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-ink/10 bg-card p-5">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink/50">Mi paquete</h2>
          <Anillo pct={usoPct} etiqueta={pa ? (pa.totales === null ? "Clases ilimitadas" : `${pa.usadas} de ${pa.totales} usadas`) : "Sin paquete activo"} />
        </div>
        <div className="rounded-2xl border border-ink/10 bg-card p-5 sm:col-span-2">
          <div className="mb-3 flex items-baseline justify-between"><h2 className="text-[11px] font-semibold uppercase tracking-wider text-ink/50">Mi constancia · 8 semanas</h2>{racha > 0 && <span className="text-xs font-medium text-good">{racha} {racha === 1 ? "semana" : "semanas"} seguidas</span>}</div>
          <Tendencia puntos={semanas} nombre="Clases" alto={150} />
        </div>
      </section>
      <div className="flex flex-wrap gap-3">
        <Link href="/cuenta/clases" className="rounded-full bg-peach px-6 py-3 text-sm font-semibold text-void transition-opacity hover:opacity-90">Reservar {v.clase}</Link>
        <Link href="/cuenta/paquetes" className="rounded-full border border-ink/20 px-6 py-3 text-sm font-semibold text-ink hover:border-peach">Mi paquete</Link>
        <Link href="/cuenta/perfil" className="rounded-full border border-ink/20 px-6 py-3 text-sm font-semibold text-ink hover:border-peach">Mis datos</Link>
      </div>
      <section className="rounded-2xl border border-ink/10 bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/50">Próximas reservas</h2>
          
        </div>
        <ul className="mt-2 divide-y divide-ink/5">
          {r.proximas.length === 0 && <li className="py-3 text-sm text-ink/60">No tienes reservas próximas.</li>}
          {r.proximas.map((x) => (
            <li key={x.id} className="py-3 text-sm">
              <p className="font-medium text-ink">{x.clase} · {x.hora.slice(0, 5)}</p>
              <p className="text-ink/65">{fmt(x.fecha)} · {x.sede}{x.para !== r.nombre ? ` · para ${x.para}` : ""}</p>
              {x.confirmada ? <p className="mt-1 text-xs text-sage">✓ Confirmaste tu asistencia</p> : <ConfirmarReserva reservaId={x.id} />}
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-2xl border border-ink/10 bg-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/50">Mis clases</h2>
        {activos.length === 0 ? (
          <p className="mt-2 text-sm text-ink/65">No tienes un paquete activo. <Link href="/cuenta/paquetes" className="underline">Elige uno</Link> para reservar.</p>
        ) : (
          <ul className="mt-2 divide-y divide-ink/5">
            {activos.map((p) => (
              <li key={p.id} className="py-3 text-sm">
                <p className="font-medium text-ink">{p.paquete}{p.congelada ? " · congelado" : ""}</p>
                <p className="text-ink/65">{p.totales === null ? "Clases ilimitadas" : `${p.totales - p.usadas} de ${p.totales} clases disponibles`} · vence {fmt(p.vence)}</p>
                {p.sedes && <p className="text-xs text-ink/45">Válido en: {p.sedes}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {reto && (
        <section className="rounded-2xl border border-ink/10 bg-card p-5" aria-label="Reto del mes">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/50">Reto del mes</h2>
            <p className="text-sm text-ink/70"><strong className="text-ink">{reto.asistidas}</strong> de {reto.meta} clases</p>
          </div>
          <div className="mt-3"><Meta actual={reto.asistidas} meta={reto.meta} /></div>
          <p className="mt-2 text-xs text-ink/60">
            {reto.cumplido ? "¡Reto cumplido este mes! 🎉" : reto.por_asistir > 0 ? `Te faltan ${reto.meta - reto.asistidas} clases · ya tienes ${reto.por_asistir} reservada${reto.por_asistir === 1 ? "" : "s"}.` : `Te faltan ${reto.meta - reto.asistidas} clases para completar el reto.`}
          </p>
        </section>
      )}

      <details className="rounded-2xl border border-ink/10 bg-card p-5">
        <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-ink/50">Llegué al estudio (check-in y mi QR)</summary>
        <div className="mt-3">
          <CheckinButton />
          {qrImagen && <MiQr tenantId={actual!.tenant_id} imagen={qrImagen} codigo={codigo as string} />}
        </div>
      </details>
    </div>
  );
}
