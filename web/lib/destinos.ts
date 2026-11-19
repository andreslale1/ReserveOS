// Primera pantalla de cada rol del equipo de ReserveOS (auditoría ROL-03): marketing y auditor ya no aterrizan en una pantalla prohibida.
const DESTINO_PLATAFORMA: Record<string, string> = {
  operador: "/owner/direccion",
  ventas: "/owner/pipeline",
  finanzas: "/owner/cobros",
  soporte: "/owner/atencion",
  implementacion: "/owner/activaciones",
  ingenieria: "/owner/salud",
  marketing: "/owner/marketing",
  auditor: "/owner/auditoria",
};
export const destinoPlataforma = (rol: string | null | undefined) => DESTINO_PLATAFORMA[rol ?? ""] ?? "/owner/direccion";
