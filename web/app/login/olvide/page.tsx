"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function OlvidePage() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    setCargando(true);
    // Siempre se muestra el mismo mensaje: no se revela si el correo tiene cuenta o no.
    await createClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/login/restablecer` });
    setCargando(false);
    setEnviado(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-void px-6">
      <div className="w-full max-w-sm rounded-[2rem] border border-ink/10 bg-void-card p-8">
        <h1 className="text-2xl font-black uppercase tracking-tight text-ink">Recuperar acceso</h1>
        {enviado ? (
          <div className="mt-4 space-y-4 text-sm text-ink/70" role="status">
            <p>Si ese correo tiene una cuenta, te enviamos un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.</p>
            <p className="text-xs text-ink/50">El enlace vence en poco tiempo y solo sirve una vez.</p>
            <Link href="/login" className="inline-block text-lime underline">Volver a entrar</Link>
          </div>
        ) : (
          <form onSubmit={enviar} className="mt-4 space-y-4">
            <p className="text-sm text-ink/55">Escribe el correo con el que te registraste.</p>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-ink/60">Correo</label>
              <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-ink/10 bg-void px-4 py-2.5 text-sm text-ink outline-none focus:border-lime" />
            </div>
            <button disabled={cargando || !email.trim()} className="press-spring w-full rounded-full bg-lime py-2.5 text-sm font-bold uppercase tracking-wide text-void disabled:opacity-50">
              {cargando ? "Enviando…" : "Enviarme el enlace"}
            </button>
            <Link href="/login" className="block text-center text-sm text-ink/55 underline hover:text-ink">Volver</Link>
          </form>
        )}
      </div>
    </main>
  );
}
