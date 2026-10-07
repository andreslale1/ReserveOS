// Fechas de la consola: la plataforma opera en hora de Guatemala. Nunca se usa toISOString() para "hoy" ni "este mes"
// (devuelve el día en UTC y adelanta el día por las tardes). Las fechas guardadas son "aaaa-mm-dd" y se muestran dd/mm/aaaa.
export const ZONA = "America/Guatemala";

function partes(d: Date) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return { y: g("year"), m: g("month"), d: g("day") };
}

/** Día de hoy en Guatemala, "aaaa-mm-dd". */
export function hoyGT(ahora: Date = new Date()): string {
  const { y, m, d } = partes(ahora);
  return `${y}-${m}-${d}`;
}
/** Mes actual en Guatemala, "aaaa-mm". */
export function mesGT(ahora: Date = new Date()): string {
  return hoyGT(ahora).slice(0, 7);
}
/** Primer día del mes actual en Guatemala, "aaaa-mm-01". */
export function primerDiaMesGT(ahora: Date = new Date()): string {
  return `${mesGT(ahora)}-01`;
}
/** Último día de un mes "aaaa-mm", "aaaa-mm-dd". */
export function ultimoDiaMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return `${mes}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
}
/** "2026-10-07" → "07/10/2026". Sin pasar por Date, para no mover el día por zona horaria. */
export function formatoFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
/** Instante (timestamptz) → "07/10/2026 8:30 p. m." en hora de Guatemala. */
export function formatoFechaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${formatoFecha(hoyGT(d))} ${new Intl.DateTimeFormat("es-GT", { timeZone: ZONA, hour: "numeric", minute: "2-digit" }).format(d)}`;
}
/** "07/10/2026" o "7/10/26" → "2026-10-07"; devuelve "" si no es una fecha válida. */
export function parseFecha(texto: string): string {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\s*$/.exec(texto);
  if (!m) return "";
  const dd = Number(m[1]), mm = Number(m[2]), yy = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const f = new Date(Date.UTC(yy, mm - 1, dd));
  if (f.getUTCFullYear() !== yy || f.getUTCMonth() !== mm - 1 || f.getUTCDate() !== dd) return "";
  return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}
