"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const campo = "mt-1 w-full rounded-xl border border-white/10 bg-void px-4 py-2.5 text-sm text-white outline-none focus:border-lime aria-[invalid=true]:border-red-400";

export default function RegistroForm({ tenantId, slug, nombre, color, next, referido }: { tenantId: string; slug: string; nombre: string; color: string; next: string; referido: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [f, setF] = useState({ nombre: "", telefono: "", email: "", password: "", genero: "", como: "", acepto: false, marketing: false });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [revisaCorreo, setRevisaCorreo] = useState(false);

  function validar() {
    const e: Record<string, string> = {};
    if (f.nombre.trim().length < 2) e.nombre = "Escribe tu nombre.";
    if (f.telefono.replace(/\D/g, "").length < 8) e.telefono = "Escribe un teléfono válido (con código de país si es de otro país).";
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Escribe un correo válido.";
    if (f.password.length < 8) e.password = "Mínimo 8 caracteres.";
    if (!f.acepto) e.acepto = "Necesitamos tu aceptación para crear la cuenta.";
    setErrores(e);
    if (Object.keys(e).length) { setTimeout(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus(), 0); return false; }
    return true;
  }

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    if (!validar()) return;
    setCargando(true);
    const supabase = createClient();
    const pendiente = { tenant_id: tenantId, nombre: f.nombre.trim(), telefono: f.telefono.trim(), genero: f.genero || undefined, como: f.como || undefined, ref: referido || undefined };
    const { data, error: err } = await supabase.auth.signUp({
      email: f.email.trim(), password: f.password,
      // El enlace del correo vuelve a este estudio y retoma lo que la persona quería hacer (clase, paquete, fecha).
      options: { emailRedirectTo: `${window.location.origin}/registro/${slug}/continuar?next=${encodeURIComponent(next)}`, data: { registro_pendiente: pendiente, marketing_ok: f.marketing } },
    });
    if (err) { setCargando(false); setError(/registered|already/i.test(err.message) ? "Ese correo ya tiene cuenta. Entra con tu contraseña o recupérala." : "No pudimos crear tu cuenta. Revisa los datos e inténtalo de nuevo."); return; }
    if (data.session) {
      // Sin confirmación de correo pendiente: se crea la ficha ya.
      const { error: reg } = await supabase.rpc("registrar_clienta", { p_tenant_id: tenantId, p_nombre: pendiente.nombre, p_telefono: pendiente.telefono, p_genero: pendiente.genero ?? null, p_codigo_referido: pendiente.ref ?? null, p_como_se_entero: pendiente.como ?? null, p_es_cuenta_familiar: false });
      if (reg) { setCargando(false); setError(reg.message); return; }
      await supabase.auth.updateUser({ data: { registro_pendiente: null } });
      router.push(next);
      return;
    }
    setCargando(false);
    setRevisaCorreo(true);
  }

  if (revisaCorreo) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-void px-6">
        <div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-void-card p-8 text-sm text-white/70" role="status">
          <h1 className="text-2xl font-black uppercase tracking-tight text-white">Revisa tu correo</h1>
          <p className="mt-4">Te enviamos un enlace a <strong className="text-white">{f.email}</strong> para confirmar tu cuenta en {nombre}. Al abrirlo, seguimos donde ibas.</p>
          <p className="mt-3 text-xs text-white/50">Si no llega en unos minutos, revisa spam. Si ya tenías cuenta, entra con tu contraseña.</p>
          <Link href={`/login?e=${slug}&next=${encodeURIComponent(next)}`} className="mt-5 inline-block text-lime underline">Ya confirmé: entrar</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-void px-6 py-10">
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-void-card p-8">
        <span className="inline-block h-2 w-12 rounded-full" style={{ backgroundColor: color }} aria-hidden />
        <h1 className="mt-4 text-2xl font-black uppercase tracking-tight text-white">Crear mi cuenta</h1>
        <p className="mt-1 text-sm text-white/55">{nombre} · reserva clases, compra paquetes y sigue tu cuenta.</p>
        <form ref={formRef} onSubmit={enviar} noValidate className="mt-6 space-y-4">
          <div>
            <label htmlFor="nombre" className="text-xs font-medium text-white/60">Nombre completo</label>
            <input id="nombre" autoComplete="name" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} aria-invalid={!!errores.nombre} aria-describedby={errores.nombre ? "e-nombre" : undefined} className={campo} />
            {errores.nombre && <p id="e-nombre" role="alert" className="mt-1 text-xs text-red-300">{errores.nombre}</p>}
          </div>
          <div>
            <label htmlFor="telefono" className="text-xs font-medium text-white/60">Teléfono / WhatsApp</label>
            <input id="telefono" type="tel" inputMode="tel" autoComplete="tel" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} aria-invalid={!!errores.telefono} aria-describedby={errores.telefono ? "e-tel" : undefined} className={campo} />
            {errores.telefono && <p id="e-tel" role="alert" className="mt-1 text-xs text-red-300">{errores.telefono}</p>}
          </div>
          <div>
            <label htmlFor="email" className="text-xs font-medium text-white/60">Correo</label>
            <input id="email" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} aria-invalid={!!errores.email} aria-describedby={errores.email ? "e-email" : undefined} className={campo} />
            {errores.email && <p id="e-email" role="alert" className="mt-1 text-xs text-red-300">{errores.email}</p>}
          </div>
          <div>
            <label htmlFor="password" className="text-xs font-medium text-white/60">Contraseña (mínimo 8 caracteres)</label>
            <input id="password" type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} aria-invalid={!!errores.password} aria-describedby={errores.password ? "e-pass" : undefined} className={campo} />
            {errores.password && <p id="e-pass" role="alert" className="mt-1 text-xs text-red-300">{errores.password}</p>}
          </div>
          <details className="rounded-xl border border-white/10 px-4 py-3 text-sm text-white/70">
            <summary className="cursor-pointer text-xs font-medium text-white/60">Cuéntanos más (opcional)</summary>
            <div className="mt-3 grid gap-3">
              <label className="text-xs text-white/60">Género
                <select value={f.genero} onChange={(e) => setF({ ...f, genero: e.target.value })} className={campo}>
                  <option value="">Prefiero no decirlo</option><option value="femenino">Femenino</option><option value="masculino">Masculino</option><option value="otro">Otro</option>
                </select></label>
              <label className="text-xs text-white/60">¿Cómo te enteraste de nosotras?
                <select value={f.como} onChange={(e) => setF({ ...f, como: e.target.value })} className={campo}>
                  <option value="">—</option><option value="instagram">Instagram</option><option value="whatsapp">WhatsApp</option><option value="amiga">Una amiga</option><option value="google">Google</option><option value="otro">Otro</option>
                </select></label>
            </div>
          </details>
          <div>
            <label className="flex items-start gap-2 text-xs text-white/70">
              <input type="checkbox" checked={f.acepto} onChange={(e) => setF({ ...f, acepto: e.target.checked })} aria-invalid={!!errores.acepto} aria-describedby={errores.acepto ? "e-acepto" : undefined} className="mt-0.5" />
              <span>Acepto que {nombre} guarde mis datos para gestionar mis reservas y mi cuenta, y las condiciones de uso del servicio.</span>
            </label>
            {errores.acepto && <p id="e-acepto" role="alert" className="mt-1 text-xs text-red-300">{errores.acepto}</p>}
          </div>
          <label className="flex items-start gap-2 text-xs text-white/55">
            <input type="checkbox" checked={f.marketing} onChange={(e) => setF({ ...f, marketing: e.target.checked })} className="mt-0.5" />
            <span>Quiero recibir novedades y promociones (opcional).</span>
          </label>
          {error && <p role="alert" className="rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-300">{error}</p>}
          <button disabled={cargando} className="press-spring w-full rounded-full py-2.5 text-sm font-bold uppercase tracking-wide text-void disabled:opacity-50" style={{ backgroundColor: color }}>
            {cargando ? "Creando…" : "Crear mi cuenta"}
          </button>
          <p className="text-center text-sm text-white/50">¿Ya tienes cuenta? <Link href={`/login?e=${slug}&next=${encodeURIComponent(next)}`} className="text-lime underline">Entrar</Link></p>
        </form>
      </div>
    </main>
  );
}
