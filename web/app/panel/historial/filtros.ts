// Filtros compartidos por la pantalla del historial y su descarga (mismos parámetros en la URL y en la función de la base).
export type Filtros = { desde?: string; hasta?: string; sede?: string; instructora?: string; dia?: string; hora?: string; estado?: string; asistencia?: string; pagina?: string };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}$/;

export function argumentosHistorial(tenantId: string, f: Filtros, limite: number, desplazamiento = 0) {
  return {
    p_tenant_id: tenantId,
    p_desde: f.desde && ISO.test(f.desde) ? f.desde : null,
    p_hasta: f.hasta && ISO.test(f.hasta) ? f.hasta : null,
    p_sede_id: f.sede || null,
    p_instructora: f.instructora || null,
    p_dia_semana: f.dia !== undefined && f.dia !== "" && Number(f.dia) >= 0 && Number(f.dia) <= 6 ? Number(f.dia) : null,
    p_hora: f.hora && HORA.test(f.hora) ? f.hora : null,
    p_estado: f.estado === "confirmada" || f.estado === "cancelada" ? f.estado : null,
    p_asistencia: ["asistio", "no_vino", "sin_marcar"].includes(f.asistencia ?? "") ? f.asistencia : null,
    p_limite: limite,
    p_desplazamiento: desplazamiento,
  };
}

export type FilaHistorial = {
  reserva_id: string; fecha: string; dia_semana: number; hora_inicio: string; nombre_clase: string; sede: string; instructora: string | null;
  cliente: string; tipo: string; estado: string; asistio: boolean | null; confirmada: boolean; total: number;
};

export const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const asistenciaTexto = (f: Pick<FilaHistorial, "estado" | "asistio">) =>
  f.estado === "cancelada" ? "Cancelada" : f.asistio === true ? "Asistió" : f.asistio === false ? "No vino" : "Sin marcar";
