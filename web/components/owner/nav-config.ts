export type Enlace = { href: string; label: string; roles: string[] };
export type Grupo = { titulo: string; enlaces: Enlace[] };

export const GRUPOS: Grupo[] = [
  { titulo: "Dirección", enlaces: [
    { href: "/owner/direccion", label: "Dirección", roles: ["operador", "ventas", "finanzas", "soporte", "implementacion", "ingenieria"] },
    { href: "/owner/tareas", label: "Tareas", roles: ["operador", "ventas", "finanzas", "soporte", "implementacion", "ingenieria"] },
  ] },
  { titulo: "Crecimiento", enlaces: [
    { href: "/owner/pipeline", label: "Pipeline", roles: ["operador", "ventas"] },
    { href: "/owner/marketing", label: "Marketing", roles: ["operador", "marketing", "ventas"] },
    { href: "/owner/contratos", label: "Contratos", roles: ["operador", "ventas", "finanzas"] },
  ] },
  { titulo: "Clientes e implementación", enlaces: [
    { href: "/owner", label: "Estudios", roles: ["operador", "soporte", "implementacion", "ingenieria"] },
    { href: "/owner/activaciones", label: "Activaciones", roles: ["operador", "ventas", "soporte", "implementacion", "ingenieria"] },
    { href: "/owner/dominios", label: "Dominios", roles: ["operador", "soporte", "implementacion", "ingenieria"] },
  ] },
  { titulo: "Finanzas", enlaces: [
    { href: "/owner/planes", label: "Planes", roles: ["operador", "finanzas", "ventas", "soporte", "implementacion", "ingenieria"] },
    { href: "/owner/cobros", label: "Cobros", roles: ["operador", "finanzas"] },
    { href: "/owner/rentabilidad", label: "Rentabilidad", roles: ["operador", "finanzas"] },
  ] },
  { titulo: "Operaciones", enlaces: [
    { href: "/owner/soporte", label: "Soporte", roles: ["operador", "soporte", "implementacion", "ingenieria"] },
    { href: "/owner/salud", label: "Salud", roles: ["operador", "soporte", "implementacion", "ingenieria"] },
  ] },
  { titulo: "Administración", enlaces: [
    { href: "/owner/equipo", label: "Equipo", roles: ["operador", "auditor"] },
    { href: "/owner/auditoria", label: "Auditoría", roles: ["operador", "auditor"] },
  ] },
];

export const NOMBRES_RUTA: Record<string, string> = {
  direccion: "Dirección", tareas: "Tareas", pipeline: "Pipeline", marketing: "Marketing", contratos: "Contratos", activaciones: "Activaciones",
  dominios: "Dominios", planes: "Planes", cobros: "Cobros", rentabilidad: "Rentabilidad", soporte: "Soporte", salud: "Salud", equipo: "Equipo", auditoria: "Auditoría",
};
