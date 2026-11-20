"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

export type ItemNav = { href: string; label: string };
export type AreaNav = { id: string; titulo: string; items: ItemNav[]; badge?: number };

// Propuesta de diseño: un rail estable de pocos destinos (áreas), ruta activa marcada y, dentro del área, sus pantallas como pestañas.
export default function PanelShell({
  areas, marca, estudio, alcance, usuario, variosEstudios, salir, avisos, children,
}: {
  areas: AreaNav[]; marca: { logo: string | null } | null; estudio: string; alcance: string;
  usuario: { nombre: string; rol: string }; variosEstudios: boolean; salir: () => Promise<void>; avisos: string[]; children: ReactNode;
}) {
  const ruta = usePathname() ?? "";
  // El cajón se cierra solo al cambiar de ruta: se guarda la ruta en la que se abrió.
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null);
  const abierto = abiertoEn === ruta;
  const setAbierto = (v: boolean) => setAbiertoEn(v ? ruta : null);

  // La pantalla activa es la de enlace más largo que coincide (p. ej. /panel/finanzas/registro antes que /panel/finanzas).
  const todos = areas.flatMap((a) => a.items.map((i) => ({ ...i, area: a.id })));
  const activa = todos.filter((i) => ruta === i.href || ruta.startsWith(i.href + "/")).sort((x, y) => y.href.length - x.href.length)[0];
  const areaActiva = areas.find((a) => a.id === activa?.area);
  const iniciales = usuario.nombre.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";

  const Marca = (
    <Link href="/panel/hoy" className="flex items-center gap-2.5" aria-label={`${estudio}, inicio`}>
      {marca?.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={marca.logo} alt={`Logo de ${estudio}`} className="h-8 w-auto max-w-[9.5rem] object-contain" />
      ) : (
        <>
          <span aria-hidden className="grid h-7 w-7 place-items-center bg-ink text-[17px] font-bold leading-none text-void">r.</span>
          <span className="text-[22px] font-bold tracking-[-0.06em] text-ink">ReserveOS</span>
        </>
      )}
    </Link>
  );

  const Lista = (
    <nav aria-label="Áreas del panel" className="grid gap-0.5">
      {areas.map((a) => {
        const on = a.id === areaActiva?.id;
        return (
          <Link key={a.id} href={a.items[0].href} aria-current={on ? "page" : undefined}
            className={`press-spring relative flex min-h-[42px] items-center justify-between px-2.5 text-[14px] ${on ? "bg-[#e5e8e5] font-semibold text-ink" : "text-[#545b58] hover:bg-ink/5 hover:text-ink"}`}>
            {on && <span aria-hidden className="absolute -left-[23px] h-5 w-[3px] bg-lime" />}
            {a.titulo}
            {a.badge ? <small aria-label={`${a.badge} por revisar`} className="min-w-[19px] rounded-[3px] bg-peach-tint px-1.5 py-px text-center text-[10px] font-semibold text-lime">{a.badge}</small> : null}
          </Link>
        );
      })}
    </nav>
  );

  const Persona = (
    <div className="mt-auto border-t border-line pt-4">
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="grid h-8 w-8 place-items-center border border-line bg-neutral-tint text-[11px] font-semibold text-ink">{iniciales}</span>
        <span className="min-w-0 text-[12px]"><b className="block truncate text-ink">{usuario.nombre}</b><span className="text-ink-soft">{usuario.rol}</span></span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-soft">
        {variosEstudios && <Link href="/elegir-panel" className="underline hover:text-ink">Cambiar estudio</Link>}
        <form action={salir}><button className="underline hover:text-ink">Cerrar sesión</button></form>
      </div>
    </div>
  );

  return (
    <div className="ro-workspace-body min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="ro-workspace-side sticky top-0 hidden h-screen flex-col border-r border-line px-[23px] py-7 md:flex">
        {Marca}
        <p className="mb-7 ml-[38px] mt-1 text-[10px] uppercase tracking-[0.14em] text-ink-soft">Menos fricción. Más movimiento.</p>
        {Lista}
        {Persona}
      </aside>

      <div className="min-w-0">
        <header className="ro-workspace-bar flex min-h-[64px] items-center gap-4 border-b border-line px-5 md:min-h-[76px] md:px-10">
          <button type="button" className="press-spring grid h-10 w-10 place-items-center border border-line md:hidden" aria-expanded={abierto} aria-controls="drawer-panel" aria-label="Abrir el menú" onClick={() => setAbierto(true)}>
            <span aria-hidden className="grid gap-1"><i className="block h-px w-4 bg-ink" /><i className="block h-px w-4 bg-ink" /><i className="block h-px w-4 bg-ink" /></span>
          </button>
          <div className="flex min-w-0 items-center gap-3.5">
            <b className="truncate text-[14px] text-ink">{estudio}</b>
            <span aria-hidden className="hidden h-[22px] w-px bg-line sm:block" />
            <span className="hidden text-[12px] text-ink-soft sm:block">{alcance}</span>
          </div>
          <span className="ml-auto hidden items-center gap-1.5 text-[12px] text-ink-soft sm:flex"><i aria-hidden className="h-[5px] w-[5px] rounded-full bg-good" />{usuario.rol}</span>
          <form action={salir} className="ml-auto sm:ml-0"><button className="press-spring border border-line px-3 py-2 text-[12px] font-medium text-ink hover:border-ink/40">Cerrar sesión</button></form>
        </header>

        {avisos.length > 0 && (
          <div className="border-b border-line bg-warn-wash px-5 py-3 text-sm text-warn md:px-10" role="status">
            {avisos.map((t, i) => <p key={i}>{t}</p>)}
          </div>
        )}

        {areaActiva && areaActiva.items.length > 1 && (
          <nav aria-label={`Pantallas de ${areaActiva.titulo}`} className="ro-workspace-tabs flex gap-1 overflow-x-auto border-b border-line px-3 md:px-9">
            {areaActiva.items.map((i) => {
              const on = i.href === activa?.href;
              return (
                <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined}
                  className={`shrink-0 border-b-2 px-3 py-3 text-[13px] transition-colors duration-150 ${on ? "border-lime font-semibold text-ink" : "border-transparent text-ink-soft hover:text-ink"}`}>{i.label}</Link>
              );
            })}
          </nav>
        )}

        <section className="ro-workspace-heading" aria-label="Área actual">
          <div>
            <span className="ro-workspace-eyebrow">RESERVEOS / PANEL DE ESTUDIO / {areaActiva?.titulo ?? "OPERACIÓN"}</span>
            <h1 className="ro-workspace-title">{activa?.label ?? areaActiva?.titulo ?? "Panel"}</h1>
            <p className="ro-workspace-subtitle">{estudio} · {alcance} · {usuario.rol}</p>
          </div>
          <nav className="ro-workspace-quick" aria-label="Accesos de esta área">
            {(areaActiva?.items ?? []).filter(i => i.href !== activa?.href).slice(0,3).map(i=>(
              <Link href={i.href} key={i.href}>{i.label} <span aria-hidden="true">↗</span></Link>
            ))}
          </nav>
        </section>
        <div className="ro-route-content" key={ruta}>{children}</div>
      </div>

      {abierto && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menú del panel" id="drawer-panel">
          <button aria-label="Cerrar el menú" className="absolute inset-0 bg-ink/40" onClick={() => setAbierto(false)} />
          <div className="menu-in absolute inset-y-0 left-0 flex w-[86%] max-w-[320px] flex-col overflow-y-auto bg-void px-5 py-6">
            <div className="mb-6 flex items-center justify-between">{Marca}<button className="press-spring px-2 py-1 text-sm text-ink-soft" onClick={() => setAbierto(false)}>Cerrar</button></div>
            <div className="grid gap-5">
              {areas.map((a) => (
                <div key={a.id}>
                  <p className="px-2 text-[10px] uppercase tracking-[0.12em] text-ink-soft">{a.titulo}</p>
                  <div className="mt-1 grid">
                    {a.items.map((i) => <Link key={i.href} href={i.href} className={`px-2 py-2.5 text-[15px] ${i.href === activa?.href ? "font-semibold text-ink" : "text-ink/75"}`}>{i.label}</Link>)}
                  </div>
                </div>
              ))}
            </div>
            {Persona}
          </div>
        </div>
      )}
    </div>
  );
}
