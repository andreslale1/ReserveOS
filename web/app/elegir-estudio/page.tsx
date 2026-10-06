import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Contexto } from "@/lib/cuenta-context";
import { elegirEstudio } from "./actions";

export default async function ElegirEstudioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/cuenta");
  const { data } = await supabase.rpc("mis_contextos");
  const todos = (data ?? []) as Contexto[];
  const clientas = todos.filter((c) => c.es_clienta);
  const staff = todos.filter((c) => c.rol_staff);

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-6 py-10">
      <div className="w-full max-w-md">
        <h1 className="font-serif text-3xl text-ink">¿A qué estudio entras?</h1>
        <p className="mt-2 text-sm text-ink/65">Tu cuenta pertenece a más de un lugar. Tus paquetes, reservas y datos de cada uno están separados.</p>
        <ul className="mt-6 grid gap-3">
          {clientas.map((c) => (
            <li key={c.tenant_id}>
              <form action={elegirEstudio}>
                <input type="hidden" name="tenant_id" value={c.tenant_id} />
                <button className="flex w-full items-center justify-between rounded-2xl border border-black/10 bg-white px-5 py-4 text-left shadow-sm transition hover:border-ink/40">
                  <span className="text-base font-semibold text-ink">{c.estudio}</span>
                  <span className="text-sm text-ink/50">Entrar como clienta →</span>
                </button>
              </form>
            </li>
          ))}
          {staff.map((c) => (
            <li key={`s-${c.tenant_id}`}>
              <Link href="/panel" className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/60 px-5 py-4 text-ink">
                <span className="font-semibold">{c.estudio}</span><span className="text-sm text-ink/50">Entrar al panel ({c.rol_staff}) →</span>
              </Link>
            </li>
          ))}
          {clientas.length === 0 && staff.length === 0 && <li className="text-sm text-ink/60">Esta cuenta aún no pertenece a ningún estudio. Pide al tuyo que te registre.</li>}
        </ul>
      </div>
    </main>
  );
}
