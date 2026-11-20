"use client";

// Gráficas del panel: SVG propio, sin dependencias. Toman el color de la marca del estudio (--color-lime).
// Cada una tiene hover (cruz + etiqueta), teclado (flechas) y respeta «reducir movimiento».
import { useId, useMemo, useRef, useState } from "react";
import { aplicar, num, type Formato } from "./formato";

const MARCA = "var(--color-lime)";
const SOFT = "color-mix(in srgb, var(--color-ink) 16%, transparent)";

export function nice(v: number) {
  if (v <= 0) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 4 ? 4 : f <= 5 ? 5 : 10) * p;
}

type Punto = { etiqueta: string; valor: number; extra?: number };

function Tip({ x, y, izq, children }: { x: number; y: number; izq: boolean; children: React.ReactNode }) {
  return (
    <div role="status" className="pointer-events-none absolute z-10 min-w-28 border border-line bg-void-card px-3 py-2 text-[12px] text-ink shadow-[0_6px_20px_-8px_rgba(20,30,40,.35)]"
      style={{ left: `${x}%`, top: `${Math.max(y, 6)}%`, transform: `translate(${izq ? "calc(-100% - 12px)" : "12px"}, -50%)` }}>{children}</div>
  );
}

// ── Tendencia: columnas (serie principal) + línea opcional (serie secundaria), un solo eje ──
export function Tendencia({ puntos, nombre, nombreExtra, formato: fmt, alto = 220 }: { puntos: Punto[]; nombre: string; nombreExtra?: string; formato?: Formato; alto?: number }) {
  const formato = (n: number) => aplicar(fmt, n);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState<number | null>(null);
  const W = 720, H = alto, L = fmt === "quetzales" ? 64 : 40, R = 8, T = 12, B = 26;
  const n = puntos.length;
  const max = useMemo(() => nice(Math.max(1, ...puntos.map((p) => Math.max(p.valor, p.extra ?? 0)))), [puntos]);
  const paso = (W - L - R) / Math.max(n, 1);
  const x = (k: number) => L + paso * k + paso / 2;
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const ancho = Math.max(Math.min(paso - 2, 18), 2);
  const linea = puntos.some((p) => p.extra !== undefined) ? puntos.map((p, k) => `${k ? "L" : "M"}${x(k).toFixed(1)},${y(p.extra ?? 0).toFixed(1)}`).join(" ") : null;
  const marcas = [0, 1, 2, 3, 4].map((t) => (max * t) / 4);
  const cada = Math.ceil(n / 6);

  function mover(e: React.PointerEvent) {
    const r = ref.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setI(Math.min(n - 1, Math.max(0, Math.floor((px - L) / paso))));
  }
  const sel = i !== null ? puntos[i] : null;
  return (
    <div>
      <div ref={ref} className="relative" onPointerMove={mover} onPointerLeave={() => setI(null)}
        tabIndex={0} role="img" aria-label={`${nombre}: gráfica de ${n} puntos. Usa las flechas para recorrerla.`}
        onKeyDown={(e) => { if (e.key === "ArrowRight") setI((v) => Math.min(n - 1, (v ?? -1) + 1)); if (e.key === "ArrowLeft") setI((v) => Math.max(0, (v ?? n) - 1)); if (e.key === "Escape") setI(null); }}
        onBlur={() => setI(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" aria-hidden>
          {marcas.map((m) => (
            <g key={m}>
              <line x1={L} x2={W - R} y1={y(m)} y2={y(m)} stroke={SOFT} strokeWidth={1} strokeDasharray={m === 0 ? undefined : "2 4"} />
              <text x={L - 8} y={y(m) + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-soft)">{formato(m)}</text>
            </g>
          ))}
          {puntos.map((p, k) => (
            <rect key={k} x={x(k) - ancho / 2} width={ancho} y={y(p.valor)} height={Math.max(y(0) - y(p.valor), p.valor > 0 ? 2 : 0)} rx={2}
              fill={MARCA} opacity={i === null || i === k ? 1 : 0.4} className="barra-in" style={{ transformOrigin: `${x(k)}px ${y(0)}px`, animationDelay: `${Math.min(k * 8, 300)}ms` }} />
          ))}
          {linea && <path d={linea} fill="none" stroke="var(--color-bad)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
          {i !== null && <line x1={x(i)} x2={x(i)} y1={T} y2={y(0)} stroke="var(--color-ink)" strokeWidth={1} opacity={0.35} />}
          {linea && i !== null && <circle cx={x(i)} cy={y(sel?.extra ?? 0)} r={4} fill="var(--color-bad)" stroke="var(--color-void-card)" strokeWidth={2} />}
          {puntos.map((p, k) => (k % cada === 0 ? <text key={k} x={x(k)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--color-ink-soft)">{p.etiqueta}</text> : null))}
        </svg>
        {sel && i !== null && (
          <Tip x={(x(i) / W) * 100} y={(y(sel.valor) / H) * 100} izq={i > n * 0.6}>
            <b className="block text-[11px] font-medium text-ink-soft">{sel.etiqueta}</b>
            <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-[2px]" style={{ background: MARCA }} />{nombre}: <b className="tabular">{formato(sel.valor)}</b></span>
            {nombreExtra && sel.extra !== undefined && <span className="flex items-center gap-2"><i className="h-[2px] w-2 bg-bad" />{nombreExtra}: <b className="tabular">{formato(sel.extra)}</b></span>}
          </Tip>
        )}
      </div>
      <p id={id} className="mt-2 flex flex-wrap items-center gap-x-4 text-[12px] text-ink-soft">
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-[2px]" style={{ background: MARCA }} />{nombre}</span>
        {nombreExtra && linea && <span className="flex items-center gap-1.5"><i className="h-[2px] w-3 bg-bad" />{nombreExtra}</span>}
      </p>
    </div>
  );
}

// ── Barras horizontales con valor y hover ──
export function BarrasH({ filas, formato: fmt, max, vacio = "Sin datos todavía." }: { filas: { nombre: string; detalle?: string; valor: number; texto?: string }[]; formato?: Formato; max?: number; vacio?: string }) {
  const formato = (n: number) => aplicar(fmt, n);
  const tope = max ?? Math.max(1, ...filas.map((f) => f.valor));
  const [h, setH] = useState<number | null>(null);
  if (!filas.length) return <p className="py-6 text-[13px] text-ink-soft">{vacio}</p>;
  return (
    <ul className="space-y-1.5">
      {filas.map((f, k) => (
        <li key={f.nombre + k} onPointerEnter={() => setH(k)} onPointerLeave={() => setH(null)} className="group">
          <div className="flex items-baseline justify-between gap-3 text-[12px]">
            <span className="min-w-0 truncate text-ink">{f.nombre}{f.detalle ? <span className="text-ink-soft"> · {f.detalle}</span> : null}</span>
            <b className="tabular shrink-0 text-ink">{f.texto ?? formato(f.valor)}</b>
          </div>
          <div className="mt-1 h-2 bg-ink/[0.06]" role="img" aria-label={`${f.nombre}: ${f.texto ?? formato(f.valor)}`}>
            <div className="h-full origin-left rounded-r-[2px] barra-h-in transition-[opacity] duration-150" style={{ width: `${Math.max((f.valor / tope) * 100, f.valor > 0 ? 1.5 : 0)}%`, background: MARCA, opacity: h === null || h === k ? 1 : 0.45, animationDelay: `${k * 35}ms` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── Mapa de calor día × hora ──
const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export function Calor({ celdas }: { celdas: { dow: number; hora: number; n: number }[] }) {
  const [t, setT] = useState<{ dow: number; hora: number; n: number; x: number; y: number } | null>(null);
  if (!celdas.length) return <p className="py-6 text-[13px] text-ink-soft">Aún no hay reservas en este periodo.</p>;
  const horas = Array.from(new Set(celdas.map((c) => c.hora))).sort((a, b) => a - b);
  const desde = horas[0], hasta = horas[horas.length - 1];
  const rango = Array.from({ length: hasta - desde + 1 }, (_, k) => desde + k);
  const max = Math.max(...celdas.map((c) => c.n));
  const val = (d: number, h: number) => celdas.find((c) => c.dow === d && c.hora === h)?.n ?? 0;
  const orden = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div className="relative overflow-x-auto" onPointerLeave={() => setT(null)}>
      <table className="w-full min-w-[420px] border-separate border-spacing-[2px] text-[11px]" aria-label="Reservas por día y hora">
        <thead><tr><th className="w-9" />{rango.map((h) => <th key={h} scope="col" className="tabular pb-1 text-center font-normal text-ink-soft">{String(h).padStart(2, "0")}</th>)}</tr></thead>
        <tbody>
          {orden.map((d) => (
            <tr key={d}>
              <th scope="row" className="pr-2 text-left font-normal text-ink-soft">{DIAS[d]}</th>
              {rango.map((h) => {
                const n = val(d, h);
                return (
                  <td key={h} onPointerEnter={(e) => { const r = (e.currentTarget.offsetParent as HTMLElement).getBoundingClientRect(); const c = e.currentTarget.getBoundingClientRect(); setT({ dow: d, hora: h, n, x: c.left - r.left + c.width / 2, y: c.top - r.top }); }}
                    className="h-7 min-w-5 text-center transition-transform duration-100 hover:scale-110"
                    style={{ background: n === 0 ? "color-mix(in srgb, var(--color-ink) 5%, transparent)" : `color-mix(in srgb, var(--color-lime) ${Math.round(18 + (n / max) * 82)}%, var(--color-void-card))`, color: n / max > 0.55 ? "#fff" : "var(--color-ink)" }}>
                    {n > 0 ? n : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {t && <div role="status" className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[115%] whitespace-nowrap border border-line bg-void-card px-2.5 py-1.5 text-[12px] text-ink shadow-[0_6px_20px_-8px_rgba(20,30,40,.35)]" style={{ left: t.x, top: t.y }}>{DIAS[t.dow]} {String(t.hora).padStart(2, "0")}:00 · <b className="tabular">{t.n}</b> {t.n === 1 ? "reserva" : "reservas"}</div>}
    </div>
  );
}

// ── Mini tendencia para las tarjetas de cifra ──
export function Mini({ valores }: { valores: number[] }) {
  const W = 120, H = 32, max = Math.max(1, ...valores);
  if (valores.length < 2) return null;
  const d = valores.map((v, k) => `${k ? "L" : "M"}${((k / (valores.length - 1)) * W).toFixed(1)},${(H - 3 - (v / max) * (H - 6)).toFixed(1)}`).join(" ");
  return <svg viewBox={`0 0 ${W} ${H}`} className="h-8 w-28" aria-hidden><path d={d} fill="none" stroke={MARCA} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

// ── Anillo de porcentaje ──
export function Anillo({ pct, etiqueta }: { pct: number | null; etiqueta: string }) {
  const r = 34, c = 2 * Math.PI * r, p = pct === null ? 0 : Math.min(100, Math.max(0, pct));
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 88 88" className="h-[88px] w-[88px] shrink-0 -rotate-90" role="img" aria-label={`${etiqueta}: ${pct === null ? "sin datos" : pct + "%"}`}>
        <circle cx="44" cy="44" r={r} fill="none" stroke={SOFT} strokeWidth="8" />
        <circle cx="44" cy="44" r={r} fill="none" stroke={MARCA} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} className="anillo-in" style={{ ["--c" as string]: c }} />
        <text x="44" y="44" transform="rotate(90 44 44)" textAnchor="middle" dominantBaseline="central" fontSize="20" fontWeight="600" fill="var(--color-ink)">{pct === null ? "—" : `${pct}%`}</text>
      </svg>
      <span className="text-[13px] text-ink-soft">{etiqueta}</span>
    </div>
  );
}
