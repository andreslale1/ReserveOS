// Estados de un estudio (módulo común: lo usan componentes de servidor y de cliente).
export const ESTADOS = ["borrador", "en_implantacion", "activo", "pausado", "suspendido", "cancelado"] as const;

export const ESTADO_LABEL: Record<string, { label: string; className: string }> = {
  borrador: { label: "Borrador", className: "bg-ink/10 text-ink/60" },
  en_implantacion: { label: "En implantación", className: "bg-sky-500/15 text-sky-300" },
  activo: { label: "Activo", className: "bg-lime/15 text-lime" },
  pausado: { label: "Pausado", className: "bg-yellow-500/15 text-[#7a5200]" },
  suspendido: { label: "Suspendido", className: "bg-orange-500/15 text-orange-300" },
  cancelado: { label: "Cancelado", className: "bg-ink/10 text-ink/50" },
};
