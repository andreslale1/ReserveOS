"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Info = { estado: string; coincide: boolean; email?: string; rol?: string; nombre?: string; expira_at?: string } | null;

export default function InvitarEquipoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const [cargando, setCargando] = useState(true);
  const [logueada, setLogueada] = useState(false);
  const [info, setInfo] = useState<Info>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setLogueada(!!user);
      if (user) {
        const { data, error: e } = await supabase.rpc("equipo_invitacion_por_token", { p_token: token });
        if (e) setError(e.message); else setInfo(data as Info);
      }
      setCargando(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function aceptar() {
    setEnviando(true); setError(null);
    const { error: e } = await supabase.rpc("equipo_invitacion_aceptar", { p_token: token });
    if (e) { setError(e.message); setEnviando(false); } else router.push("/owner");
  }

  const next = encodeURIComponent(`/invitar/equipo/${token}`);
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-void px-6 text-white">
      <h1 className="text-2xl font-semibold">Invitación al equipo de ReserveOS</h1>
      <div role="status" aria-live="polite" className="mt-4 text-sm">
        {cargando && <p className="text-white/60">Cargando…</p>}
        {!cargando && !logueada && (
          <>
            <p className="text-white/70">Inicia sesión (o crea tu cuenta) con el mismo correo al que llegó la invitación para continuar.</p>
            <Link href={`/login?next=${next}`} className="mt-4 inline-block rounded-full bg-lime px-5 py-2 font-semibold text-void">Iniciar sesión</Link>
          </>
        )}
        {!cargando && logueada && !info && !error && <p className="text-red-300">Esta invitación no existe.</p>}
        {info && !info.coincide && <p className="text-red-300">Esta invitación es para otro correo. Cierra sesión e ingresa con el correo invitado.</p>}
        {info?.coincide && info.estado !== "pendiente" && <p className="text-red-300">Esta invitación está {info.estado === "vencida" ? "vencida: pide una nueva" : info.estado === "aceptada" ? "ya aceptada" : "revocada"}.</p>}
        {info?.coincide && info.estado === "pendiente" && (
          <>
            <p className="text-white/70">Te invitan como <strong className="text-lime">{info.rol}</strong> ({info.email}).</p>
            <button onClick={aceptar} disabled={enviando} className="mt-4 rounded-full bg-lime px-5 py-2 font-semibold text-void disabled:opacity-50">{enviando ? "Aceptando…" : "Aceptar invitación"}</button>
          </>
        )}
        {error && <p role="alert" className="mt-3 text-red-300">{error}</p>}
      </div>
    </main>
  );
}
