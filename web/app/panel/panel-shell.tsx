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
  const [expansion, setExpansion] = useState<{ ruta: string; id: string } | null>(null);
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

  // Los módulos son la navegación primaria. Las pestañas quedan visualmente
  // anidadas y solo se expanden en el módulo activo (o al elegir otro módulo).
  const Lista = (
    <nav aria-label="Módulos del panel" className="flex flex-col gap-1">
      {areas.map((a) => {
        const on = a.id === areaActiva?.id;
        const elegido = expansion?.ruta === ruta ? expansion.id : null;
        const expandido = elegido === a.id || (elegido === null && on);
        const panelId = `modulo-${a.id}`;
        return (
          <div key={a.id} className={`border-b border-line/70 pb-1.5 last:border-b-0 ${on ? "border-lime/40" : ""}`}>
            <div className="flex min-h-[44px] items-center gap-1">
              <Link href={a.items[0].href} aria-label={`Ir a ${a.titulo}`}
                className={`press-spring relative flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-[13px] font-bold tracking-[-0.01em] ${on ? "text-ink" : "text-[#404845] hover:text-ink"}`}>
                {on && <span aria-hidden className="absolute -left-[23px] h-5 w-[3px] bg-lime" />}
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${on ? "bg-lime" : "bg-ink/20"}`} aria-hidden />
                <span className="truncate">{a.titulo}</span>
              </Link>
              {a.badge ? <small aria-label={`${a.badge} por revisar`} className="shrink-0 rounded-[3px] bg-peach-tint px-1.5 py-px text-[10px] font-semibold text-lime">{a.badge}</small> : null}
              {a.items.length > 1 && (
                <button type="button" aria-label={`${expandido ? "Contraer" : "Expandir"} pestañas de ${a.titulo}`}
                  aria-expanded={expandido} aria-controls={panelId}
                  onClick={() => setExpansion({ ruta, id: expandido ? "" : a.id })}
                  className="grid h-9 w-9 shrink-0 place-items-center text-ink-soft hover:bg-ink/5 hover:text-ink">
                  <span aria-hidden className={`inline-block text-[14px] transition-transform duration-150 ${expandido ? "rotate-90" : ""}`}>›</span>
                </button>
              )}
            </div>
            {a.items.length > 1 && expandido && (
              <ul id={panelId} className="mb-1 ml-[13px] border-l border-line pl-3" aria-label={`Pestañas de ${a.titulo}`}>
                {a.items.map((i) => {
                  const seleccionado = i.href === activa?.href;
                  return (
                    <li key={i.href}>
                      <Link href={i.href} aria-current={seleccionado ? "page" : undefined}
                        className={`press-spring relative block py-2 pl-2 pr-1 text-[12px] leading-snug ${seleccionado ? "bg-ink/[0.055] font-semibold text-ink" : "text-ink-soft hover:bg-ink/[0.035] hover:text-ink"}`}>
                        {seleccionado && <span aria-hidden className="absolute -left-[13px] top-0 h-full w-[2px] bg-lime" />}
                        {i.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
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
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line px-[23px] py-7 md:flex">
        {Marca}
        <p className="mb-7 ml-[38px] mt-1 text-[10px] uppercase tracking-[0.14em] text-ink-soft">Menos fricción. Más movimiento.</p>
        <div className="min-h-0 flex-1 overflow-y-auto pb-5 pr-1 [scrollbar-width:thin]">
          <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Módulos</p>
          {Lista}
        </div>
        {Persona}
      </aside>

      <div className="min-w-0">
        <header className="flex min-h-[64px] items-center gap-4 border-b border-line px-5 md:min-h-[76px] md:px-10">
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
          <nav aria-label={`Pantallas de ${areaActiva.titulo}`} className="flex gap-1 overflow-x-auto border-b border-line px-3 md:px-9">
            {areaActiva.items.map((i) => {
              const on = i.href === activa?.href;
              return (
                <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined}
                  className={`shrink-0 border-b-2 px-3 py-3 text-[13px] transition-colors duration-150 ${on ? "border-lime font-semibold text-ink" : "border-transparent text-ink-soft hover:text-ink"}`}>{i.label}</Link>
              );
            })}
          </nav>
        )}

        {children}
      </div>

      {abierto && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menú del panel" id="drawer-panel">
          <button aria-label="Cerrar el menú" className="absolute inset-0 bg-ink/40" onClick={() => setAbierto(false)} />
          <div className="menu-in absolute inset-y-0 left-0 flex w-[86%] max-w-[320px] flex-col overflow-y-auto bg-void px-5 py-6">
            <div className="mb-6 flex items-center justify-between">{Marca}<button className="press-spring px-2 py-1 text-sm text-ink-soft" onClick={() => setAbierto(false)}>Cerrar</button></div>
            <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Módulos</p>
            <div className="grid gap-3">
              {areas.map((a) => (
                <section key={a.id} className="border-b border-line pb-3">
                  <Link href={a.items[0].href}
                    className={`block px-2 py-2 text-[14px] font-bold ${a.id === areaActiva?.id ? "text-ink" : "text-ink/75"}`}>{a.titulo}
                    {a.badge ? <span className="ml-2 text-[11px] text-lime">({a.badge})</span> : null}
                  </Link>
                  <div className="ml-3 grid border-l border-line pl-3">
                    {a.items.map((i) => <Link key={i.href} href={i.href} aria-current={i.href === activa?.href ? "page" : undefined}
                      className={`px-2 py-2 text-[13px] ${i.href === activa?.href ? "border-l-2 border-lime bg-ink/5 font-semibold text-ink" : "text-ink/65"}`}>{i.label}</Link>)}
                  </div>
                </section>
              ))}
            </div>
            {Persona}
          </div>
        </div>
      )}
    </div>
  );
}
