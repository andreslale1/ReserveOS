import { getOwnerContext } from "@/lib/owner-context";
import OwnerView from "./owner-view";

export default async function OwnerPage() {
  const { supabase } = await getOwnerContext();

  const { data: tenants, error } = await supabase.rpc("listar_tenants_plataforma");

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center text-white/60">
        Error cargando estudios: {error.message}
      </main>
    );
  }

  return <OwnerView tenants={tenants ?? []} />;
}
