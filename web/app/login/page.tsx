import { headers } from "next/headers";
import Link from "next/link";
import { login } from "./actions";
import { estiloMarca, marcaPorSlug } from "@/lib/marca";
import { Marca } from "@/components/navbar";
import { destinoSeguro, slugSeguro } from "@/lib/destino";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; e?: string }>;
}) {
  const { error, next, e } = await searchParams;
  const h = await headers();
  const estudio = decodeURIComponent(h.get("x-tenant-nombre") ?? "");
  // El estudio de origen viene del dominio propio o del enlace (?e=slug); sirve para ofrecer «Crear cuenta» sin perder el contexto.
  const slug = slugSeguro(h.get("x-tenant-slug")) ?? slugSeguro(e);
  const destino = destinoSeguro(next, "/panel");
  const marca = await marcaPorSlug(slug);

  return (
    <main className={`${marca ? "tema-estudio " : ""}flex min-h-screen items-center justify-center bg-void px-6`} style={estiloMarca(marca?.color)}>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-void-card p-8 shadow-[0_24px_48px_-28px_rgba(27,37,48,0.3)]">
        {marca?.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={marca.logo} alt={`Logo de ${marca.nombre}`} className="h-10 w-auto max-w-[12rem] object-contain" />
        ) : (
        <Marca />
        )}

        <h1 className="mt-6 text-2xl font-semibold text-ink">
          {estudio ? `Entrar a ${estudio}` : "Entrar a ReserveOS"}
        </h1>
        <p className="mt-1 text-sm text-ink/50">
          {estudio ? "Tus clases, paquetes y reservas." : "Panel del estudio y operación diaria."}
        </p>

        <form action={login} className="mt-8 space-y-4">
          <input type="hidden" name="next" value={destino} />
          {slug && <input type="hidden" name="e" value={slug} />}

          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-xs font-medium text-ink/60"
            >
              Correo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-line bg-void px-4 py-2.5 text-sm text-ink outline-none transition-colors focus:border-lime focus-visible:ring-2 focus-visible:ring-lime/30"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-xs font-medium text-ink/60"
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-line bg-void px-4 py-2.5 text-sm text-ink outline-none transition-colors focus:border-lime focus-visible:ring-2 focus-visible:ring-lime/30"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-[#fbe9e5] px-3 py-2 text-xs text-[#8f2f1f]">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="press-spring mt-2 w-full rounded-lg bg-lime py-3 text-sm font-semibold text-white hover:bg-lime-dim"
          >
            Entrar
          </button>
        </form>

        <div className="mt-6 space-y-2 text-center text-sm">
          <Link href="/login/olvide" className="block text-ink/60 underline hover:text-ink">¿Olvidaste tu contraseña?</Link>
          {slug && (
            <p className="text-ink/50">
              ¿Primera vez?{" "}
              <Link href={`/registro/${slug}?next=${encodeURIComponent(destino === "/panel" ? "/cuenta/clases" : destino)}`} className="font-semibold text-lime underline">Crear mi cuenta</Link>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
