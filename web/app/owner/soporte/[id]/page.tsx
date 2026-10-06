import { notFound } from "next/navigation";
import { getOwnerContext } from "@/lib/owner-context";
import TicketView, { type Detalle } from "./ticket-view";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await getOwnerContext();
  const { data, error } = await supabase.rpc("ticket_detalle", { p_id: id });
  if (error) return <main className="mx-auto max-w-3xl px-6 py-16 text-center text-white/60">{error.message}</main>;
  if (!data) notFound();
  return <TicketView d={data as Detalle} />;
}
