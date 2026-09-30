import Link from "next/link";

const links = [
  { href: "#producto", label: "Producto" },
  { href: "#modulos", label: "Módulos" },
  { href: "#multisede", label: "Multi-sede" },
];

export default function Navbar() {
  return (
    <header className="sticky top-4 z-50 mx-auto w-[calc(100%-2rem)] max-w-3xl">
      <div className="flex items-center justify-between rounded-full border border-white/60 bg-cream/70 px-5 py-3 shadow-[0_1px_1px_rgba(255,255,255,0.8)_inset,0_20px_40px_-16px_rgba(17,17,17,0.2)] backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-peach shadow-[0_2px_8px_-2px_rgba(17,17,17,0.35)]">
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
          <span className="font-serif text-lg tracking-tight text-ink">
            ReserveOS
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-ink/70 transition-colors duration-200 hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="hidden text-sm text-ink/70 transition-colors duration-200 hover:text-ink sm:inline"
          >
            Entrar
          </Link>
          <a
            href="#contacto"
            className="press-spring rounded-full bg-peach px-5 py-2 text-sm font-medium text-ink shadow-[0_8px_20px_-6px_rgba(17,17,17,0.25)] transition-colors duration-200 hover:bg-peach/85"
          >
            Hablemos →
          </a>
        </div>
      </div>
    </header>
  );
}
