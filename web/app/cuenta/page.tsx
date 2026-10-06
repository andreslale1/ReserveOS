import Link from "next/link";
import { getCuenta } from "@/lib/cuenta-context";
import QRCode from "qrcode";
import CheckinButton from "./checkin-button";
import MiQr from "./mi-qr";

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
  const { data: codigo } = await supabase.rpc("mi_codigo_checkin", { p_tenant_id: actual!.tenant_id, p_renovar: false });
  const qrImagen = codigo ? await QRCode.toDataURL(`RSCK:${codigo}`, { margin: 1, width: 440 }) : null;
  const activos = r.paquetes.filter((p) => p.estado === "activa");
  const pendientes = r.paquetes.filter((p) => p.estado === "pendiente_pago");
  const fmt = (f: string) => new Date(f + "T00:00:00").toLocaleDateString("es-GT", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="grid gap-5">
      <h1 className="font-serif text-2xl text-ink">Hola, {r.nombre.split(" ")[0]}</h1>
      {r.consentimiento_pendiente && (
        <Link href="/cuenta/perfil#consentimiento" className="rounded-2xl bg-peach-tint px-5 py-4 text-sm text-ink">Completa tu consentimiento y datos de salud antes de tu primera clase →</Link>
      )}
      {pendientes.map((p) => (
        <div key={p.id} className="rounded-2xl bg-peach-tint px-5 py-4 text-sm text-ink">Tu pago de <strong>{p.paquete}</strong> está pendiente de confirmación. Te avisamos cuando lo aprueben.</div>
      ))}

      <section className="rounded-2xl border border-black/10 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/50">Mis clases</h2>
        {activos.length === 0 ? (
          <p className="mt-2 text-sm text-ink/65">No tienes un paquete activo. <Link href="/cuenta/paquetes" className="underline">Elige uno</Link> para reservar.</p>
        ) : (
          <ul className="mt-2 divide-y divide-black/5">
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

      <section className="rounded-2xl border border-black/10 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/50">Próximas reservas</h2>
          <Link href="/cuenta/clases" className="text-sm text-ink underline">Reservar</Link>
        </div>
        <ul className="mt-2 divide-y divide-black/5">
          {r.proximas.length === 0 && <li className="py-3 text-sm text-ink/60">No tienes reservas próximas.</li>}
          {r.proximas.map((x) => (
            <li key={x.id} className="py-3 text-sm">
              <p className="font-medium text-ink">{x.clase} · {x.hora.slice(0, 5)}</p>
              <p className="text-ink/65">{fmt(x.fecha)} · {x.sede}{x.para !== r.nombre ? ` · para ${x.para}` : ""}</p>
            </li>
          ))}
        </ul>
        <CheckinButton />
        {qrImagen && <MiQr tenantId={actual!.tenant_id} imagen={qrImagen} codigo={codigo as string} />}
      </section>
    </div>
  );
}
