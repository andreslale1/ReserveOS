import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-6">
      <div className="w-full max-w-sm rounded-[2rem] border border-black/[0.06] bg-card p-8 shadow-[0_30px_60px_-30px_rgba(17,17,17,0.25)]">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-peach">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M2 8.5L6 12.5L14 3.5"
              stroke="#111111"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        <h1 className="mt-5 font-serif text-2xl tracking-tight text-ink">
          Entrar a ReserveOS
        </h1>
        <p className="mt-1 text-sm text-ink/60">
          Panel del estudio y operación diaria.
        </p>

        <form action={login} className="mt-8 space-y-4">
          <input type="hidden" name="next" value={next ?? "/panel"} />

          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-xs font-medium text-ink/70"
            >
              Correo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-xl border border-black/10 bg-cream px-4 py-2.5 text-sm text-ink outline-none transition-colors focus:border-peach"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-xs font-medium text-ink/70"
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-black/10 bg-cream px-4 py-2.5 text-sm text-ink outline-none transition-colors focus:border-peach"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="press-spring mt-2 w-full rounded-full bg-peach py-2.5 text-sm font-medium text-ink transition-colors duration-200 hover:bg-peach/85"
          >
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}
