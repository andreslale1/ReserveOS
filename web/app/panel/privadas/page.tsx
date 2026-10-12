import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";
import PrivadasView, { type Hueco, type Opcion } from "./privadas-view";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function PrivadasPage({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string; sede?: string }> }) {
  const f = await searchParams;
  const { supabase, membership, sedes } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/privadas")) redirect("/panel/hoy");
  const rol = membership.role;
  const puedeAsignar = ["duena", "gerente_general", "admin_sede", "recepcion"].includes(rol);
  const puedeCrear = ["duena", "gerente_general", "admin_sede"].includes(rol);

  const [agenda, clientas, paquetes, instrs] = await Promise.all([
    supabase.rpc("privadas_agenda", { p_tenant_id: membership.tenant_id, p_desde: f.desde && ISO.test(f.desde) ? f.desde : null, p_hasta: f.hasta && ISO.test(f.hasta) ? f.hasta : null, p_sede_id: f.sede || null }),
    puedeAsignar ? supabase.from("clientes").select("id, nombre").eq("tenant_id", membership.tenant_id).is("tutor_id", null).order("nombre").limit(500) : Promise.resolve({ data: [] }),
    puedeAsignar ? supabase.from("paquetes").select("id, nombre, precio").eq("tenant_id", membership.tenant_id).eq("categoria", "privado").eq("activo", true).order("nombre") : Promise.resolve({ data: [] }),
    puedeCrear ? supabase.from("tenant_memberships").select("id, nombre").eq("tenant_id", membership.tenant_id).eq("role", "instructora").order("nombre") : Promise.resolve({ data: [] }),
  ]);

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <h1 className="font-serif text-2xl text-ink md:text-3xl">Clases privadas</h1>
        <p className="mt-1 text-sm text-ink/60">Sesiones 1 a 1 con una instructora, con su propio paquete. {rol === "instructora" ? "Ves las tuyas." : "Ves las sedes que te corresponden."}</p>
      </header>
      <PrivadasView
        tenantId={membership.tenant_id}
        agenda={(agenda.data ?? []) as Hueco[]} error={agenda.error?.message ?? null}
        desde={f.desde ?? ""} hasta={f.hasta ?? ""} sedeId={f.sede ?? ""}
        sedes={sedes.map((s) => ({ id: s.id, name: s.name }))}
        clientas={(clientas.data ?? []) as Opcion[]} paquetes={(paquetes.data ?? []) as Opcion[]} instructoras={(instrs.data ?? []) as Opcion[]}
        puedeAsignar={puedeAsignar} puedeCrear={puedeCrear}
      />
    </main>
  );
}
