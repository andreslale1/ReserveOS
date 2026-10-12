"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Estado = "buscando" | "listo" | "expirado" | "hecho";

export default function RestablecerPage() {
  const [estado, setEstado] = useState<Estado>("buscando");
  const [password, setPassword] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // El cliente intercambia solo el código del enlace; si pasados unos segundos no hay sesión, el enlace venció o ya se usó.
    const { data: sub } = supabase.auth.onAuthStateChange((evento, sesion) => {
      if (sesion && (evento === "PASSWORD_RECOVERY" || evento === "SIGNED_IN")) setEstado("listo");
    });
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      setEstado((e) => (e === "buscando" ? (data.session ? "listo" : "expirado") : e));
    }, 2500);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  async function guardar(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== repetir) return setError("Las contraseñas no coinciden.");
    setCargando(true);
    const { error: err } = await createClient().auth.updateUser({ password });
    setCargando(false);
    if (err) return setError("No pudimos cambiar la contraseña. Pide un enlace nuevo e inténtalo de nuevo.");
    setEstado("hecho");
  }

  const campo = "w-full rounded-xl border border-white/10 bg-void px-4 py-2.5 text-sm text-white outline-none focus:border-lime";
  return (
    <main className="flex min-h-screen items-center justify-center bg-void px-6">
      <div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-void-card p-8">
        <h1 className="text-2xl font-black uppercase tracking-tight text-white">Nueva contraseña</h1>
        {estado === "buscando" && <p className="mt-4 text-sm text-white/60" role="status">Comprobando tu enlace…</p>}
        {estado === "expirado" && (
          <div className="mt-4 space-y-3 text-sm text-white/70" role="alert">
            <p>Este enlace venció o ya se usó. Pide uno nuevo y ábrelo desde el mismo navegador.</p>
            <Link href="/login/olvide" className="inline-block text-lime underline">Pedir un enlace nuevo</Link>
          </div>
        )}
        {estado === "listo" && (
          <form onSubmit={guardar} className="mt-4 space-y-4">
            <div>
              <label htmlFor="p1" className="mb-1.5 block text-xs font-medium text-white/60">Contraseña nueva (mínimo 8 caracteres)</label>
              <input id="p1" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={campo} />
            </div>
            <div>
              <label htmlFor="p2" className="mb-1.5 block text-xs font-medium text-white/60">Repite la contraseña</label>
              <input id="p2" type="password" required autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} className={campo} />
            </div>
            {error && <p role="alert" className="rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-300">{error}</p>}
            <button disabled={cargando} className="press-spring w-full rounded-full bg-lime py-2.5 text-sm font-bold uppercase tracking-wide text-void disabled:opacity-50">
              {cargando ? "Guardando…" : "Guardar contraseña"}
            </button>
          </form>
        )}
        {estado === "hecho" && (
          <div className="mt-4 space-y-3 text-sm text-white/70" role="status">
            <p>Listo, tu contraseña quedó cambiada.</p>
            <Link href="/login" className="inline-block text-lime underline">Entrar</Link>
          </div>
        )}
      </div>
    </main>
  );
}
