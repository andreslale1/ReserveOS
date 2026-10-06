"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { importar, type Resultado } from "./actions";

type Fila = { nombre: string; telefono: string; email: string };

// Lector de CSV simple: comillas, comas y punto y coma; detecta la fila de encabezados.
function leerCsv(texto: string): Fila[] {
  const lineas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lineas.length === 0) return [];
  const sep = (lineas[0].match(/;/g) ?? []).length > (lineas[0].match(/,/g) ?? []).length ? ";" : ",";
  const partir = (l: string) => {
    const out: string[] = []; let cur = ""; let q = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (ch === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (ch === sep && !q) { out.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const cab = partir(lineas[0]).map((c) => c.toLowerCase());
  const idx = (...n: string[]) => cab.findIndex((c) => n.some((x) => c.includes(x)));
  const tieneCab = idx("nombre", "name") >= 0 || idx("tel", "cel") >= 0;
  const iN = tieneCab ? idx("nombre", "name") : 0, iT = tieneCab ? idx("tel", "cel", "phone") : 1, iE = tieneCab ? idx("correo", "email", "mail") : 2;
  return lineas.slice(tieneCab ? 1 : 0).map((l) => { const c = partir(l); return { nombre: c[iN] ?? "", telefono: c[iT] ?? "", email: iE >= 0 ? c[iE] ?? "" : "" }; });
}

export default function ImportarView({ tenantId }: { tenantId: string }) {
  const [isPending, startTransition] = useTransition();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [res, setRes] = useState<Resultado | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [hecho, setHecho] = useState(false);

  function cargar(file: File | undefined) {
    if (!file) return;
    setRes(null); setMsg(null); setHecho(false);
    file.text().then((t) => {
      const f = leerCsv(t);
      setFilas(f);
      if (f.length === 0) { setMsg("El archivo está vacío."); return; }
      startTransition(async () => { const r = await importar(tenantId, f, true); if (r.error) setMsg(r.error); else setRes(r.resultado); });
    });
  }
  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <Link href="/panel/clientes" className="text-sm text-ink/60 hover:text-ink">← Clientas</Link>
        <h1 className="mt-2 font-serif text-2xl text-ink md:text-3xl">Importar clientas</h1>
        <p className="mt-1 text-sm text-ink/60">Sube un CSV con columnas <strong>nombre, teléfono, correo</strong>. Primero se revisa; no se guarda nada hasta que confirmes.</p>
      </header>
      <div className="mx-auto grid max-w-3xl gap-6 px-6 py-8 md:px-10">
        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <input type="file" accept=".csv,text/csv" onChange={(e) => cargar(e.target.files?.[0])} className="text-sm text-ink" />
          <p className="mt-2 text-xs text-ink/50">Desde Excel: Archivo → Guardar como → CSV. Los teléfonos con +502, espacios o guiones se reconocen igual para detectar repetidas.</p>
        </section>
        {msg && <p className="rounded-xl bg-peach-tint px-4 py-3 text-sm text-ink">{msg}</p>}
        {res && !hecho && (
          <section className="rounded-2xl border border-white/10 bg-card p-5">
            <h2 className="text-base font-semibold text-ink">Revisión de {filas.length} filas</h2>
            <p className="mt-2 text-sm text-ink">✔ <strong>{res.validas}</strong> listas para importar · ⚠ <strong>{res.con_error}</strong> con problemas ({res.duplicadas} ya existentes o repetidas, se omiten)</p>
            {res.errores.length > 0 && (
              <ul className="mt-3 max-h-56 divide-y divide-white/10 overflow-y-auto text-sm">
                {res.errores.slice(0, 100).map((e, i) => <li key={i} className="py-1.5 text-ink/80">Fila {e.fila}{e.nombre ? ` (${e.nombre})` : ""}: {e.motivo}</li>)}
              </ul>
            )}
            <button className="press-spring mt-4 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream disabled:opacity-50" disabled={isPending || res.validas === 0}
              onClick={() => startTransition(async () => { const r = await importar(tenantId, filas, false); if (r.error) setMsg(r.error); else { setRes(r.resultado); setHecho(true); } })}>
              Importar {res.validas} clientas
            </button>
          </section>
        )}
        {res && hecho && (
          <section className="rounded-2xl border border-white/10 bg-sage-tint p-5">
            <p className="text-base font-semibold text-sage">Listo: {res.importadas} clientas importadas.</p>
            <Link href="/panel/clientes" className="mt-2 inline-block text-sm text-ink underline">Ver clientas</Link>
          </section>
        )}
      </div>
    </main>
  );
}
