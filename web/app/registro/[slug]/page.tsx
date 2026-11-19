import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { destinoSeguro } from "@/lib/destino";
import RegistroForm from "./registro-form";
import UnirmeForm from "./unirme-form";

export default async function RegistroPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ next?: string; ref?: string }> }) {
  const { slug } = await params;
  const { next, ref } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("horarios_publicos", { p_slug: slug });
  const e = data as { id: string; nombre: string; slug: string; color: string | null; logo: string | null } | null;
  if (!e) notFound();
  const destino = destinoSeguro(next, "/cuenta/clases");
  // Si ya hay sesión: o ya es clienta de este estudio (se sigue) o se une sin crear otra cuenta (auditoría REG-02).
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: ctx } = await supabase.rpc("mis_contextos");
    if (((ctx ?? []) as { tenant_id: string; es_clienta: boolean }[]).some((c) => c.tenant_id === e.id && c.es_clienta)) redirect(destino);
    return <UnirmeForm tenantId={e.id} nombreEstudio={e.nombre} email={user.email ?? ""} nombreInicial={String(user.user_metadata?.nombre ?? user.user_metadata?.full_name ?? "")} next={destino} />;
  }
  return <RegistroForm tenantId={e.id} slug={e.slug} nombre={e.nombre} color={/^#[0-9a-fA-F]{6}$/.test(e.color ?? "") ? (e.color as string) : "#C6FF3A"} next={destinoSeguro(next, "/cuenta/clases")} referido={(ref ?? "").slice(0, 24).replace(/[^A-Za-z0-9]/g, "")} />;
}
