"use client"

import { useState } from "react"
import LandingEstudio, { type LylDay } from "./landing-estudio"

// Semanas de ejemplo para la demostración. Cada gimnasio es de UN solo giro: nunca se mezclan Pilates con CrossFit/HYROX.
type Giro = "pilates" | "crossfit" | "hyrox" | "crossfit_hyrox"
const GIROS_DEMO: { id: Giro; nombre: string }[] = [
  { id: "pilates", nombre: "Estudio de Pilates" },
  { id: "crossfit", nombre: "Gimnasio CrossFit" },
  { id: "hyrox", nombre: "Gimnasio HYROX" },
  { id: "crossfit_hyrox", nombre: "CrossFit + HYROX" },
]
const DIAS = [
  ["Mié 18", "Miércoles 18 de noviembre"], ["Jue 19", "Jueves 19 de noviembre"], ["Vie 20", "Viernes 20 de noviembre"],
  ["Sáb 21", "Sábado 21 de noviembre"], ["Dom 22", "Domingo 22 de noviembre"], ["Lun 23", "Lunes 23 de noviembre"], ["Mar 24", "Martes 24 de noviembre"],
]
type Franja = { time: string; name: string; note: string; minutes: number; capacity: number; price: number }
const FRANJAS: Record<Giro, Franja[]> = {
  pilates: [
    { time: "06:30", name: "Pilates Reformer", note: "Sofía R. · Sede Centro", minutes: 55, capacity: 8, price: 100 },
    { time: "08:00", name: "Pilates Mat", note: "Paula A. · Sede Norte", minutes: 55, capacity: 10, price: 90 },
    { time: "12:15", name: "Reformer Express", note: "Renata S. · Sede Centro", minutes: 40, capacity: 8, price: 90 },
    { time: "18:00", name: "Pilates Reformer", note: "Sofía R. · Sede Centro", minutes: 55, capacity: 8, price: 100 },
    { time: "19:30", name: "Pilates Flow", note: "Paula A. · Sede Norte", minutes: 55, capacity: 10, price: 90 },
  ],
  crossfit: [
    { time: "06:00", name: "WOD", note: "Coach Diego", minutes: 60, capacity: 14, price: 90 },
    { time: "07:00", name: "Fuerza + WOD", note: "Coach Ana", minutes: 75, capacity: 14, price: 90 },
    { time: "12:00", name: "Open Gym", note: "Coach Luis", minutes: 60, capacity: 10, price: 70 },
    { time: "18:30", name: "WOD", note: "Coach Diego", minutes: 60, capacity: 14, price: 90 },
    { time: "19:30", name: "WOD Competidores", note: "Coach Ana", minutes: 75, capacity: 12, price: 100 },
  ],
  hyrox: [
    { time: "06:00", name: "Bloque A · Simulación", note: "Coach Mario · Carriles 1 a 8", minutes: 60, capacity: 8, price: 110 },
    { time: "07:30", name: "Bloque B · Carrera y sled", note: "Coach Mario · Carriles 1 a 8", minutes: 60, capacity: 8, price: 110 },
    { time: "12:15", name: "Bloque C · Estaciones", note: "Coach Elena · Carriles 1 a 8", minutes: 60, capacity: 8, price: 110 },
    { time: "18:00", name: "Bloque D · Simulación", note: "Coach Elena · Carriles 1 a 8", minutes: 60, capacity: 8, price: 110 },
    { time: "19:30", name: "Bloque E · Estaciones", note: "Coach Mario · Carriles 1 a 8", minutes: 60, capacity: 8, price: 110 },
  ],
  crossfit_hyrox: [
    { time: "06:00", name: "WOD", note: "Coach Diego", minutes: 60, capacity: 14, price: 90 },
    { time: "07:30", name: "HYROX · Bloque de carriles", note: "Coach Mario · Carriles 1 a 8", minutes: 60, capacity: 8, price: 110 },
    { time: "12:00", name: "Open Gym", note: "Coach Luis", minutes: 60, capacity: 10, price: 70 },
    { time: "18:00", name: "WOD", note: "Coach Ana", minutes: 60, capacity: 14, price: 90 },
    { time: "19:30", name: "HYROX · Bloque de carriles", note: "Coach Elena · Carriles 1 a 8", minutes: 60, capacity: 8, price: 110 },
  ],
}
const OCUPADOS = [[6, 11, 5, 6, 13], [4, 9, 8, 10, 14], [8, 6, 3, 7, 9], [3, 5, 6, 4, 8], [2, 4, 2, 3, 5], [5, 12, 7, 8, 14], [6, 10, 4, 9, 11]]
const diasDe = (g: Giro): LylDay[] => DIAS.map(([label, full], d) => ({
  label, full, sessions: FRANJAS[g].map((f, i) => ({ ...f, id: `${g}-${d}-${i}`, booked: Math.min(f.capacity, Math.round((OCUPADOS[d][i] * f.capacity) / 14)) })),
}))

export default function LandingReserveOS({ acceso = { label: "Entrar", href: "/login" } }: { acceso?: { label: string; href: string } }) {
  const [giro, setGiro] = useState<Giro>("pilates")
  const control = (
    <div role="tablist" aria-label="Tipo de negocio de la demostración" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {GIROS_DEMO.map((g) => (
        <button key={g.id} role="tab" aria-selected={giro === g.id} onClick={() => setGiro(g.id)} className={"lyl-btn lyl-sm " + (giro === g.id ? "lyl-solid" : "lyl-line")}>
          {g.nombre}
        </button>
      ))}
    </div>
  )
  return (
    <LandingEstudio
      brand="ReserveOS"
      tagline="Reservas para gimnasios y estudios"
      ink={{ accent: "#2f5d8c", onAccent: "#ffffff" }}
      theme="light"
      themeToggle={false}
      access={acceso}
      currency="Q"
      links={[
        { label: "Reservas", href: "#sessions" },
        { label: "Giros", href: "#rooms" },
        { label: "Formas de usar", href: "#membership" },
        { label: "Preguntas", href: "/contacto" },
      ]}
      hero={{
        title: "Tu gimnasio, reservado.",
        text: "ReserveOS es una plataforma de reservas para estudios de Pilates y gimnasios de CrossFit y HYROX. Tu gimnasio tiene su propio espacio dentro de ReserveOS, con su horario, paquetes, equipo y clientes. Sin programar nada.",
        cta: "Pedir una demo", ctaHref: "/contacto", secondary: "Ver cómo funciona", secondaryHref: "#sessions",
      }}
      heat={{ label: "Ocupación de hoy", base: 64, rise: 9, unit: "%", button: "Abrir las reservas", hint: "O toca cualquier punto del calor.", said: "Se abren las reservas. La ocupación sube a cerca de {n} por ciento." }}
      sessions={{
        title: "Reserva una clase, como lo haría tu cliente.",
        text: "Elige el tipo de negocio y mira cómo se reserva: un día, los lugares libres, y reserva o entra a la lista de espera. Cada cliente de ReserveOS es de un solo giro. Es una demostración, no una compra real.",
        days: diasDe(giro),
      }}
      sessionsControl={control}
      rooms={{
        title: "Un sistema, el giro que tú tienes.",
        unit: "lugares",
        items: [
          { name: "Estudio de Pilates", kind: "rest", temp: 8, text: "Clases con cupo por reformer o mat, instructora asignada y paquetes por número de clases que valen en una, varias o todas las sedes.", stay: "Reserva por cupo" },
          { name: "Gimnasio CrossFit", kind: "heat", temp: 14, text: "WOD del día, coach, cupo por clase y membresías. Tus atletas reservan y tú ves la asistencia de cada clase.", stay: "Reserva por cupo" },
          { name: "Gimnasio HYROX", kind: "cold", temp: 8, text: "Sesiones por bloque horario con carriles o estaciones numeradas. También para gimnasios que tienen CrossFit y HYROX juntos. La reserva por carril está en desarrollo.", stay: "Carril o estación" },
        ],
      }}
      ritual={null}
      plans={{
        title: "Tres formas de usar ReserveOS.",
        text: "Las tres usan el mismo sistema por dentro: tus clientes, reservas y pagos en un solo lugar. Elige cuánto quieres que se vea tu marca.",
        items: [
          { name: "Dentro de ReserveOS", price: 0, priceLabel: "La más rápida", unit: "tu gimnasio en nuestra plataforma", text: "Tu gimnasio se suma a ReserveOS. Tiene su espacio con su nombre, y la marca visible es la de ReserveOS.", features: ["Tu espacio en reserveos.app con el nombre de tu gimnasio", "Horarios, paquetes, equipo y clientes cargados por nosotros", "Portal para tus clientes y panel para tu equipo", "Opcional: tu logo, tu color y tu propio dominio"], cta: "Pedir una demo", href: "/contacto", featured: true, badge: "Lo más común" },
          { name: "Widget en tu web", price: 0, priceLabel: "Si ya tienes página", unit: "reservas dentro de tu sitio", text: "Pegas una línea de código en tu web y aparecen tu horario y el botón de reservar.", features: ["Horario y paquetes dentro de tu sitio", "Con tus colores", "Tus clientes se registran y quedan en tu base de datos", "Funciona en cualquier web"], cta: "Pedir una demo", href: "/contacto" },
          { name: "Web propia a tu medida", price: 0, priceLabel: "Si no tienes página", unit: "sitio completo con tu marca", text: "Construimos tu página con tu manual de marca y las reservas ya integradas.", features: ["Diseño con tu marca", "Reservas integradas", "En tu propio dominio", "Sedes, equipo y clientes incluidos"], cta: "Pedir una demo", href: "/contacto" },
        ],
      }}
      quotes={null}
      faq={{
        title: "Antes de empezar.",
        items: [
          { q: "¿Qué es ReserveOS?", a: "Es una plataforma de reservas para estudios de Pilates y gimnasios de CrossFit y HYROX. Cada gimnasio tiene su propio espacio dentro de ReserveOS, con su horario, sus paquetes, su equipo y sus clientes. No necesitas desarrollar nada." },
          { q: "¿Mi gimnasio aparece con mi nombre?", a: "Sí. Tu espacio lleva el nombre de tu gimnasio y la marca visible es ReserveOS. Si quieres tu logo y tu color, o tu propio dominio, se agrega. Y si prefieres tu propia página web, también la construimos." },
          { q: "¿Se adapta a mi tipo de negocio?", a: "Sí. Cada gimnasio se configura con su giro: estudio de Pilates, gimnasio CrossFit, gimnasio HYROX, o un gimnasio con CrossFit y HYROX. Las pantallas, las palabras y las reservas usan el idioma de tu giro." },
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
