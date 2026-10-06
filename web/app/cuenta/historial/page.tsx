import { getCuenta } from "@/lib/cuenta-context";
import ReembolsoForm from "./reembolso-form";

const ESTADO_PAQ: Record<string, string> = { activa: "Activo", pendiente_pago: "Pago pendiente", vencida: "Vencido", anulada: "Anulado" };

export default async function HistorialPage() {
  const { supabase, actual } = await getCuenta();
  const cid = actual!.cliente_id!;
  const [{ data: reservas }, { data: compras }] = await Promise.all([
    supabase.from("reservas").select("id, fecha, estado, asistio, tipo, horarios(nombre_clase, hora_inicio), sedes(name)").eq("cliente_id", cid).order("fecha", { ascending: false }).limit(40),
    supabase.from("membresias").select("id, estado, pagada, precio_final, metodo_pago, created_at, fecha_inicio, fecha_vencimiento, paquetes(nombre)").eq("cliente_id", cid).order("created_at", { ascending: false }).limit(20),
  ]);
  const fmt = (f: string) => new Date(f + "T00:00:00").toLocaleDateString("es-GT", { day: "numeric", month: "short", year: "numeric" });
  const q = (n: number | null) => (n === null ? "—" : `Q${Number(n).toLocaleString("es-GT")}`);
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <div className="grid gap-5">
      <h1 className="font-serif text-2xl text-ink">Historial</h1>
      <section className="rounded-2xl border border-black/10 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/50">Mis clases</h2>
        <ul className="mt-2 divide-y divide-black/5">
          {(reservas ?? []).length === 0 && <li className="py-3 text-sm text-ink/60">Aún no tienes clases.</li>}
          {(reservas ?? []).map((r) => {
            const h = r.horarios as unknown as { nombre_clase: string; hora_inicio: string } | null;
            const estado = r.estado === "cancelada" ? "Cancelada" : r.asistio === true ? "Asististe" : r.asistio === false ? "No asististe" : r.fecha >= hoy ? "Próxima" : "Sin registro";
            return (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-ink">{fmt(r.fecha)} · {h?.hora_inicio.slice(0, 5)} · {h?.nombre_clase}<span className="block text-xs text-ink/50">{(r.sedes as unknown as { name: string } | null)?.name}</span></span>
                <span className={`text-xs ${r.estado === "cancelada" ? "text-ink/40" : r.asistio === true ? "text-sage" : "text-ink/60"}`}>{estado}</span>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="rounded-2xl border border-black/10 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/50">Compras y recibos</h2>
        <ul className="mt-2 divide-y divide-black/5">
          {(compras ?? []).length === 0 && <li className="py-3 text-sm text-ink/60">Aún no tienes compras.</li>}
          {(compras ?? []).map((m) => (
            <li key={m.id} className="py-3 text-sm">
              <div className="flex items-center justify-between"><span className="font-medium text-ink">{(m.paquetes as unknown as { nombre: string } | null)?.nombre}</span><span className="text-ink">{q(m.precio_final)}</span></div>
              <p className="text-xs text-ink/55">{ESTADO_PAQ[m.estado] ?? m.estado} · {m.metodo_pago ?? "—"} · comprado {fmt(m.created_at.slice(0, 10))}{m.fecha_vencimiento ? ` · vence ${fmt(m.fecha_vencimiento)}` : ""}</p>
              {m.pagada && m.estado !== "anulada" && Number(m.precio_final) > 0 && <ReembolsoForm membresiaId={m.id} monto={Number(m.precio_final)} />}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
