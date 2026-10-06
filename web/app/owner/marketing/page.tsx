import { getOwnerContext } from "@/lib/owner-context";
import MarketingView, { type Campana, type Exclusion } from "./marketing-view";

export default async function MarketingPage() {
  const { supabase } = await getOwnerContext();
  const [{ data, error }, { data: ex }] = await Promise.all([supabase.rpc("campanas_listar"), supabase.rpc("exclusiones_listar")]);
  if (error) return <main className="mx-auto max-w-3xl px-6 py-16 text-center text-white/60">{error.message}</main>;
  return <MarketingView campanas={(data ?? []) as Campana[]} exclusiones={(ex ?? []) as Exclusion[]} />;
}
