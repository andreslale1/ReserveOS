import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";
import AutomatizacionesView from "./automatizaciones-view";

const ACTIVAS = [
  {
    nombre: "Liberar cupos no confirmados",
    frecuencia: "cada 10 minutos",
    descripcion:
      "Si una reserva no se confirma a tiempo, libera el cupo para que la lista de espera o otra clienta pueda tomarlo.",
  },
  {
    nombre: "Lista de espera vencida",
    frecuencia: "cada 15 minutos",
    descripcion:
      "Limpia entradas de lista de espera que ya vencieron sin que nadie tomara el cupo liberado.",
  },
];

const PENDIENTES = [
  {
    nombre: "Recordatorio de vencimiento de membresía",
    requiere: "WhatsApp o email",
  },
  {
    nombre: "Recordatorio de inactividad",
    requiere: "WhatsApp o email",
  },
  {
    nombre: "Recordatorio de clase agendada",
    requiere: "WhatsApp o push",
  },
  {
    nombre: "Recordatorio de contraseña para clientas nuevas",
    requiere: "Email",
  },
  {
    nombre: "Aviso de clase por comenzar / por terminar",
    requiere: "Push",
  },
];

export default async function AutomatizacionesPage() {
  const { membership } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/automatizaciones")) {
    redirect("/panel/hoy");
  }

  return <AutomatizacionesView activas={ACTIVAS} pendientes={PENDIENTES} />;
}
