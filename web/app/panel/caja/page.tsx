import { redirect } from "next/navigation";
import { getPanelContext, puedeVer, fechaYDowEnSede, rutaHabilitada } from "@/lib/panel-context";
import CajaView from "./caja-view";

export default async function CajaPage() {
  const { supabase, membership, sedes, modulos } = await getPanelContext();

  if (!membership) {
    return null;
  }
  if (!puedeVer(membership.role, "/panel/caja") || !rutaHabilitada(modulos, "/panel/caja")) {
    redirect("/panel/hoy");
  }

  const puedeCerrar = ["duena", "gerente_general", "admin_sede"].includes(
    membership.role,
  );

  const sedesData = await Promise.all(
    sedes.map(async (sede) => {
      const { fecha } = fechaYDowEnSede(sede.timezone);

      const [{ data: esperado }, { data: detalle }, { data: historial }] =
        await Promise.all([
          supabase.rpc("caja_esperado_del_dia", {
            p_tenant_id: membership.tenant_id,
            p_sede_id: sede.id,
            p_fecha: fecha,
          }),
          supabase.rpc("detalle_caja_del_dia", {
            p_tenant_id: membership.tenant_id,
            p_sede_id: sede.id,
            p_fecha: fecha,
          }),
          puedeCerrar
            ? supabase.rpc("historial_cierres_caja", {
                p_tenant_id: membership.tenant_id,
                p_sede_id: sede.id,
                p_limite: 30,
              })
            : Promise.resolve({ data: [] }),
        ]);

      return {
        sedeId: sede.id,
        sedeNombre: sede.name,
        fecha,
        esperado: (esperado ?? []) as { metodo_pago: string; monto: number }[],
        detalle: (detalle ?? []) as {
          origen: string;
          cliente_nombre: string;
          concepto: string;
          monto: number;
          metodo_pago: string;
          hora: string;
        }[],
        historial: (historial ?? []) as {
          fecha: string;
          efectivo_sistema: number;
          efectivo_contado: number;
          tarjeta_sistema: number;
          tarjeta_contado: number;
          transferencia_sistema: number;
          transferencia_contado: number;
          notas: string | null;
          cerrado_por_nombre: string | null;
          cerrado_at: string;
        }[],
      };
    }),
  );

  return (
    <CajaView
      tenantId={membership.tenant_id}
      sedes={sedesData}
      puedeCerrar={puedeCerrar}
    />
  );
}
