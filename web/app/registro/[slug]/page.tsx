import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { destinoSeguro } from "@/lib/destino";
import RegistroForm from "./registro-form";

export default async function RegistroPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ next?: string; ref?: string }> }) {
  const { slug } = await params;
  const { next, ref } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("horarios_publicos", { p_slug: slug });
  const e = data as { id: string; nombre: string; slug: string; color: string | null; logo: string | null } | null;
  if (!e) notFound();
  return <RegistroForm tenantId={e.id} slug={e.slug} nombre={e.nombre} color={/^#[0-9a-fA-F]{6}$/.test(e.color ?? "") ? (e.color as string) : "#C6FF3A"} next={destinoSeguro(next, "/cuenta/clases")} referido={(ref ?? "").slice(0, 24).replace(/[^A-Za-z0-9]/g, "")} />;
}
