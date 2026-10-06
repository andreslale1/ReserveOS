import Link from "next/link";
import ContactoForm from "./contacto-form";

export const metadata = { title: "Pide una demo | ReserveOS" };

export default async function ContactoPage({ searchParams }: { searchParams: Promise<{ fuente?: string }> }) {
  const { fuente } = await searchParams;
  return (
    <main className="min-h-screen bg-cream px-6 py-12">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="text-sm text-ink/60 hover:text-ink">← ReserveOS</Link>
        <h1 className="mt-4 font-serif text-3xl text-ink">Pide una demo</h1>
        <p className="mt-2 text-ink/70">Cuéntanos de tu gimnasio o estudio. Te respondemos el mismo día hábil.</p>
        <ContactoForm fuente={(fuente ?? "web").slice(0, 40)} />
      </div>
    </main>
  );
}
