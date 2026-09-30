export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-void">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-xs text-white/40 md:flex-row md:items-center md:justify-between">
        <span>© {new Date().getFullYear()} ReserveOS. Todos los derechos reservados.</span>
        <span>Guatemala, C.A.</span>
      </div>
    </footer>
  );
}
