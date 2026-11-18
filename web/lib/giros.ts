// Cada giro de negocio habla su idioma. La plataforma es la misma; cambian el vocabulario y el modo de reservar.
export type Giro = "pilates" | "crossfit" | "hyrox" | "otro";

export type Vocabulario = {
  nombre: string;
  persona: string;        // quien reserva
  personas: string;
  clase: string;          // la unidad que se reserva
  clases: string;
  guia: string;           // quien la dirige
  reserva: "cupo" | "carril";
  recurso: string;        // nombre del recurso si se reserva por carril/estación
  paquete: string;
  detalle: string;
};

export const GIROS: Record<Giro, Vocabulario> = {
  pilates: { nombre: "Pilates", persona: "clienta", personas: "clientas", clase: "clase", clases: "clases", guia: "instructora", reserva: "cupo", recurso: "reformer", paquete: "paquete", detalle: "Clases con cupo por reformer o mat, instructora asignada, paquetes por número de clases y varias sedes." },
  crossfit: { nombre: "CrossFit", persona: "atleta", personas: "atletas", clase: "WOD", clases: "WODs", guia: "coach", reserva: "cupo", recurso: "lugar", paquete: "membresía", detalle: "Bloques de WOD con cupo por clase, coach, membresías mensuales o por visitas y asistencia por atleta." },
  hyrox: { nombre: "HYROX", persona: "atleta", personas: "atletas", clase: "sesión", clases: "sesiones", guia: "coach", reserva: "carril", recurso: "estación", paquete: "pase", detalle: "Sesiones por bloque horario con carriles o estaciones numeradas, cupo por bloque y pases por sesiones." },
  otro: { nombre: "Otro", persona: "cliente", personas: "clientes", clase: "clase", clases: "clases", guia: "coach", reserva: "cupo", recurso: "lugar", paquete: "paquete", detalle: "Natación, spinning o cualquier espacio con reserva por cupo o por carril." },
};
export const vocab = (g?: string | null): Vocabulario => GIROS[(g as Giro) in GIROS ? (g as Giro) : "pilates"];
