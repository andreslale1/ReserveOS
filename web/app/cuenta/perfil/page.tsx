import { getCuenta } from "@/lib/cuenta-context";
import PerfilView from "./perfil-view";

export default async function PerfilPage() {
  const { supabase, actual } = await getCuenta();
  const t = actual!.tenant_id;
  const [{ data: res }, { data: deps }] = await Promise.all([supabase.rpc("mi_resumen", { p_tenant_id: t }), supabase.rpc("mis_dependientes", { p_tenant_id: t })]);
  const r = res as { nombre: string; telefono: string; email: string | null; contacto_emergencia: string | null; cuidados: string | null; consentimiento_pendiente: boolean } | null;
  if (!r) return null;
  return (
    <PerfilView tenantId={t} perfil={{ nombre: r.nombre, telefono: r.telefono, email: r.email ?? "", emergencia: r.contacto_emergencia ?? "", cuidados: r.cuidados ?? "" }}
      consentimientoPendiente={r.consentimiento_pendiente} dependientes={(deps ?? []) as { id: string; nombre: string; fecha_nacimiento: string | null }[]} />
  );
}
