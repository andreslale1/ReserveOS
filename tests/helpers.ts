import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !ANON_KEY) {
  throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");
}

export { SUPABASE_URL, ANON_KEY };

// Las sesiones se guardan en disco ~50 min: cientos de inicios de sesión por corrida chocaban con el límite de peticiones de Supabase Auth.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
const CACHE = "/tmp/reserveos-test-tokens.json";
const leerCache = (): Record<string, { t: string; exp: number }> => { try { return existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {}; } catch { return {}; } };
export async function login(email: string, password: string): Promise<string> {
  const llave = `${SUPABASE_URL}|${email}|${password}`;
  const c = leerCache()[llave];
  if (c && c.exp > Date.now()) return c.t;
  for (let intento = 0; ; intento++) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.access_token) {
      const todo = leerCache(); todo[llave] = { t: data.access_token as string, exp: Date.now() + 50 * 60_000 };
      try { writeFileSync(CACHE, JSON.stringify(todo)); } catch { /* sin caché */ }
      return data.access_token as string;
    }
    if (data.error_code === "over_request_rate_limit" && intento < 8) { await new Promise((r) => setTimeout(r, 15_000)); continue; }
    throw new Error(`Login falló para ${email}: ${JSON.stringify(data)}`);
  }
}

export async function rpc(token: string | null, name: string, args: Record<string, unknown> = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(args),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

export async function selectFrom(token: string | null, table: string, query = "") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    headers: {
      apikey: ANON_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

export async function uploadObject(token: string, bucket: string, path: string, bytes: Uint8Array, contentType: string) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType },
    body: bytes,
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

// 1x1 PNG transparente — usado por las pruebas de storage, ningún archivo real.
export const ONE_PIXEL_PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="),
  (c) => c.charCodeAt(0)
);
