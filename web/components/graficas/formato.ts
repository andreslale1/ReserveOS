// Formatos compartidos (módulo común: lo usan componentes de servidor y de cliente).
export const num = (n: number) => new Intl.NumberFormat("es-GT").format(Math.round(n));
export const quetzales = (n: number) => `Q${num(n)}`;
export type Formato = "numero" | "quetzales";
export const aplicar = (f: Formato | undefined, n: number) => (f === "quetzales" ? quetzales(n) : num(n));
