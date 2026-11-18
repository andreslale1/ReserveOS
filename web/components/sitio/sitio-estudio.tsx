"use client"

import LandingEstudio, { type LylDay, type LylPlan, type LylRoom } from "./landing-estudio"

export type DatosSitio = {
  slug: string; nombre: string; color: string | null; tagline: string; titulo: string; lede: string; cierre: string
  clasesSemana: number
  days: LylDay[]
  sedes: { nombre: string; direccion: string | null; clases: number }[]
  paquetes: { nombre: string; descripcion: string | null; num_clases: number | null; precio: number; vigencia_dias: number; destacado: boolean; etiqueta: string | null; cobertura: string | null }[]
  testimonios: { nombre: string; texto: string; calificacion: number }[]
  contacto: { whatsapp: string | null; instagram: string | null; facebook: string | null } | null
}

const HEX = /^#[0-9a-fA-F]{6}$/
function luz(h: string) {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const https = (u: string | null | undefined) => (u && /^https:\/\//i.test(u) ? u : null)

// El sitio completo de un estudio: la misma plantilla para cualquier giro, con SUS datos reales y SU color.
export default function SitioEstudio({ d }: { d: DatosSitio }) {
  const acento = HEX.test(d.color ?? "") ? (d.color as string) : "#2f5d8c"
  const onAcento = luz(acento) > 0.45 ? "#111111" : "#ffffff"
  const entrar = (next: string) => `/login?e=${d.slug}&next=${encodeURIComponent(next)}`
  const wa = (d.contacto?.whatsapp ?? "").replace(/\D/g, "")
  const kinds = ["rest", "heat", "cold"] as const

  const rooms: LylRoom[] = d.sedes.map((s, i) => ({
    name: s.nombre, kind: kinds[i % 3], temp: s.clases,
    text: s.direccion || `Sede ${s.nombre}.`, stay: "Ver horario",
  }))
  const plans: LylPlan[] = d.paquetes.map((p) => ({
    name: p.nombre, price: p.precio,
    unit: `${p.num_clases ? p.num_clases + " clases" : "Clases ilimitadas"} · ${p.vigencia_dias} días`,
    text: p.descripcion ?? "", features: [p.cobertura ?? "Todas las sedes"].filter(Boolean) as string[],
    cta: "Elegir paquete", href: entrar("/cuenta/paquetes"), featured: p.destacado, badge: p.etiqueta || "Recomendado",
  }))
  const direcciones = d.sedes.filter((s) => s.direccion).map((s) => `${s.nombre}: ${s.direccion}`)
  const redes = [
    wa ? { label: "WhatsApp", href: `https://wa.me/${wa}` } : null,
    https(d.contacto?.instagram) ? { label: "Instagram", href: https(d.contacto?.instagram)! } : null,
    https(d.contacto?.facebook) ? { label: "Facebook", href: https(d.contacto?.facebook)! } : null,
  ].filter(Boolean) as { label: string; href: string }[]

  return (
    <LandingEstudio
      brand={d.nombre}
      tagline={d.tagline}
      ink={{ accent: acento, onAccent: onAcento }}
      theme="light"
      themeToggle={false}
      currency="Q"
      links={[
        { label: "Horario", href: "#sessions" },
        ...(d.sedes.length > 0 ? [{ label: d.sedes.length > 1 ? "Sedes" : "Sede", href: "#rooms" }] : []),
        ...(d.paquetes.length > 0 ? [{ label: "Paquetes", href: "#membership" }] : []),
        { label: "Entrar", href: entrar("/cuenta") },
      ]}
      hero={{ title: d.titulo, text: d.lede, cta: "Reservar mi clase", ctaHref: entrar("/cuenta/clases"), secondary: "Clase de prueba", secondaryHref: `/e/${d.slug}/prueba` }}
      heat={{ label: "Clases a la semana", base: d.clasesSemana, rise: 0, unit: "", button: "Ver el horario", hint: "O toca cualquier punto del calor.", said: "Estas son las clases de la semana." }}
      onThrow={() => document.querySelector("[data-sec=sessions]")?.scrollIntoView({ behavior: "smooth", block: "start" })}
      sessions={{
        title: "Reserva tu clase.",
        text: "Elige el día y la clase. Para confirmar tu lugar entras a tu cuenta; los lugares disponibles se muestran al reservar.",
        days: d.days,
      }}
      rooms={d.sedes.length > 0 ? { title: d.sedes.length > 1 ? "Nuestras sedes." : "Nuestra sede.", unit: "clases por semana", items: rooms } : null}
      ritual={null}
      plans={d.paquetes.length > 0 ? { title: "Elige tu paquete.", text: "Compra tu paquete y reserva donde y cuando quieras.", items: plans } : null}
      quotes={d.testimonios.length > 0 ? d.testimonios.map((t) => ({ quote: t.texto, name: t.nombre, role: `${t.calificacion} de 5` })) : null}
      faq={null}
      visit={direcciones.length > 0 || redes.length > 0 ? { title: "Visítanos.", address: direcciones.length ? direcciones : [d.nombre], hours: [] } : null}
      newsletter={null}
      footer={{ links: [{ label: "Entrar", href: entrar("/cuenta") }, { label: "Crear cuenta", href: `/registro/${d.slug}?next=${encodeURIComponent("/cuenta/clases")}` }, ...redes], note: d.cierre || d.nombre }}
      onBook={() => { window.location.assign(entrar("/cuenta/clases")); return new Promise<boolean>(() => {}) }}
    />
  )
}
