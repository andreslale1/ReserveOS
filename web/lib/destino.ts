// Destinos de redirección: solo rutas internas de la app. Evita que /login?next=https://sitio-malo.com o //sitio-malo.com
// convierta el inicio de sesión en un redireccionador abierto.
export function destinoSeguro(next: string | null | undefined, porDefecto = "/cuenta"): string {
  const n = (next ?? "").trim();
  if (!n.startsWith("/") || n.startsWith("//") || n.includes("\\") || /[\u0000-\u001f]/.test(n)) return porDefecto;
  return n;
}

// Slug de estudio válido (el mismo formato que se usa para crear estudios).
export function slugSeguro(s: string | null | undefined): string | null {
  const v = (s ?? "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{1,60}$/.test(v) ? v : null;
}
