import Link from "next/link";

const links = [
  { href: "#producto", label: "Producto" },
  { href: "#modulos", label: "Módulos" },
  { href: "#multisede", label: "Multi-sede" },
];

export default function Navbar() {
  return (
    <header className="sticky top-4 z-50 mx-auto w-[calc(100%-2rem)] max-w-3xl">
      <div className="flex items-center justify-between rounded-full border border-white/10 bg-void-card/70 px-5 py-3 shadow-[0_20px_40px_-16px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lime shadow-[0_0_20px_-2px_rgba(198,255,58,0.6)]">
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
          <span className="text-lg font-bold uppercase tracking-tight text-white">
            ReserveOS
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-white/60 transition-colors duration-200 hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/login"
            className="text-sm text-white/60 transition-colors duration-200 hover:text-white"
          >
            Entrar
          </Link>
          <a
            href="/contacto"
            className="press-spring rounded-full bg-lime px-5 py-2 text-sm font-semibold text-void shadow-[0_0_24px_-4px_rgba(198,255,58,0.7)] transition-colors duration-200 hover:bg-lime/85"
          >
            Hablemos →
          </a>
        </div>
      </div>
    </header>
  );
}
