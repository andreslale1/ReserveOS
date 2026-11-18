import Link from "next/link";
import ContactoForm from "../contacto/contacto-form";

export const metadata = { title: "Abre tu estudio en ReserveOS" };

const PASOS = [
  ["Cuéntanos de tu estudio", "Llena este formulario con tu nombre y el de tu estudio."],
  ["Te enviamos la propuesta", "Plan, precio y contrato, el mismo día hábil."],
  ["Activamos tu estudio", "Recibes la invitación por correo y entras como dueña."],
];

export default function RegistroEstudioPage() {
  return (
    <main className="min-h-screen bg-cream px-6 py-12">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="text-sm text-ink/60 hover:text-ink">← ReserveOS</Link>
        <h1 className="mt-4 font-serif text-3xl text-ink">Abre tu estudio en ReserveOS</h1>
        <p className="mt-2 text-ink/70">Reservas, paquetes, caja y portal de clientas listos para operar.</p>
        <ol className="mt-6 grid gap-3">
          {PASOS.map(([t, d], i) => (
            <li key={t} className="flex gap-3 rounded-xl border border-ink/10 bg-card p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-peach text-sm font-bold text-void">{i + 1}</span>
              <span><strong className="block text-sm text-ink">{t}</strong><span className="text-sm text-ink/65">{d}</span></span>
            </li>
          ))}
        </ol>
        <ContactoForm fuente="registro" />
      </div>
    </main>
  );
}
