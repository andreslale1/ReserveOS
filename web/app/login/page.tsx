import { headers } from "next/headers";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const estudio = decodeURIComponent((await headers()).get("x-tenant-nombre") ?? "");

  return (
    <main className="flex min-h-screen items-center justify-center bg-void px-6">
      <div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-void-card p-8 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)]">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-lime shadow-[0_0_20px_-2px_rgba(198,255,58,0.6)]">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M2 8.5L6 12.5L14 3.5"
              stroke="#0a0b08"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        <h1 className="mt-5 text-2xl font-black uppercase tracking-tight text-white">
          {estudio ? `Entrar a ${estudio}` : "Entrar a ReserveOS"}
        </h1>
        <p className="mt-1 text-sm text-white/50">
          {estudio ? "Tus clases, paquetes y reservas." : "Panel del estudio y operación diaria."}
        </p>

        <form action={login} className="mt-8 space-y-4">
          <input type="hidden" name="next" value={next ?? "/panel"} />

          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-xs font-medium text-white/60"
            >
              Correo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-xl border border-white/10 bg-void px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-lime"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-xs font-medium text-white/60"
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-white/10 bg-void px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-lime"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="press-spring mt-2 w-full rounded-full bg-lime py-2.5 text-sm font-bold uppercase tracking-wide text-void shadow-[0_0_30px_-6px_rgba(198,255,58,0.7)] transition-colors duration-200 hover:bg-lime/85"
          >
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}
