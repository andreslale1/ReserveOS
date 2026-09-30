import Link from "next/link";
import { getPanelContext, ROLE_LABEL } from "@/lib/panel-context";

const links = [
  { href: "/panel/hoy", label: "Hoy" },
  { href: "/panel/calendario", label: "Calendario" },
  { href: "/panel/clientes", label: "Clientas" },
];

export default async function PanelLayout({
  children,
}: LayoutProps<"/panel">) {
  const { membership, tenantName } = await getPanelContext();

  return (
    <div className="flex min-h-screen bg-cream">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-black/[0.06] bg-card px-4 py-6 md:flex">
        <div className="flex items-center gap-2 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-peach">
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
          <span className="font-serif text-base text-ink">ReserveOS</span>
        </div>

        <nav className="mt-8 flex flex-col gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm text-ink/70 transition-colors duration-200 hover:bg-cream hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto rounded-xl bg-cream px-3 py-3">
          <p className="text-xs font-medium text-ink">
            {membership?.nombre ?? "—"}
          </p>
          <p className="text-xs text-ink/50">
            {membership ? ROLE_LABEL[membership.role] : ""} · {tenantName}
          </p>
        </div>
      </aside>

      <div className="flex-1">{children}</div>
    </div>
  );
}
