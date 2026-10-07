import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL } from "@/lib/panel-context";
import { elegirPanel } from "./actions";

export default async function ElegirPanelPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("tenant_memberships").select("tenant_id, role, tenants(name)").eq("user_id", user.id);
  const lista = (data ?? []) as unknown as { tenant_id: string; role: string; tenants: { name: string } | null }[];
  if (lista.length === 0) redirect("/cuenta");

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-6 py-10">
      <div className="w-full max-w-md">
        <h1 className="font-serif text-3xl text-ink">¿A qué estudio entras?</h1>
        <p className="mt-2 text-sm text-ink/65">Trabajas en más de un estudio. Cada uno tiene sus propios datos, y verás solo lo que tu rol permite en ese estudio.</p>
        <ul className="mt-6 grid gap-3">
          {lista.map((m) => (
            <li key={m.tenant_id}>
              <form action={elegirPanel}>
                <input type="hidden" name="tenant_id" value={m.tenant_id} />
                <button className="flex w-full items-center justify-between rounded-2xl border border-black/10 bg-white px-5 py-4 text-left shadow-sm transition hover:border-ink/40">
                  <span className="text-base font-semibold text-ink">{m.tenants?.name}</span>
                  <span className="text-sm text-ink/50">{ROLE_LABEL[m.role] ?? m.role} →</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
