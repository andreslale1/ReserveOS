import Link from "next/link";

const links = [
  { href: "#formas", label: "Cómo empezar" },
  { href: "#giros", label: "Giros" },
  { href: "#roles", label: "Equipo y sedes" },
];

export function Marca({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
        <rect x="1" y="1" width="24" height="24" rx="6" fill="var(--color-lime)" />
        <rect x="6" y="6" width="5.5" height="5.5" rx="1.2" fill="#fff" />
        <rect x="14.5" y="6" width="5.5" height="5.5" rx="1.2" fill="#fff" fillOpacity=".55" />
        <rect x="6" y="14.5" width="5.5" height="5.5" rx="1.2" fill="#fff" fillOpacity=".55" />
        <rect x="14.5" y="14.5" width="5.5" height="5.5" rx="1.2" fill="#fff" />
      </svg>
      <span className="font-serif text-lg font-semibold tracking-tight text-ink">ReserveOS</span>
    </span>
  );
}

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-void/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <Link href="/" aria-label="ReserveOS, inicio"><Marca /></Link>
        <nav aria-label="Principal" className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-ink-soft transition-colors duration-150 hover:text-ink">{l.label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="rounded-lg px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-ink/5">Entrar</Link>
          <Link href="/contacto" className="press-spring rounded-lg bg-lime px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-lime-dim">Pedir una demo</Link>
        </div>
      </div>
    </header>
  );
}
