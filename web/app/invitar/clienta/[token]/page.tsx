"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Invitacion = {
  cliente_id: string;
  tenant_name: string;
  email: string | null;
  nombre: string;
  usado: boolean;
};

export default function InvitarClientaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [inv, setInv] = useState<Invitacion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [password, setPassword] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reclamando, setReclamando] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("invitacion_clienta_por_token", {
        p_token: token,
      });
      const row = (data ?? [])[0] as Invitacion | undefined;
      setInv(row ?? null);
      setCargando(false);

      if (row && !row.usado && row.email) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user && user.email?.toLowerCase() === row.email.toLowerCase()) {
          setReclamando(true);
          const { error: rpcError } = await supabase.rpc(
            "reclamar_invitacion_clienta",
            { p_token: token },
          );
          if (rpcError) {
            setError(rpcError.message);
            setReclamando(false);
          } else {
            router.push("/reservar");
          }
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function crearCuenta() {
    setError(null);
    const { error: signUpError } = await supabase.auth.signUp({
      email: inv!.email!,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/invitar/clienta/${token}`,
      },
    });
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    setEnviado(true);
  }

  if (cargando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-void text-white/60">
        Cargando…
      </main>
    );
  }

  if (!inv) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-void px-6 text-center text-white">
        Esta invitación no existe o el link está incompleto.
      </main>
    );
  }

  if (!inv.email) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-void px-6 text-center text-white">
        Tu ficha no tiene un correo registrado todavía — pedile al estudio
        que lo agregue antes de activar tu acceso.
      </main>
    );
  }

  if (inv.usado) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-void px-6 text-center">
        <div>
          <p className="text-white">Este link ya fue usado.</p>
          <a href="/login" className="mt-4 inline-block text-sm text-lime underline">
            Ir a iniciar sesión
          </a>
        </div>
      </main>
    );
  }

  if (reclamando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-void text-white/60">
        Activando tu acceso…
      </main>
    );
  }

  if (enviado) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-void px-6 text-center">
        <div className="max-w-sm">
          <p className="text-white">
            Te mandamos un correo a <strong>{inv.email}</strong>.
          </p>
          <p className="mt-2 text-sm text-white/60">
            Abrí el link que te llegó para confirmar tu cuenta — al volver
            acá vas a poder reservar tus clases en {inv.tenant_name}.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-void px-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-void-card p-8">
        <p className="text-xs font-medium uppercase tracking-wide text-lime">
          {inv.tenant_name}
        </p>
        <h1 className="mt-2 text-xl font-bold text-white">
          Activá tu acceso, {inv.nombre}
        </h1>
        <p className="mt-2 text-sm text-white/50">{inv.email}</p>

        <label className="mt-6 block text-sm text-white/60">
          Elegí tu contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            className="mt-1 w-full rounded-lg border border-white/15 bg-void px-3 py-2 text-white outline-none focus:border-lime/50"
          />
        </label>

        <button
          onClick={crearCuenta}
          disabled={password.length < 6}
          className="press-spring mt-6 w-full rounded-full bg-lime px-6 py-3 text-sm font-bold uppercase tracking-wide text-void disabled:opacity-50"
        >
          Activar mi cuenta
        </button>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>
    </main>
  );
}
