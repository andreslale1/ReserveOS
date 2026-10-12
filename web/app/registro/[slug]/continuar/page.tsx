"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { destinoSeguro } from "@/lib/destino";

type Pendiente = { tenant_id: string; nombre: string; telefono: string; genero?: string; como?: string; ref?: string };

// Destino del enlace del correo de confirmación: cierra el alta de la clienta y la devuelve a lo que quería hacer.
export default function ContinuarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const next = destinoSeguro(useSearchParams().get("next"), "/cuenta/clases");
  const [estado, setEstado] = useState<"trabajando" | "sin-sesion" | "error">("trabajando");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    const supabase = createClient();
    let hecho = false;
    async function cerrar() {
      if (hecho) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      hecho = true;
      const p = user.user_metadata?.registro_pendiente as Pendiente | undefined;
      if (p?.tenant_id) {
        const { error } = await supabase.rpc("registrar_clienta", { p_tenant_id: p.tenant_id, p_nombre: p.nombre, p_telefono: p.telefono, p_genero: p.genero ?? null, p_codigo_referido: p.ref ?? null, p_como_se_entero: p.como ?? null, p_es_cuenta_familiar: false });
        if (error) { setMensaje(error.message); setEstado("error"); return; }
        await supabase.auth.updateUser({ data: { registro_pendiente: null } });
      }
      router.replace(next);
    }
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { if (s) void cerrar(); });
    void cerrar();
    const t = setTimeout(() => setEstado((e) => (e === "trabajando" && !hecho ? "sin-sesion" : e)), 4000);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, [next, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-void px-6">
      <div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-void-card p-8 text-sm text-white/70">
        {estado === "trabajando" && <p role="status">Terminando de crear tu cuenta…</p>}
        {estado === "sin-sesion" && (
          <div className="space-y-3" role="alert">
            <p>No pudimos abrir tu sesión desde este enlace (venció, ya se usó, o lo abriste en otro navegador). Entra con tu correo y contraseña y terminamos.</p>
            <Link href={`/login?e=${slug}&next=${encodeURIComponent(next)}`} className="inline-block text-lime underline">Entrar</Link>
          </div>
        )}
        {estado === "error" && (
          <div className="space-y-3" role="alert">
            <p>{mensaje}</p>
            <Link href={`/login?e=${slug}&next=${encodeURIComponent(next)}`} className="inline-block text-lime underline">Entrar</Link>
          </div>
        )}
      </div>
    </main>
  );
}
