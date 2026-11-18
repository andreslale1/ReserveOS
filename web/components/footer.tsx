import Link from "next/link";
import { Marca } from "./navbar";

export default function Footer() {
  return (
    <footer className="border-t border-line bg-void">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between">
        <Marca />
        <nav aria-label="Pie" className="flex gap-6 text-sm text-ink-soft">
          <Link href="/contacto" className="hover:text-ink">Pedir una demo</Link>
          <Link href="/registro" className="hover:text-ink">Abrir mi estudio</Link>
          <Link href="/login" className="hover:text-ink">Entrar</Link>
        </nav>
        <span className="text-xs text-ink-soft">© {new Date().getFullYear()} ReserveOS · Guatemala</span>
      </div>
    </footer>
  );
}
