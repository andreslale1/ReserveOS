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
        className="w-full rounded-lg border border-white/25 bg-void px-3 py-2 text-sm text-white placeholder:text-white/50 outline-none focus-visible:ring-2 focus-visible:ring-lime/60" />
      {abierto && q.trim().length >= 2 && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 z-50 mt-1 max-h-80 overflow-auto rounded-lg border border-white/20 bg-void-card py-1 shadow-xl">
          {buscando && res.length === 0 && <li className="px-3 py-2 text-xs text-white/65" role="presentation">Buscando…</li>}
          {!buscando && res.length === 0 && <li className="px-3 py-2 text-xs text-white/65" role="presentation">Sin resultados para «{q}».</li>}
          {res.map((r, i) => (
            <li key={r.tipo + r.id} id={`${listId}-${i}`} role="option" aria-selected={i === activo} onMouseDown={(e) => { e.preventDefault(); ir(r); }}
              className={`cursor-pointer px-3 py-2 text-sm ${i === activo ? "bg-white/10" : "hover:bg-white/5"}`}>
              <span className="block truncate text-white">{r.titulo}</span>
              <span className="block truncate text-xs text-white/60">{r.tipo} · {r.detalle}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function OwnerShell({ rol, nombre, children }: { rol: string; nombre: string; children: React.ReactNode }) {
  const ruta = usePathname();
  const [menu, setMenu] = useState(false);
  const [sesion, setSesion] = useState(false);
  useEffect(() => { setMenu(false); setSesion(false); }, [ruta]);
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
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-white/55">{g.titulo}</p>
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {g.enlaces.map((l) => {
              const on = activa(l.href);
              return (
                <li key={l.href}>
                  <Link href={l.href} aria-current={on ? "page" : undefined}
                    className={`block rounded-lg px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-lime/70 ${on ? "bg-lime/15 font-semibold text-lime" : "text-white/80 hover:bg-white/5 hover:text-white"}`}>{l.label}</Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-void text-white lg:flex">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[60] focus:rounded focus:bg-lime focus:px-3 focus:py-2 focus:text-void">Saltar al contenido</a>

      {/* Barra superior (móvil y tablet) */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-white/15 bg-void-card px-4 py-3 lg:hidden">
        <button type="button" aria-expanded={menu} aria-controls="owner-menu-movil" aria-label={menu ? "Cerrar menú" : "Abrir menú"} onClick={() => setMenu(!menu)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/25 text-white focus-visible:ring-2 focus-visible:ring-lime/70">
          <span aria-hidden className="text-lg leading-none">{menu ? "✕" : "☰"}</span>
        </button>
        <Link href="/owner/direccion" className="text-sm font-semibold">ReserveOS · Operador</Link>
      </header>
      {menu && (
        <div id="owner-menu-movil" className="fixed inset-0 top-[57px] z-30 overflow-auto bg-void p-4 lg:hidden">
          <div className="mb-4"><Busqueda /></div>
          {navegacion}
          <div className="mt-6 border-t border-white/15 pt-4 text-sm"><p className="text-white/80">{nombre} · {rol}</p>
            <form action={salir}><button className="mt-2 rounded-full border border-white/25 px-4 py-2 text-sm text-white">Cerrar sesión</button></form></div>
        </div>
      )}

      {/* Barra lateral (escritorio) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-5 overflow-y-auto border-r border-white/15 bg-void-card p-4 lg:flex">
        <Link href="/owner/direccion" className="flex items-center gap-3 px-2 pt-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lime text-sm font-black text-void" aria-hidden>R</span>
          <span className="text-sm font-semibold">ReserveOS · Operador</span>
        </Link>
        <Busqueda />
        {navegacion}
        <div className="relative mt-auto">
          <button type="button" aria-expanded={sesion} aria-haspopup="menu" onClick={() => setSesion(!sesion)}
            className="flex w-full items-center justify-between rounded-lg border border-white/20 px-3 py-2 text-left text-sm text-white focus-visible:ring-2 focus-visible:ring-lime/70">
            <span className="min-w-0"><span className="block truncate">{nombre}</span><span className="block text-xs text-white/60">{rol}</span></span><span aria-hidden>▾</span>
          </button>
          {sesion && (
            <div role="menu" className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border border-white/20 bg-void p-1">
              <form action={salir}><button role="menuitem" className="w-full rounded-md px-3 py-2 text-left text-sm text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-lime/70">Cerrar sesión</button></form>
            </div>
          )}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <Breadcrumbs />
        <div id="contenido" tabIndex={-1}>{children}</div>
      </div>
    </div>
  );
}
