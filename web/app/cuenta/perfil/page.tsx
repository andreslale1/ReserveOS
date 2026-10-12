import { getCuenta } from "@/lib/cuenta-context";
import PerfilView from "./perfil-view";
import { Avisos, InvitarYGanar, type Aviso } from "./extras";

export default async function PerfilPage() {
  const { supabase, actual } = await getCuenta();
  const t = actual!.tenant_id;
  const [{ data: res }, { data: deps }, { data: pref }, { data: avisos }, { data: codigo }, { data: referidas }] = await Promise.all([
    supabase.rpc("mi_resumen", { p_tenant_id: t }), supabase.rpc("mis_dependientes", { p_tenant_id: t }), supabase.rpc("mis_preferencias", { p_tenant_id: t }),
    supabase.rpc("mis_comunicados", { p_tenant_id: t }), supabase.rpc("mi_codigo_referido", { p_tenant_id: t }), supabase.rpc("contar_mis_referidos", { p_tenant_id: t }),
  ]);
  const r = res as { nombre: string; telefono: string; email: string | null; contacto_emergencia: string | null; cuidados: string | null; consentimiento_pendiente: boolean } | null;
  if (!r) return null;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://reserveos.app";
  const enlace = codigo ? `${base}/registro/${actual!.slug}?ref=${codigo}&next=${encodeURIComponent("/cuenta/clases")}` : null;
  return (
    <div className="grid gap-5">
      <Avisos avisos={((avisos ?? []) as { id: string; titulo: string; mensaje: string; creado: string; visto: boolean }[]) as Aviso[]} />
      <PerfilView preferencias={(pref ?? { marketing_ok: false, email_ok: true, whatsapp_ok: true }) as { marketing_ok: boolean; email_ok: boolean; whatsapp_ok: boolean }} tenantId={t} perfil={{ nombre: r.nombre, telefono: r.telefono, email: r.email ?? "", emergencia: r.contacto_emergencia ?? "", cuidados: r.cuidados ?? "" }}
        consentimientoPendiente={r.consentimiento_pendiente} dependientes={(deps ?? []) as { id: string; nombre: string; fecha_nacimiento: string | null }[]} />
      {enlace && <InvitarYGanar enlace={enlace} codigo={codigo as string} referidas={Number(referidas ?? 0)} estudio={actual!.estudio} />}
    </div>
  );
}
