"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Una persona que YA tiene cuenta de ReserveOS (por ejemplo en otro gimnasio) se une a este estudio sin crear otra cuenta.
export default function UnirmeForm({ tenantId, nombreEstudio, email, nombreInicial, next }: { tenantId: string; nombreEstudio: string; email: string; nombreInicial: string; next: string }) {
  const router = useRouter();
  const [nombre, setNombre] = useState(nombreInicial);
  const [telefono, setTelefono] = useState("");
  const [acepto, setAcepto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault(); setError(null);
    if (nombre.trim().length < 2) return setError("Escribe tu nombre.");
    if (telefono.replace(/\D/g, "").length < 8) return setError("Escribe un teléfono válido.");
    if (!acepto) return setError("Necesitamos tu aceptación para unirte.");
    setCargando(true);
    const { error: err } = await createClient().rpc("registrar_clienta", { p_tenant_id: tenantId, p_nombre: nombre.trim(), p_telefono: telefono.trim(), p_genero: null, p_codigo_referido: null, p_como_se_entero: null, p_es_cuenta_familiar: false });
    if (err) { setCargando(false); return setError(err.message); }
    router.push(next);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <form onSubmit={enviar} className="w-full max-w-md rounded-2xl border border-line bg-void-card p-8" noValidate>
        <h1 className="text-2xl font-semibold text-ink">Unirme a {nombreEstudio}</h1>
        <p className="mt-2 text-sm text-ink-soft">Ya tienes cuenta con <b className="text-ink">{email}</b>. Solo falta unirte a este estudio: no creas otra contraseña.</p>
        <label className="mt-6 block text-xs font-medium text-ink-soft" htmlFor="u-nombre">Nombre completo</label>
        <input id="u-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" className="mt-1 w-full rounded-lg border border-line bg-void px-4 py-2.5 text-sm text-ink" />
        <label className="mt-4 block text-xs font-medium text-ink-soft" htmlFor="u-tel">Teléfono / WhatsApp</label>
        <input id="u-tel" type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} autoComplete="tel" className="mt-1 w-full rounded-lg border border-line bg-void px-4 py-2.5 text-sm text-ink" />
        <label className="mt-4 flex items-start gap-2 text-xs text-ink-soft"><input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} className="mt-0.5" /><span>Acepto que {nombreEstudio} guarde mis datos para gestionar mis reservas y mi cuenta.</span></label>
        {error && <p role="alert" className="mt-4 rounded-lg bg-bad-wash px-3 py-2 text-xs text-bad">{error}</p>}
        <button disabled={cargando} className="press-spring mt-6 w-full rounded-lg bg-lime py-3 text-sm font-semibold text-white disabled:opacity-50">{cargando ? "Uniéndome…" : "Unirme a este estudio"}</button>
      </form>
    </main>
  );
}
