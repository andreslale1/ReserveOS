import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const HOSTS_PROPIOS = new Set(["reserveos.app", "www.reserveos.app", "localhost", "127.0.0.1"]);
const cacheDominios = new Map<string, { v: { tenant_id: string; slug: string; nombre: string } | null; t: number }>();

// El estudio se deduce del host SOLO si el dominio está verificado en la base. Cache de 60 s para no consultar en cada petición.
async function estudioPorHost(host: string) {
  if (HOSTS_PROPIOS.has(host) || host.endsWith(".vercel.app")) return null;
  const hit = cacheDominios.get(host);
  if (hit && Date.now() - hit.t < 60_000) return hit.v;
  let v: { tenant_id: string; slug: string; nombre: string } | null = null;
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/tenant_por_dominio`, {
      method: "POST",
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ p_host: host }),
    });
    if (r.ok) v = (await r.json()) ?? null;
  } catch {
    v = null;
  }
  cacheDominios.set(host, { v, t: Date.now() });
  return v;
}

export async function updateSession(request: NextRequest) {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const estudio = await estudioPorHost(host);
  const cabeceras = new Headers(request.headers);
  // Nunca se aceptan estas cabeceras del exterior: solo las fija el servidor.
  cabeceras.delete("x-tenant-id"); cabeceras.delete("x-tenant-slug"); cabeceras.delete("x-tenant-nombre");
  if (estudio) {
    cabeceras.set("x-tenant-id", estudio.tenant_id);
    cabeceras.set("x-tenant-slug", estudio.slug);
    cabeceras.set("x-tenant-nombre", encodeURIComponent(estudio.nombre));
  }
  let supabaseResponse = NextResponse.next({ request: { headers: cabeceras } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request: { headers: cabeceras } });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname.startsWith("/panel")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // En el dominio de un estudio: la portada es su página pública, y la consola del operador no existe.
  if (estudio) {
    const ruta = request.nextUrl.pathname;
    if (ruta.startsWith("/owner")) {
      return NextResponse.redirect(new URL(`https://reserveos.app${ruta}`));
    }
    if (ruta === "/" || (ruta.startsWith("/e/") && ruta !== `/e/${estudio.slug}`)) {
      const url = request.nextUrl.clone();
      url.pathname = `/e/${estudio.slug}`;
      const reescrita = NextResponse.rewrite(url, { request: { headers: cabeceras } });
      supabaseResponse.cookies.getAll().forEach((c) => reescrita.cookies.set(c));
      return reescrita;
    }
  }

  return supabaseResponse;
}
