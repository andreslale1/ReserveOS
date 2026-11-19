import Link from "next/link";
import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";
import CarrilesView, { type ClaseCarril } from "./carriles-view";

export default async function CarrilesPage({ searchParams }: { searchParams: Promise<{ sede?: string }> }) {
  const sp = await searchParams;
  const { supabase, membership, sedes } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/carriles")) redirect("/panel/hoy");
  if (sedes.length === 0) return <main className="px-5 py-10 md:px-10"><p className="text-sm text-ink-soft">No tienes sedes asignadas.</p></main>;

  const sede = sedes.find((s) => s.id === sp.sede) ?? sedes[0];
  const { data: rec, error } = await supabase.from("recursos").select("id, nombre, activo").eq("sede_id", sede.id).order("orden");
  const { data: hs } = await supabase.from("horarios").select("id, nombre_clase, dia_semana, hora_inicio, cupo_maximo, fecha_especifica").eq("sede_id", sede.id).eq("activo", true).is("fecha_especifica", null).order("dia_semana").order("hora_inicio");
  const { data: modos } = await supabase.from("horarios").select("id, modo_reserva").eq("sede_id", sede.id);
  const modoDe = new Map(((modos ?? []) as { id: string; modo_reserva?: string }[]).map((m) => [m.id, m.modo_reserva === "carril" ? "carril" : "cupo"] as const));
  const clases: ClaseCarril[] = (hs ?? []).map((h) => ({ id: h.id, nombre: h.nombre_clase, dia: h.dia_semana, inicio: h.hora_inicio, cupo: h.cupo_maximo, modo: modoDe.get(h.id) ?? "cupo" }));

  return (
    <main className="px-5 py-8 md:px-10">
      <h1 className="text-[clamp(28px,3vw,40px)] leading-tight tracking-[-0.04em]">Carriles y estaciones</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">Para HYROX, natación y cualquier clase donde cada persona elige un lugar numerado. Lo que no sea por carril sigue funcionando por cupo.</p>
      {sedes.length > 1 && (
        <nav aria-label="Sede" className="mt-5 flex flex-wrap gap-1.5">
          {sedes.map((s) => <Link key={s.id} href={`/panel/carriles?sede=${s.id}`} aria-current={s.id === sede.id ? "page" : undefined} className={`border px-3 py-1.5 text-sm ${s.id === sede.id ? "border-ink bg-ink text-void" : "border-line text-ink hover:border-ink/40"}`}>{s.name}</Link>)}
        </nav>
      )}
      <div className="mt-6">
        {error ? (
          <p role="alert" className="bg-warn-wash px-4 py-3 text-sm text-warn">Esta función se está activando en tu cuenta. Si el mensaje no desaparece pronto, avisa a soporte. ({error.message})</p>
        ) : (
          <CarrilesView sedeId={sede.id} carriles={(rec ?? []) as { id: string; nombre: string; activo: boolean }[]} clases={clases} puedeEditar={["duena", "gerente_general", "gerente_regional", "admin_sede"].includes(membership.role)} />
        )}
      </div>
    </main>
  );
}
