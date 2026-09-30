const groups = [
  {
    label: "Agenda y reservas",
    color: "sage" as const,
    items: [
      { name: "Lista de espera", desc: "Promoción automática de cupo." },
      { name: "Clases en familia", desc: "Reserva y cobro compartido." },
      { name: "Clases privadas", desc: "Privatiza una fecha para un grupo." },
      { name: "Check-in por QR", desc: "Asistencia sin lista en papel." },
    ],
  },
  {
    label: "Cobros y finanzas",
    color: "blue" as const,
    items: [
      { name: "Cobros en línea", desc: "Pasarela, checkout y webhooks." },
      { name: "Caja / POS", desc: "Apertura y cierre de caja por sede." },
      { name: "Gastos y metas", desc: "Balance del estudio, mes a mes." },
      { name: "IVA y FEL", desc: "Facturación electrónica por tenant." },
    ],
  },
  {
    label: "Clientas y marca",
    color: "peach" as const,
    items: [
      { name: "CRM y segmentos", desc: "Riesgo y seguimiento comercial." },
      { name: "Campañas", desc: "WhatsApp, email y push con consentimiento." },
      { name: "Portal con marca", desc: "reservas.tudominio.com, propio." },
      { name: "App de marca", desc: "Build nativo sobre el mismo backend." },
    ],
  },
];

const colorMap = {
  sage: "bg-sage/15 text-sage",
  blue: "bg-blue/15 text-blue",
  peach: "bg-lime/15 text-lime",
};

import Reveal from "./reveal";

export default function Modules() {
  return (
    <section
      id="modulos"
      className="border-y border-white/10 bg-void py-20"
    >
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="max-w-lg">
          <h2 className="text-3xl font-black uppercase leading-tight tracking-tight text-white md:text-4xl">
            Un núcleo sólido. Módulos que enciendes cuando los necesitas.
          </h2>
          <p className="mt-4 text-white/55">
            26 módulos activables por tenant. Empiezas con agenda, reservas y
            cobros — el resto se prende sin migrar de sistema cuando el
            estudio crece.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {groups.map((group, gi) => (
            <Reveal key={group.label} delay={gi * 100}>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${colorMap[group.color]}`}
              >
                {group.label}
              </span>
              <ul className="mt-5 space-y-4">
                {group.items.map((item) => (
                  <li
                    key={item.name}
                    className="group rounded-xl border border-white/10 bg-void-card p-4 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-lime/30"
                  >
                    <p className="text-sm font-medium text-white">
                      {item.name}
                    </p>
                    <p className="mt-1 text-xs text-white/45">{item.desc}</p>
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
