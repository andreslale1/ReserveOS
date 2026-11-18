"use client"

import LandingEstudio, { type LylDay } from "./landing-estudio"

// Semana de ejemplo para la demostración de reservas. No son clases ni clientes reales.
const DIAS = [
  ["Mié 18", "Miércoles 18 de noviembre"], ["Jue 19", "Jueves 19 de noviembre"], ["Vie 20", "Viernes 20 de noviembre"],
  ["Sáb 21", "Sábado 21 de noviembre"], ["Dom 22", "Domingo 22 de noviembre"], ["Lun 23", "Lunes 23 de noviembre"], ["Mar 24", "Martes 24 de noviembre"],
]
const FRANJAS = [
  { time: "06:30", name: "Pilates Reformer", note: "Sofía R. · Sede Centro", minutes: 55, capacity: 8, price: 100 },
  { time: "08:00", name: "WOD CrossFit", note: "Coach Diego · Box Norte", minutes: 60, capacity: 14, price: 90 },
  { time: "12:15", name: "HYROX · Bloque de carriles", note: "Coach Mario · Carriles 1 a 8", minutes: 60, capacity: 8, price: 110 },
  { time: "18:00", name: "Pilates Mat", note: "Paula A. · Sede Norte", minutes: 55, capacity: 10, price: 90 },
  { time: "19:30", name: "WOD CrossFit", note: "Coach Ana · Box Norte", minutes: 60, capacity: 14, price: 90 },
]
const OCUPADOS = [[6, 11, 5, 6, 13], [4, 9, 8, 10, 14], [8, 6, 3, 7, 9], [3, 5, 6, 4, 8], [2, 4, 2, 3, 5], [5, 12, 7, 8, 14], [6, 10, 4, 9, 11]]
const days: LylDay[] = DIAS.map(([label, full], d) => ({
  label, full, sessions: FRANJAS.map((f, i) => ({ ...f, id: `demo${d}${i}`, booked: OCUPADOS[d][i] })),
}))

export default function LandingReserveOS() {
  return (
    <LandingEstudio
      brand="ReserveOS"
      tagline="Reservas para gimnasios y estudios"
      ink={{ accent: "#2f5d8c", onAccent: "#ffffff" }}
      theme="light"
      themeToggle={false}
      currency="Q"
      links={[
        { label: "Reservas", href: "#sessions" },
        { label: "Giros", href: "#rooms" },
        { label: "Cómo empezar", href: "#membership" },
        { label: "Preguntas", href: "/contacto" },
      ]}
      hero={{
        title: "Tu gimnasio, reservado.",
        text: "El sistema de reservas, cobros y equipo para estudios de Pilates, CrossFit y HYROX. Con una o varias sedes y con tu propia marca.",
        cta: "Pedir una demo", ctaHref: "/contacto", secondary: "Ver cómo funciona", secondaryHref: "#sessions",
      }}
      heat={{ label: "Ocupación de hoy", base: 64, rise: 9, unit: "%", button: "Abrir las reservas", hint: "O toca cualquier punto del calor.", said: "Se abren las reservas. La ocupación sube a cerca de {n} por ciento." }}
      sessions={{
        title: "Reserva una clase, como lo haría tu cliente.",
        text: "Esta semana de ejemplo funciona igual que en tu gimnasio: elige un día, mira los lugares libres y reserva o entra a la lista de espera. Es una demostración, no una compra real.",
        days,
      }}
      rooms={{
        title: "Pilates, CrossFit y HYROX. Cada uno con sus palabras.",
        unit: "lugares",
        items: [
          { name: "Pilates", kind: "rest", temp: 8, text: "Clases con cupo por reformer o mat, instructora asignada, paquetes por número de clases y paquetes que valen en una, varias o todas las sedes.", stay: "Reserva por cupo" },
          { name: "CrossFit", kind: "heat", temp: 14, text: "WOD del día, coach, cupo por clase y membresías. Tus atletas reservan, y tú ves la asistencia de cada clase.", stay: "Reserva por cupo" },
          { name: "HYROX", kind: "cold", temp: 8, text: "Sesiones por bloque horario con carriles o estaciones numeradas. La reserva por carril está en desarrollo.", stay: "Carril o estación" },
        ],
      }}
      ritual={null}
      plans={{
        title: "Empiezas con lo que ya tienes.",
        text: "Tres formas de entrega y un solo sistema por dentro: la misma base de clientes, reservas y pagos.",
        items: [
          { name: "Link de reserva", price: 0, unit: "según tu gimnasio", text: "Montamos tu cuenta y compartes un link.", features: ["Sedes, horarios y paquetes cargados", "Acceso para tu equipo", "Portal para tus clientes", "Código QR para el estudio"], cta: "Pedir una demo", href: "/contacto" },
          { name: "Widget en tu web", price: 0, unit: "según tu gimnasio", text: "Si ya tienes página, pegas una línea de código.", features: ["Horario y paquetes dentro de tu sitio", "Con tus colores", "Tus clientes quedan en tu base de datos", "Funciona en cualquier web"], cta: "Pedir una demo", href: "/contacto", featured: true, badge: "Para tu web" },
          { name: "Web completa", price: 0, unit: "según tu gimnasio", text: "Construimos tu sitio con tu manual de marca.", features: ["Diseño con tu marca", "Reservas integradas", "En tu propio dominio", "Sedes, equipo y clientes incluidos"], cta: "Pedir una demo", href: "/contacto" },
        ],
      }}
      quotes={null}
      faq={{
        title: "Antes de empezar.",
        items: [
          { q: "¿Necesito tener página web?", a: "No. Podemos darte un link de reserva, un widget para pegar en tu web actual, o construir tu sitio completo con tu marca." },
          { q: "¿Mis clientes reservan desde el celular?", a: "Sí. Tienen un portal para reservar, ver su paquete, su historial y su código QR de entrada." },
          { q: "¿Funciona con varias sedes?", a: "Sí. Cada sede tiene sus horarios, su caja y su equipo, y el dueño ve todo el negocio. Un paquete puede valer en una, varias o todas las sedes." },
          { q: "¿Y si reservamos por carril o estación?", a: "Estamos construyendo la reserva por carril para HYROX y natación. Dinos cómo trabajas y lo definimos contigo." },
          { q: "¿Cómo se cobra?", a: "Hoy se registran cobros en efectivo, con tarjeta del estudio y por transferencia con aprobación. El pago en línea viene en una siguiente etapa." },
          { q: "¿Quién ve qué dentro del gimnasio?", a: "Cada persona ve solo lo suyo: dueño, gerente, administrador de sede, recepción, coach, contadora y marketing. Los permisos están en la base de datos, no solo en el menú." },
        ],
      }}
      visit={null}
      newsletter={{ title: "¿Lo vemos con tu gimnasio?", text: "Déjanos tu correo y te escribimos para armar una demo con tus sedes y horarios.", button: "Pedir demo", done: "Gracias. Te escribimos pronto." }}
      onSubscribe={(email) => fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }).then((r) => r.ok)}
      footer={{ links: [{ label: "Entrar", href: "/login" }, { label: "Abrir mi estudio", href: "/registro" }, { label: "Pedir una demo", href: "/contacto" }], note: "ReserveOS. Reservas para gimnasios y estudios." }}
    />
  )
}
