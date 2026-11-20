"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Breadcrumbs } from "./breadcrumbs";
import { GRUPOS, NOMBRES_RUTA } from "./nav-config";
import { salir } from "./salir";

type Res = { tipo: string; id: string; titulo: string; detalle: string; href: string };

function Busqueda() {
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Res[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const [buscando, setBuscando] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    // Búsqueda con retardo: limpiar el estado al vaciar el campo es parte de la sincronización con lo escrito.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (q.trim().length < 2) { setRes([]); setBuscando(false); return; }
    const n = ++seq.current;
    setBuscando(true);
    const t = setTimeout(async () => {
      const { data } = await createClient().rpc("owner_buscar", { p_q: q });
      if (n !== seq.current) return;
      setRes((data ?? []) as Res[]); setBuscando(false); setActivo(-1);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  function ir(r: Res) { setAbierto(false); setQ(""); router.push(r.href); }
  function tecla(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActivo((a) => Math.min(a + 1, res.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActivo((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && res[activo]) { e.preventDefault(); ir(res[activo]); }
    else if (e.key === "Escape") setAbierto(false);
  }
  return (
    <div className="relative" role="search">
      <label htmlFor={`${listId}-q`} className="sr-only">Buscar estudio, oportunidad o ticket</label>
      <input id={`${listId}-q`} type="search" value={q} placeholder="Buscar estudio, oportunidad, ticket…" autoComplete="off"
        role="combobox" aria-expanded={abierto && q.trim().length >= 2} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={activo >= 0 ? `${listId}-${activo}` : undefined}
        onChange={(e) => { setQ(e.target.value); setAbierto(true); }} onFocus={() => setAbierto(true)} onBlur={() => setTimeout(() => setAbierto(false), 150)} onKeyDown={tecla}
        className="w-full rounded-lg border border-ink/25 bg-void px-3 py-2 text-sm text-ink placeholder:text-ink/50 outline-none focus-visible:ring-2 focus-visible:ring-lime/60" />
      {abierto && q.trim().length >= 2 && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 z-50 mt-1 max-h-80 overflow-auto rounded-lg border border-ink/20 bg-void-card py-1 shadow-xl">
          {buscando && res.length === 0 && <li className="px-3 py-2 text-xs text-ink/65" role="presentation">Buscando…</li>}
          {!buscando && res.length === 0 && <li className="px-3 py-2 text-xs text-ink/65" role="presentation">Sin resultados para «{q}».</li>}
          {res.map((r, i) => (
            <li key={r.tipo + r.id} id={`${listId}-${i}`} role="option" aria-selected={i === activo} onMouseDown={(e) => { e.preventDefault(); ir(r); }}
              className={`cursor-pointer px-3 py-2 text-sm ${i === activo ? "bg-ink/10" : "hover:bg-ink/5"}`}>
              <span className="block truncate text-ink">{r.titulo}</span>
              <span className="block truncate text-xs text-ink/60">{r.tipo} · {r.detalle}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function OwnerShell({ rol, nombre, children }: { rol: string; nombre: string; children: React.ReactNode }) {
  const ruta = usePathname();
  const [menuEn, setMenuEn] = useState<string | null>(null);
  const [sesionEn, setSesionEn] = useState<string | null>(null);
  const menu = menuEn === ruta;
  const sesion = sesionEn === ruta;
  const setMenu = (v: boolean) => setMenuEn(v ? ruta : null);
  const setSesion = (v: boolean) => setSesionEn(v ? ruta : null);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenu(false); setSesion(false); } };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  const primero = ruta.split("/")[2];
  const activa = (href: string) => (href === "/owner" ? !primero || !NOMBRES_RUTA[primero] : ruta === href || ruta.startsWith(href + "/"));
  const grupos = GRUPOS.map((g) => ({ ...g, enlaces: g.enlaces.filter((l) => l.roles.includes(rol)) })).filter((g) => g.enlaces.length > 0);

  const navegacion = (
    <nav aria-label="Consola de operador" className="flex flex-col gap-5">
      {grupos.map((g) => (
        <div key={g.titulo}>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-ink/55">{g.titulo}</p>
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {g.enlaces.map((l) => {
              const on = activa(l.href);
              return (
                <li key={l.href}>
                  <Link href={l.href} aria-current={on ? "page" : undefined}
                    className={`block rounded-lg px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-lime/70 ${on ? "bg-lime/15 font-semibold text-lime" : "text-ink/80 hover:bg-ink/5 hover:text-ink"}`}>{l.label}</Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="ro-workspace ro-workspace-owner min-h-screen bg-void text-ink lg:flex">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[60] focus:rounded focus:bg-lime focus:px-3 focus:py-2 focus:text-void">Saltar al contenido</a>

      {/* Barra superior (móvil y tablet) */}
      <header className="ro-workspace-bar sticky top-0 z-40 flex items-center gap-3 border-b border-ink/15 bg-void-card px-4 py-3 lg:hidden">
        <button type="button" aria-expanded={menu} aria-controls="owner-menu-movil" aria-label={menu ? "Cerrar menú" : "Abrir menú"} onClick={() => setMenu(!menu)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-ink/25 text-ink focus-visible:ring-2 focus-visible:ring-lime/70">
          <span aria-hidden className="text-lg leading-none">{menu ? "✕" : "☰"}</span>
        </button>
        <Link href="/owner/direccion" className="text-sm font-semibold">ReserveOS · Operador</Link>
      </header>
      {menu && (
        <div id="owner-menu-movil" className="fixed inset-0 top-[57px] z-30 overflow-auto bg-void p-4 lg:hidden">
          <div className="mb-4"><Busqueda /></div>
          {navegacion}
          <div className="mt-6 border-t border-ink/15 pt-4 text-sm"><p className="text-ink/80">{nombre} · {rol}</p>
            <form action={salir}><button className="mt-2 rounded-full border border-ink/25 px-4 py-2 text-sm text-ink">Cerrar sesión</button></form></div>
        </div>
      )}

      {/* Barra lateral (escritorio) */}
      <aside className="ro-workspace-side sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-5 overflow-y-auto border-r border-ink/15 bg-void-card p-4 lg:flex">
        <Link href="/owner/direccion" className="flex items-center gap-3 px-2 pt-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lime text-sm font-black text-void" aria-hidden>R</span>
          <span className="text-sm font-semibold">ReserveOS · Operador</span>
        </Link>
        <Busqueda />
        {navegacion}
        <div className="relative mt-auto">
          <button type="button" aria-expanded={sesion} aria-haspopup="menu" onClick={() => setSesion(!sesion)}
            className="flex w-full items-center justify-between rounded-lg border border-ink/20 px-3 py-2 text-left text-sm text-ink focus-visible:ring-2 focus-visible:ring-lime/70">
            <span className="min-w-0"><span className="block truncate">{nombre}</span><span className="block text-xs text-ink/60">{rol}</span></span><span aria-hidden>▾</span>
          </button>
          {sesion && (
            <div role="menu" className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border border-ink/20 bg-void p-1">
              <form action={salir}><button role="menuitem" className="w-full rounded-md px-3 py-2 text-left text-sm text-ink hover:bg-ink/10 focus-visible:ring-2 focus-visible:ring-lime/70">Cerrar sesión</button></form>
            </div>
          )}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <Breadcrumbs />
        <section className="ro-workspace-heading ro-workspace-masthead" aria-label="Sección de la consola">
          <div>
            <span className="ro-workspace-eyebrow">RESERVEOS / CONSOLA DE PLATAFORMA / {(NOMBRES_RUTA[primero] ?? "ESTUDIOS").toUpperCase()}</span>
            <h1 className="ro-workspace-title">{NOMBRES_RUTA[primero] ?? "Estudios"}</h1>
            <p className="ro-workspace-subtitle">Gestión central · {rol} · {nombre}</p>
          </div>
          <nav className="ro-workspace-quick" aria-label="Accesos rápidos autorizados">
            {grupos.flatMap(g=>g.enlaces).filter(l=>!activa(l.href)).slice(0,3).map(l=><Link href={l.href} key={l.href}>{l.label} <span aria-hidden="true">↗</span></Link>)}
          </nav>
        </section>
        <div className="ro-route-content" id="contenido" tabIndex={-1} key={ruta}>{children}</div>
      </div>
    </div>
  );
}
