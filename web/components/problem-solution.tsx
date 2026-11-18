import Reveal from "./reveal";

const ROLES: [string, string][] = [
  ["Dueño o dueña", "Todas las sedes, finanzas, equipo, marca y cuentas de acceso."],
  ["Gerente regional", "Solo las sedes que le asignes: resultados, clientes y personal."],
  ["Administrador de sede", "Su sede: cobros, caja, clases y equipo de recepción e instructores."],
  ["Recepción", "Check-in, cobrar un paquete en segundos y buscar a una clienta."],
  ["Coach o instructora", "Sus clases, lista de asistentes y asistencia, sin ver el dinero."],
  ["Contadora", "Ingresos, gastos, IVA y reportes, sin datos personales de clientes."],
  ["Marketing", "Campañas y seguimiento de clientes, sin ver caja ni finanzas."],
  ["Cliente o atleta", "Su portal: reservar, su paquete, su historial y su QR de check-in."],
];

export default function ProblemSolution() {
  return (
    <section id="roles" className="border-t border-line bg-void-card">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-2xl">
          <h2 className="text-4xl font-semibold leading-tight text-ink md:text-5xl">Una sede o diez: cada persona ve solo lo suyo.</h2>
          <p className="mt-5 text-ink-soft">Los permisos están en la base de datos, no solo en el menú. Una recepcionista de la sede Norte no puede ver la caja de la sede Sur.</p>
        </div>
        <Reveal>
          <dl className="mt-12 divide-y divide-line border-y border-line">
            {ROLES.map(([r, d]) => (
              <div key={r} className="grid gap-1 py-4 md:grid-cols-[16rem_1fr] md:gap-8">
                <dt className="font-serif text-lg font-semibold text-ink">{r}</dt>
                <dd className="text-ink-soft">{d}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
