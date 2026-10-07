import { getOwnerContext } from "@/lib/owner-context";
import { OwnerShell } from "@/components/owner/owner-shell";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { operador } = await getOwnerContext();
  const rol = (operador as { rol?: string }).rol ?? "operador";
  return <OwnerShell rol={rol} nombre={operador.nombre ?? "Operador"}>{children}</OwnerShell>;
}
