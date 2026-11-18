"use client"

// Basado en «Löyly Sauna Landing» de Kedhareswer Naidu (https://kedhar.pages.dev), licencia MIT.
// Adaptado por ReserveOS: textos de la interfaz en español y unidades configurables. Se usa como plantilla de la web
// de ventas y del sitio completo de cada estudio (modo C).

// Löyly Sauna Landing: a complete landing page for a public sauna and cold
// plunge, printed in two inks. A cool white grid sheet, one Swiss grotesk and a
// halftone screen in safety orange and black: orange is heat, black is cold.
//
// The screen carries the whole page. In the hero it is the heat coming off the
// stove; press "Throw water on the stones" (or click anywhere in the heat) and
// a wave of löyly, the steam that rises when water hits hot stones, rolls up
// through the dots while the felt-heat readout climbs and settles back. The
// same screen prints the three rooms by temperature, the 90-minute ritual, the
// spots left in each session, the featured membership and the footer, where the
// heat cools to black.
//
// It is a working page, not a poster: a bookable weekly timetable with day
// tabs, spots left, full sessions and a waitlist; memberships with a monthly
// or yearly price; member quotes; questions; a visit section with hours and a
// newsletter form. Every word, session, room, plan and the ink are props.
//
// Everything is drawn here. The halftone is canvas 2D with a fixed dot budget
// that coarsens itself on slow (software) renderers, the patterns are CSS, the
// type is the system Helvetica stack, and nothing loads at runtime.
import * as React from "react"

export type LylLink = { label: string; href?: string }

/** One bookable slot. `booked` of `capacity` spots are taken; when they meet, the session is full. */
export type LylSession = {
  id: string
  /** "07:00" */
  time: string
  name: string
  /** One short line under the name, e.g. "No talking, phones in the lockers". */
  note?: string
  minutes: number
  capacity: number
  booked: number
  price: number
}

export type LylDay = {
  /** Tab label, e.g. "Mon 13". */
  label: string
  /** Accessible name, e.g. "Monday 13 October". */
  full?: string
  sessions: LylSession[]
}

export type LylKind = "heat" | "cold" | "rest"

export type LylRoom = {
  name: string
  kind: LylKind
  /** Degrees, shown as the big numeral. */
  temp: number
  text: string
  /** How long to stay, e.g. "8 to 12 min". */
  stay: string
}

export type LylStep = { kind: LylKind; name: string; minutes: number; text: string }

export type LylPlan = {
  name: string
  /** Price per `unit`, or per month when `yearly` is set. */
  price: number
  /** Price for a year. Plans with it follow the monthly / yearly switch. */
  yearly?: number
  /** "per session", "for 10 visits"; plans with `yearly` say "a month" / "a year". */
  unit: string
  text: string
  features: string[]
  cta: string
  /** Where the button goes. In-page "#…" links scroll; defaults to "#sessions". */
  href?: string
  /** Called when the plan's button is pressed, e.g. to open checkout. */
  onSelect?: (plan: LylPlan, yearly: boolean) => void
  featured?: boolean
  /** The label on a featured plan. */
  badge?: string
}

export type LylQuote = { quote: string; name: string; role: string }

export type LylFaq = { q: string; a: string }

export type LylVisit = {
  title?: string
  address: string[]
  hours: { days: string; time: string }[]
  email?: string
  phone?: string
}

export type LylInkName = "safety" | "klein" | "pine"

export type LylInk = {
  /** The heat ink: dots, fills and the featured plan. */
  accent: string
  /** Text drawn on the accent. */
  onAccent: string
}

export interface LoylySaunaLandingProps {
  /** Wordmark in the nav and footer. */
  brand?: string
  /** One line beside the wordmark on wide screens. */
  tagline?: string
  /** In-page links. "#sessions", "#rooms", "#ritual", "#membership" and "#visit" scroll within the page. */
  links?: LylLink[]
  hero?: { title?: string; text?: string; cta?: string; ctaHref?: string; secondary?: string; secondaryHref?: string }
  /** The felt-heat readout in the hero: it rests at `base` and climbs by `rise` when water hits the stones. */
  heat?: { label?: string; base?: number; rise?: number; button?: string; hint?: string; unit?: string; said?: string }
  sessions?: { title?: string; text?: string; days?: LylDay[] } | null
  rooms?: { title?: string; items?: LylRoom[]; unit?: string } | null
  ritual?: { title?: string; text?: string; steps?: LylStep[]; rounds?: number; extra?: { name: string; minutes: number } } | null
  plans?: { title?: string; text?: string; items?: LylPlan[]; yearlyNote?: string } | null
  quotes?: LylQuote[] | null
  faq?: { title?: string; items?: LylFaq[] } | null
  visit?: LylVisit | null
  newsletter?: { title?: string; text?: string; button?: string; done?: string } | null
  footer?: { links?: LylLink[]; note?: string } | null
  /** Currency sign in front of every price. */
  currency?: string
  /** Ink preset or your own colours. */
  ink?: LylInkName | LylInk
  /** "system" follows the host's `.dark` class, then the OS. */
  theme?: "system" | "light" | "dark"
  /** Called when a session is booked or waitlisted. Return (or resolve to) `false`, or throw, to show an error. */
  onBook?: (session: LylSession, day: LylDay, waitlist: boolean) => unknown
  /** Called with a valid email from the newsletter form. Return `false`, or throw, to show an error. */
  onSubscribe?: (email: string) => unknown
  /** Called each time water is thrown on the stones. */
  onThrow?: () => void
  /** Show the Night / Paper switch in the nav. */
  themeToggle?: boolean
  /** Minimum height of the hero and the page. A definite length, so it survives any host layout. */
  height?: string
  className?: string
}

// #region content
const INKS = {
  safety: { accent: "#ff4f12", onAccent: "#0d0d0d" },
  klein: { accent: "#1d3bff", onAccent: "#ffffff" },
  pine: { accent: "#0f7a4f", onAccent: "#ffffff" },
}

const DEFAULT_LINKS = [
  { label: "Sessions", href: "#sessions" },
  { label: "Rooms", href: "#rooms" },
  { label: "Ritual", href: "#ritual" },
  { label: "Membership", href: "#membership" },
  { label: "Visit", href: "#visit" },
]

const DEFAULT_HERO = {
  title: "Sweat in public.",
  text: "A wood-fired sauna, a 4 °C harbour plunge and a quiet deck by the water. Book a 90-minute session from €19.",
  cta: "Book a session",
  ctaHref: "#sessions",
  secondary: "See membership",
  secondaryHref: "#membership",
}

const DEFAULT_HEAT = {
  label: "Felt heat, top bench",
  base: 88,
  rise: 9,
  button: "Throw water on the stones",
  hint: "Or press anywhere in the heat.",
  unit: "°C",
  said: "Water on the stones. Felt heat rises to about {n} degrees.",
}

const SLOT_TEMPLATES = [
  { time: "07:00", name: "Early heat", note: "Before work, kettle on at 06:45", minutes: 90, capacity: 14, price: 19 },
  { time: "12:15", name: "Lunch sweat", note: "Out by 13:15, sandwiches on the deck", minutes: 60, capacity: 12, price: 15 },
  { time: "16:00", name: "Open sauna", note: "Mixed, swimwear on", minutes: 90, capacity: 18, price: 19 },
  { time: "18:00", name: "Silent sauna", note: "No talking, phones in the lockers", minutes: 90, capacity: 14, price: 21 },
  { time: "20:30", name: "Late sauna", note: "Lights low, last plunge at 21:55", minutes: 90, capacity: 16, price: 19 },
]

const DAY_NAMES = [
  ["Mon 13", "Monday 13 October"],
  ["Tue 14", "Tuesday 14 October"],
  ["Wed 15", "Wednesday 15 October"],
  ["Thu 16", "Thursday 16 October"],
  ["Fri 17", "Friday 17 October"],
  ["Sat 18", "Saturday 18 October"],
  ["Sun 19", "Sunday 19 October"],
]

// How full each slot is, per day, as a share of capacity. Deterministic so the
// page renders the same on the server and the client.
const FILL = [
  [0.5, 0.25, 0.6, 1, 0.7],
  [0.35, 0.4, 0.55, 0.85, 0.6],
  [0.6, 0.3, 0.45, 1, 0.75],
  [0.45, 0.5, 0.7, 0.95, 0.65],
  [0.7, 0.6, 0.85, 1, 1],
  [0.8, 0.55, 1, 0.9, 1],
  [0.65, 0.35, 0.9, 0.7, 0.4],
]

function buildDays() {
  return DAY_NAMES.map(([label, full], d) => {
    const weekend = d >= 5
    const sessions = SLOT_TEMPLATES.map((s, i) => {
      const t = weekend && i === 1 ? { ...s, time: "10:00", name: d === 5 ? "Women’s session" : "Sauna and breathwork", note: d === 5 ? "Women and non-binary guests" : "Guided by Ilse, 20 minutes of breathing first", minutes: 90, price: 23 } : s
      const silent = t.name === "Silent sauna" && d !== 1 && d !== 3
      const tt = silent ? { ...t, name: "Evening sauna", note: "Mixed, swimwear on" } : t
      return { ...tt, id: "d" + d + "s" + i, booked: Math.round(FILL[d][i] * tt.capacity) }
    })
    return { label, full, sessions }
  })
}

const DEFAULT_DAYS = buildDays()

const DEFAULT_ROOMS = [
  {
    name: "Hot room",
    kind: "heat" as LylKind,
    temp: 90,
    text: "Spruce benches on three tiers around a 300 kg stone stove fired with birch. The top bench runs about 15 degrees hotter than the floor.",
    stay: "8 to 12 min",
  },
  {
    name: "Cold plunge",
    kind: "cold" as LylKind,
    temp: 4,
    text: "Harbour water, filtered and chilled all year. Two steps down, a rail on both sides and a clock on the wall.",
    stay: "30 s to 2 min",
  },
  {
    name: "Rest deck",
    kind: "rest" as LylKind,
    temp: 22,
    text: "Loungers facing the water, wool blankets and free tea. This is where it lands, so stay longer than feels necessary.",
    stay: "10 min or more",
  },
]

const DEFAULT_STEPS = [
  { kind: "heat" as LylKind, name: "Heat", minutes: 12, text: "Sit high, breathe through the nose, leave before it gets heroic." },
  { kind: "cold" as LylKind, name: "Cold", minutes: 2, text: "Shower first, then the plunge. Shoulders under, hands out of the water." },
  { kind: "rest" as LylKind, name: "Rest", minutes: 10, text: "Wrap up on the deck until your breathing is slow again." },
]

const DEFAULT_PLANS = [
  {
    name: "Drop-in",
    price: 19,
    unit: "per session",
    text: "Any open session, any day of the week.",
    features: ["90 minutes, three rounds", "Towel, locker and shampoo", "Free tea on the deck"],
    cta: "Book a session",
  },
  {
    name: "Ten visits",
    price: 160,
    unit: "for 10 visits",
    text: "€16 a visit, valid for six months.",
    features: ["Share it with one friend", "Book 5 days ahead", "Works for the silent sauna"],
    cta: "Buy ten visits",
  },
  {
    name: "Member",
    price: 69,
    yearly: 690,
    unit: "a month",
    text: "Come as often as you like.",
    features: ["Unlimited sessions", "Book 14 days ahead", "Two guest passes a month", "Pause up to two months a year"],
    cta: "Become a member",
    featured: true,
  },
] as LylPlan[]

const DEFAULT_QUOTES = [
  {
    quote: "I came for the cold plunge and stayed for the silence. The Tuesday silent sauna is the best ninety minutes of my week.",
    name: "Maren Holt",
    role: "Member since 2023",
  },
  {
    quote: "They walk you through the ritual on your first visit, so nobody stands around lost. My dad is 71 and now goes twice a week.",
    name: "Tomasz Wielgus",
    role: "Ten-visit card",
  },
  {
    quote: "It’s a real wood-fired stove, and you can feel it in the steam. Softer, and it lasts longer on your skin.",
    name: "Aino Lehtinen",
    role: "Grew up with a lakeside sauna",
  },
]

const DEFAULT_FAQ = [
  { q: "What do I bring?", a: "A swimsuit and a water bottle. Towels, lockers, shampoo and tea are included. Swimwear is required in all mixed sessions." },
  { q: "I’ve never done a cold plunge. Is that a problem?", a: "Not at all. Stay in for 30 seconds the first time, keep your head above the water and get out whenever you want. A host is on the deck for every session." },
  { q: "Can I book for a group?", a: "Up to six people in one booking. For seven or more, or the whole sauna, email us and we will find you a slot." },
  { q: "How does the silent sauna work?", a: "No talking in the hot room or on the deck, and phones stay in the lockers. It runs on Tuesdays and Thursdays at 18:00." },
  { q: "Can I cancel?", a: "Cancel up to 12 hours before and the session goes back to your card or account. After that you can give your spot to a friend." },
  { q: "Is it accessible?", a: "Step-free access to the hot room and the deck, a lift to the changing rooms and a hoist into the plunge on request." },
]

const DEFAULT_VISIT = {
  title: "Pier 3, at the end of the boardwalk.",
  address: ["Kiuas Public Sauna", "Pier 3, Harbour Road", "Five minutes from the ferry stop"],
  hours: [
    { days: "Monday to Friday", time: "07:00 to 22:00" },
    { days: "Saturday and Sunday", time: "08:00 to 22:00" },
    { days: "Holidays", time: "10:00 to 20:00" },
  ],
  email: "hello@kiuas.house",
  phone: "+45 31 84 72 19",
}

const DEFAULT_NEWSLETTER = {
  title: "Next week’s timetable, every Sunday.",
  text: "One email a week with the sessions, the guest hosts and anything that changed. Nothing else.",
  button: "Subscribe",
  done: "Subscribed. The first timetable arrives on Sunday evening.",
}

const DEFAULT_FOOTER = {
  links: [
    { label: "Gift cards", href: "#" },
    { label: "Private hire", href: "#" },
    { label: "Jobs", href: "#" },
    { label: "Instagram", href: "#" },
    { label: "House rules", href: "#" },
  ],
  note: "Kiuas Public Sauna. Wood-fired since 2021.",
}
// #endregion content

// #region logic
/** Heat ink, cold ink, and how much of the heat is a passing wave (0..1 each). */
type Out = { a: number; k: number; w: number }

const TAU = Math.PI * 2

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v
}

function smoothstep(e0: number, e1: number, x: number) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}

function hash2(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** Smooth value noise in 0..1. */
function noise2(x: number, y: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash2(xi, yi)
  const b = hash2(xi + 1, yi)
  const c = hash2(xi, yi + 1)
  const d = hash2(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

function fbm(x: number, y: number) {
  return noise2(x, y) * 0.65 + noise2(x * 2.03 + 17.1, y * 2.03 - 4.7) * 0.35
}

export type LylWave = { x: number; y: number; t: number }

/** Seconds a löyly wave takes to roll through the hero. */
const WAVE_LIFE = 1.7

/**
 * The hero screen. (x, y) in CSS px, t in seconds. Heat (accent) blooms from
 * the bottom-right corner; the cold ink lies under it as the stones and a
 * diagonal band; waves add a ring of heat that grows out from where water hit.
 */
function heroField(x: number, y: number, w: number, h: number, t: number, waves: LylWave[], out: Out) {
  const wide = w >= h
  const rx = wide ? w * 0.6 : w * 1.25
  const ry = wide ? h * 0.92 : h * 0.5
  const n = fbm(x / 210, y / 210 + t * 0.09)
  const dx = (x - w) / rx
  const dy = (y - h * 1.02) / ry
  const dist = Math.sqrt(dx * dx + dy * dy)
  let a = 1 - smoothstep(0.2, 1.02, dist + (n - 0.5) * 0.55)

  // stones: the corner under the heat, and a band running up and left of it
  const n2 = noise2(x / 120 + 40, y / 120 - t * 0.05)
  const cx = (x - w) / (wide ? w * 0.27 : w * 0.6)
  const cy = (y - h) / (wide ? h * 0.42 : h * 0.18)
  const core = 1 - smoothstep(0.35, 1.05, Math.sqrt(cx * cx + cy * cy) + (n2 - 0.5) * 0.5)
  const p0x = wide ? w * 0.36 : -w * 0.1
  const p0y = h * 1.06
  const p1x = w * 1.02
  const p1y = wide ? h * 0.6 : h * 0.74
  const vx = p1x - p0x
  const vy = p1y - p0y
  const len2 = vx * vx + vy * vy
  const s = clamp(((x - p0x) * vx + (y - p0y) * vy) / len2, 0, 1)
  const qx = p0x + vx * s - x
  const qy = p0y + vy * s - y
  const thick = Math.min(w, h) * (wide ? 0.1 : 0.09)
  const band = (1 - smoothstep(0.25, 1, Math.sqrt(qx * qx + qy * qy) / thick + (n2 - 0.5) * 0.7)) * smoothstep(0, 0.45, s)
  let k = Math.max(core, band * 0.78)

  // the margin strip: a column of fine, even accent dots down the left edge (wide screens)
  if (wide && x < clamp(w * 0.034, 16, 48) - 14) a = Math.max(a, 0.16 + 0.05 * hash2(Math.round(x), Math.round(y)))

  let wsum = 0
  for (let i = 0; i < waves.length; i++) {
    const wv = waves[i]
    const age = t - wv.t
    if (age < 0 || age > WAVE_LIFE) continue
    const p = age / WAVE_LIFE
    const R = (1 - (1 - p) * (1 - p) * (1 - p)) * Math.hypot(w, h) * 0.6
    // steam rises: the ring is tall rather than round, and its centre drifts up as it goes
    const ddx = x - wv.x
    const ddy = (y - (wv.y - p * h * 0.35)) * 0.62
    const d = Math.sqrt(ddx * ddx + ddy * ddy)
    const ring = (d - R) / (80 + 120 * p)
    const fade = 1 - p
    const up = d > 1 ? clamp(0.3 + 0.7 * (-ddy / d), 0.1, 1) : 1
    const add = Math.exp(-ring * ring) * fade * up * (0.5 + 0.4 * n)
    wsum += add
    k *= 1 - 0.35 * fade * Math.exp(-ring * ring)
  }
  a = clamp(a, 0, 1)
  out.w = Math.min(wsum, 1 - a)
  out.a = a + out.w
  out.k = clamp(k, 0, 1)
}

/** The room plates: heat rises from the stove, the plunge is banded water, the deck is almost empty paper. */
function roomField(kind: LylKind, x: number, y: number, w: number, h: number, out: Out) {
  out.w = 0
  const u = x / w
  const v = y / h
  const n = fbm(x / 90 + (kind === "cold" ? 30 : 0), y / 90)
  if (kind === "heat") {
    out.a = clamp(smoothstep(-0.05, 0.98, v + (n - 0.5) * 0.3) * 1.05, 0, 1)
    out.k = smoothstep(0.84, 1.02, v + (n - 0.5) * 0.18) * 0.95
  } else if (kind === "cold") {
    const ripple = 0.5 + 0.5 * Math.sin(v * 26 + n * 5 + u * 1.5)
    out.a = 0
    out.k = clamp(smoothstep(-0.02, 0.72, v + (n - 0.5) * 0.12) * (0.45 + 0.45 * ripple), 0, 1)
  } else {
    const warm = 1 - smoothstep(0, 0.75, Math.hypot(u - 0.95, v - 0.06) + (n - 0.5) * 0.3)
    out.a = warm * 0.28
    out.k = 0.1 + 0.12 * smoothstep(0.55, 1, v) * n
  }
}

/** The footer band: heat on the left cooling to black on the right, dots growing out of the paper. */
function coolField(x: number, y: number, w: number, h: number, out: Out) {
  out.w = 0
  const u = x / w
  const v = y / h
  const n = fbm(x / 140, y / 140)
  const edge = smoothstep(0.0, 0.85, v + (n - 0.5) * 0.4)
  out.a = (1 - smoothstep(0.1, 0.72, u + (n - 0.5) * 0.35)) * edge
  out.k = smoothstep(0.3, 0.95, u + (n - 0.5) * 0.35) * edge
}

/** 1 inside a text box, easing to 0 a little way outside it. */
function quietness(x: number, y: number, x0: number, y0: number, x1: number, y1: number) {
  const dx = Math.max(x0 - x, 0, x - x1)
  const dy = Math.max(y0 - y, 0, y - y1)
  return 1 - smoothstep(0, 48, Math.sqrt(dx * dx + dy * dy))
}

/** Behind the member quote: a last plume of heat drifting in from the right edge, the stones cooling under it. */
function driftField(x: number, y: number, w: number, h: number, out: Out) {
  out.w = 0
  const n = fbm(x / 160 + 9, y / 160)
  const dx = (x - w) / Math.max(w * 0.34, 180)
  const dy = (y - h * 0.62) / (h * 0.75)
  out.a = 1 - smoothstep(0.25, 1.05, Math.sqrt(dx * dx + dy * dy) + (n - 0.5) * 0.5)
  const cx = (x - w) / Math.max(w * 0.13, 70)
  const cy = (y - h) / (h * 0.32)
  out.k = (1 - smoothstep(0.3, 1, Math.sqrt(cx * cx + cy * cy) + (n - 0.5) * 0.45)) * 0.9
}

/** Dot spacing for a canvas: a target pitch, held to a dot budget so big screens and software renderers keep up. */
function dotStep(w: number, h: number, base: number, budget: number) {
  return Math.max(base, Math.sqrt((w * h) / budget))
}

/** Device pixel ratio for a canvas, capped to a pixel budget. */
function canvasRatio(w: number, h: number, dpr: number) {
  return Math.max(0.5, Math.min(dpr || 1, 2, Math.sqrt(2.2e6 / Math.max(1, w * h))))
}

/** Felt heat after a throw: climbs over 0.6 s, then cools back over a few seconds. 0..1 */
function heatLevel(t: number, waves: LylWave[]) {
  let e = 0
  for (const wv of waves) {
    const age = t - wv.t
    if (age < 0) continue
    const v = age < 0.6 ? age / 0.6 : Math.exp(-(age - 0.6) / 2.4)
    e = Math.max(e, v)
  }
  return e
}

function formatPrice(n: number, sign: string) {
  const s = Number.isInteger(n) ? String(n) : n.toFixed(2)
  return sign + s
}

function spotsLeft(s: LylSession, extra: number) {
  return Math.max(0, s.capacity - s.booked - extra)
}

function planPrice(p: LylPlan, yearly: boolean) {
  return yearly && p.yearly != null ? p.yearly : p.price
}

function planUnit(p: LylPlan, yearly: boolean) {
  return p.yearly != null ? (yearly ? "al año" : "al mes") : p.unit
}

/** Months a yearly price saves against twelve monthly ones, rounded. */
function monthsFree(p: LylPlan) {
  if (p.yearly == null || p.price <= 0) return 0
  return Math.round((p.price * 12 - p.yearly) / p.price)
}

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(s.trim())
}

function nextIndex(i: number, key: string, n: number) {
  if (key === "ArrowRight" || key === "ArrowDown") return (i + 1) % n
  if (key === "ArrowLeft" || key === "ArrowUp") return (i - 1 + n) % n
  if (key === "Home") return 0
  if (key === "End") return n - 1
  return i
}

/** The 90-minute timeline: the steps repeated for each round, then the extra block. */
function ritualSegments(steps: LylStep[], rounds: number, extra?: { name: string; minutes: number }) {
  const segs = [] as { kind: LylKind | "extra"; name: string; minutes: number; round: number }[]
  for (let r = 0; r < rounds; r++) for (const s of steps) segs.push({ kind: s.kind, name: s.name, minutes: s.minutes, round: r + 1 })
  if (extra && extra.minutes > 0) segs.push({ kind: "extra", name: extra.name, minutes: extra.minutes, round: 0 })
  const total = segs.reduce((n, s) => n + s.minutes, 0)
  return { segs, total }
}

function resolveInk(ink: LylInkName | LylInk | undefined) {
  if (!ink) return INKS.safety
  if (typeof ink === "string") return INKS[ink] || INKS.safety
  return { accent: ink.accent, onAccent: ink.onAccent || "#0d0d0d" }
}
// #endregion logic

type Inks = { accent: string; ink: string; line: string }

type HalftoneHandle = { kick: (x?: number, y?: number) => void }

type HalftoneProps = {
  kind: "hero" | "cool" | "drift" | LylKind
  /** Dot pitch in CSS px before the budget kicks in. */
  pitch: number
  budget: number
  live?: boolean
  reduced: boolean
  /** Re-read the inks when these change. */
  inkKey: string
  /** Selector for text inside the box the screen keeps clear of, so a wave never runs through body copy. */
  quiet?: string
  /** Like `quiet`, but only the passing wave keeps clear. */
  calm?: string
  handle?: { current: HalftoneHandle | null }
  onHeat?: (level: number) => void
  className?: string
}

function readInks(el: Element): Inks {
  const cs = getComputedStyle(el)
  const g = (n: string, f: string) => (cs.getPropertyValue(n) || "").trim() || f
  return { accent: g("--lyl-accent", "#ff4f12"), ink: g("--lyl-cold", "#111"), line: g("--lyl-rule", "rgba(0,0,0,.12)") }
}

function Halftone({ kind, pitch, budget, live = false, reduced, inkKey, quiet, calm, handle, onHeat, className }: HalftoneProps) {
  const ref = React.useRef(null as HTMLCanvasElement | null)
  const heatCb = React.useRef(onHeat)
  heatCb.current = onHeat

  React.useEffect(() => {
    const cv = ref.current
    const box = cv && cv.parentElement
    if (!cv || !box) return
    const c2d = cv.getContext("2d")
    if (!c2d) return
    let w = 1
    let h = 1
    let step = pitch
    let slow = 0
    let ema = 0
    let raf = 0
    let last = 0
    let onScreen = true
    let shown = typeof document === "undefined" || document.visibilityState !== "hidden"
    let inks = readInks(cv)
    const waves = [] as LylWave[]
    const start = performance.now()
    const out = { a: 0, k: 0, w: 0 }
    const now = () => (performance.now() - start) / 1000
    let lastHeat = -1
    let zones = [] as number[]

    const draw = (t: number) => {
      const t0 = performance.now()
      c2d.clearRect(0, 0, w, h)
      const cols = Math.ceil(w / step) + 1
      const rows = Math.ceil(h / step) + 1
      const off = (w - (cols - 1) * step) / 2
      const inkCells = [] as number[]
      const rMax = step * 0.58
      c2d.fillStyle = inks.accent
      c2d.beginPath()
      for (let j = 0; j < rows; j++) {
        const y = j * step
        for (let i = 0; i < cols; i++) {
          const x = off + i * step
          if (kind === "hero") heroField(x, y, w, h, t, waves, out)
          else if (kind === "cool") coolField(x, y, w, h, out)
          else if (kind === "drift") driftField(x, y, w, h, out)
          else roomField(kind, x, y, w, h, out)
          let a = out.a
          let k = out.k
          let wv = out.w
          for (let z = 0; z < zones.length; z += 5) {
            const q = quietness(x, y, zones[z], zones[z + 1], zones[z + 2], zones[z + 3])
            if (q <= 0) continue
            if (zones[z + 4]) {
              const cut = wv * 0.94 * q
              a -= cut
              wv -= cut
            } else {
              a *= 1 - q
              k *= 1 - q
              wv *= 1 - q
            }
          }
          // two screens, half a pitch apart: heat on the grid, cold on the gaps
          // between it, and the heat dots shrink where the cold ink lies on top
          const ra = rMax * Math.sqrt(a * (1 - 0.82 * k))
          if (ra >= 0.45) {
            c2d.moveTo(x + ra, y)
            c2d.arc(x, y, ra, 0, TAU)
          }
          const rk = rMax * 0.96 * Math.sqrt(k)
          if (rk >= 0.45) inkCells.push(x + step / 2, y + step / 2, rk)
        }
      }
      c2d.fill()
      c2d.fillStyle = inks.ink
      c2d.beginPath()
      for (let q = 0; q < inkCells.length; q += 3) {
        c2d.moveTo(inkCells[q] + inkCells[q + 2], inkCells[q + 1])
        c2d.arc(inkCells[q], inkCells[q + 1], inkCells[q + 2], 0, TAU)
      }
      c2d.fill()
      const ms = performance.now() - t0
      ema = ema ? ema * 0.8 + ms * 0.2 : ms
      // a slow renderer coarsens the screen until a frame fits
      if (live && ema > 22 && slow < 8) {
        slow += 1
        ema = 0
        step = dotStep(w, h, pitch, budget) + slow
      }
      if (kind === "hero" && heatCb.current) {
        const lv = heatLevel(t, waves)
        if (Math.abs(lv - lastHeat) > 0.004) {
          lastHeat = lv
          heatCb.current(lv)
        }
      }
    }

    const size = () => {
      const r = box.getBoundingClientRect()
      w = Math.max(1, Math.round(r.width))
      h = Math.max(1, Math.round(r.height))
      const dpr = canvasRatio(w, h, window.devicePixelRatio)
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
      cv.style.width = w + "px"
      cv.style.height = h + "px"
      c2d.setTransform(dpr, 0, 0, dpr, 0, 0)
      step = dotStep(w, h, pitch, budget) + slow
      inks = readInks(cv)
      zones = []
      const collect = (sel: string | undefined, waveOnly: number) => {
        if (!sel) return
        for (const el of Array.from(box.querySelectorAll(sel))) {
          // an element with its own backing needs no clearing
          const bg = getComputedStyle(el).backgroundColor
          if (bg && bg !== "transparent" && !/rgba\(.*,\s*0\)$/.test(bg)) continue
          const q = el.getBoundingClientRect()
          if (!q.width || !q.height) continue
          zones.push(q.left - r.left, q.top - r.top, q.right - r.left, q.bottom - r.top, waveOnly)
        }
      }
      collect(quiet, 0)
      collect(calm, 1)
      draw(now())
    }

    const busy = () => waves.some((wv) => now() - wv.t < 7)
    const loop = (ts: number) => {
      raf = 0
      const animating = busy()
      if (!onScreen || !shown) return
      if (!live && !animating) return
      const gap = animating ? 0 : 1000 / 24
      if (ts - last >= gap) {
        last = ts
        draw(now())
      }
      if (live && !reduced) raf = requestAnimationFrame(loop)
      else if (animating && !reduced) raf = requestAnimationFrame(loop)
    }
    const wake = () => {
      if (!raf && !reduced) raf = requestAnimationFrame(loop)
    }

    if (handle) {
      handle.current = {
        kick: (x?: number, y?: number) => {
          const t = now()
          if (waves.length >= 2) waves.shift()
          waves.push({ x: x == null ? w * 0.9 : x, y: y == null ? h * 0.94 : y, t })
          if (reduced) {
            // no wave: the readout jumps to its peak and the still frame stays
            if (heatCb.current) heatCb.current(1)
            window.setTimeout(() => heatCb.current && heatCb.current(0), 4000)
            waves.length = 0
            return
          }
          wake()
        },
      }
    }

    size()
    const ro = new ResizeObserver(() => size())
    ro.observe(box)
    const io = new IntersectionObserver((es) => {
      onScreen = es[es.length - 1].isIntersecting
      if (onScreen) wake()
    })
    io.observe(cv)
    const vis = () => {
      shown = document.visibilityState !== "hidden"
      if (shown) wake()
    }
    document.addEventListener("visibilitychange", vis)
    wake()
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener("visibilitychange", vis)
      if (handle) handle.current = null
    }
  }, [kind, pitch, budget, live, reduced, inkKey, quiet, calm, handle])

  return <canvas ref={ref} className={"lyl-canvas " + (className || "")} aria-hidden="true" />
}

function useReducedMotion() {
  const [reduced, setReduced] = React.useState(false)
  React.useEffect(() => {
    if (typeof matchMedia !== "function") return
    const mq = matchMedia("(prefers-reduced-motion: reduce)")
    const on = () => setReduced(mq.matches)
    on()
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [])
  return reduced
}

function useTheme(pref: "system" | "light" | "dark") {
  const [dark, setDark] = React.useState(pref === "dark")
  React.useEffect(() => {
    if (pref !== "system") {
      setDark(pref === "dark")
      return
    }
    const mq = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null
    const read = () => {
      const el = document.documentElement
      if (el.classList.contains("dark")) return setDark(true)
      if (el.classList.contains("light")) return setDark(false)
      setDark(!!(mq && mq.matches))
    }
    read()
    const mo = new MutationObserver(read)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    if (mq) mq.addEventListener("change", read)
    return () => {
      mo.disconnect()
      if (mq) mq.removeEventListener("change", read)
    }
  }, [pref])
  return [dark, setDark] as const
}

/** Reveal-on-scroll for section heads: armed only after mount, so nothing is hidden without JS or under reduced motion. */
function useReveal(root: { current: HTMLElement | null }, reduced: boolean) {
  React.useEffect(() => {
    const el = root.current
    if (!el || reduced || typeof IntersectionObserver === "undefined") return
    const items = Array.from(el.querySelectorAll(".lyl-rv"))
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) if (e.isIntersecting) {
          e.target.setAttribute("data-in", "")
          io.unobserve(e.target)
        }
      },
      { rootMargin: "0px 0px -8% 0px" }
    )
    for (const it of items) {
      const r = it.getBoundingClientRect()
      if (r.top < window.innerHeight) continue
      it.setAttribute("data-armed", "")
      io.observe(it)
    }
    return () => io.disconnect()
  }, [root, reduced])
}

const LYL_CSS = `
.lyl-root{--lyl-cold:#0d0d0d;--lyl-paper:#f2f3f1;--lyl-sheet:#e9ebe8;--lyl-ink:#0d0d0d;--lyl-soft:#2b2c2e;--lyl-muted:#56585b;--lyl-rule:rgba(13,13,13,.13);--lyl-faint:rgba(13,13,13,.06);--lyl-ease:cubic-bezier(.22,1,.36,1);--lyl-pad:clamp(16px,3.4vw,48px);--lyl-nav:64px;position:relative;min-height:var(--lyl-h);background:var(--lyl-paper);color:var(--lyl-ink);font-family:"Helvetica Neue",Helvetica,"Nimbus Sans","FreeSans",Arial,sans-serif;font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased;overflow-x:clip;color-scheme:light}
.lyl-root[data-theme="dark"]{--lyl-cold:#4c535b;--lyl-paper:#0e0e0f;--lyl-sheet:#18181a;--lyl-ink:#efefec;--lyl-soft:#d6d6d2;--lyl-muted:#a5a6a8;--lyl-rule:rgba(239,239,236,.15);--lyl-faint:rgba(239,239,236,.06);color-scheme:dark}
.lyl-root :where(*){box-sizing:border-box;margin:0;padding:0}
.lyl-root :where(button,input){font:inherit;color:inherit;background:none;border:0;border-radius:0}
.lyl-root :where(a){color:inherit;text-decoration:none}
.lyl-root :where(ul,ol){list-style:none}
.lyl-root ::selection{background:var(--lyl-accent);color:var(--lyl-on)}
.lyl-root :where(a,button,input):focus-visible{outline:2px solid var(--lyl-ink);outline-offset:3px}
.lyl-canvas{position:absolute;inset:0;display:block;max-width:none;pointer-events:none}
.lyl-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.lyl-wrap{padding-inline:var(--lyl-pad)}
.lyl-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));column-gap:clamp(12px,1.6vw,24px)}
.lyl-num{font-variant-numeric:tabular-nums}

.lyl-skip{position:absolute;left:var(--lyl-pad);top:8px;z-index:30;padding:10px 14px;background:var(--lyl-ink);color:var(--lyl-paper);transform:translateY(-160%);transition:transform .2s var(--lyl-ease)}
.lyl-skip:focus-visible{transform:none}

.lyl-nav{position:sticky;top:0;z-index:20;height:var(--lyl-nav);display:flex;align-items:center;gap:24px;background:var(--lyl-paper);border-bottom:1px solid var(--lyl-rule)}
.lyl-brand{display:flex;align-items:baseline;gap:14px;min-width:0}
.lyl-word{font-weight:700;font-size:22px;letter-spacing:-.04em;line-height:1}
.lyl-tag{font-size:13px;color:var(--lyl-muted);white-space:nowrap}
.lyl-links{display:flex;gap:26px;margin-left:auto}
.lyl-link{position:relative;font-size:14px;padding:6px 0}
.lyl-link::after{content:"";position:absolute;left:0;right:0;bottom:2px;height:1px;background:currentColor;transform:scaleX(0);transform-origin:right;transition:transform .3s var(--lyl-ease)}
.lyl-link:hover::after,.lyl-link:focus-visible::after{transform:scaleX(1);transform-origin:left}
.lyl-navr{display:flex;align-items:center;gap:8px}
.lyl-stock{display:inline-flex;align-items:center;gap:8px;font-size:14px;color:var(--lyl-ink);padding:8px 10px;cursor:pointer}
.lyl-stock:hover .lyl-moon{transform:rotate(180deg)}
.lyl-moon{width:12px;height:12px;border-radius:50%;box-shadow:inset 0 0 0 1.5px currentColor;background:linear-gradient(90deg,currentColor 50%,transparent 50%);transition:transform .4s var(--lyl-ease)}
.lyl-menu{display:none;font-size:14px;padding:10px 4px;margin-left:auto}

.lyl-btn{position:relative;display:inline-flex;align-items:center;gap:12px;height:48px;padding:0 20px;font-size:15px;font-weight:500;white-space:nowrap;cursor:pointer;overflow:hidden;isolation:isolate;transition:color .25s var(--lyl-ease),transform .15s var(--lyl-ease)}
.lyl-btn::before{content:"";position:absolute;inset:1px;z-index:-1;background:var(--lyl-accent);transform:translateY(101%);transition:transform .3s var(--lyl-ease)}
.lyl-btn:hover::before,.lyl-btn:focus-visible::before{transform:none}
.lyl-btn:active{transform:translateY(1px)}
.lyl-btn .lyl-arr{display:inline-block;transition:transform .35s var(--lyl-ease)}
.lyl-btn:hover .lyl-arr{transform:translateX(4px)}
.lyl-solid{background:var(--lyl-ink);color:var(--lyl-paper)}
.lyl-solid:hover,.lyl-solid:focus-visible{color:var(--lyl-on)}
.lyl-line{box-shadow:inset 0 0 0 1px var(--lyl-ink);color:var(--lyl-ink)}
.lyl-line:hover,.lyl-line:focus-visible{color:var(--lyl-on);box-shadow:inset 0 0 0 1px var(--lyl-accent)}
.lyl-sm{height:40px;padding:0 16px;font-size:14px}
.lyl-btn[disabled]{cursor:default}

.lyl-hero{position:relative;min-height:calc(clamp(620px,var(--lyl-h),1040px) - var(--lyl-nav));display:grid;grid-template-columns:repeat(12,minmax(0,1fr));grid-template-rows:auto 1fr auto auto;column-gap:clamp(12px,1.6vw,24px);padding-top:clamp(28px,4.4vw,64px);padding-bottom:clamp(28px,4vw,56px);cursor:crosshair;overflow:hidden}
.lyl-hero .lyl-canvas{z-index:0}
.lyl-hero>*:not(.lyl-canvas):not(.lyl-marks){position:relative;z-index:1}
.lyl-h1{grid-column:1/span 9;grid-row:3;font-weight:700;font-size:clamp(64px,12.4vw,200px);line-height:.84;letter-spacing:-.062em;margin-left:-.05em;text-wrap:balance}
.lyl-h1 span{display:block;width:fit-content}
.lyl-lead{grid-column:1/span 4;grid-row:4;display:flex;flex-direction:column;gap:22px;margin-top:clamp(20px,2.4vw,36px);cursor:auto}
.lyl-lead p{font-size:clamp(17px,1.25vw,19px);line-height:1.45;max-width:31ch;color:var(--lyl-soft)}
.lyl-ctas{display:flex;flex-wrap:wrap;gap:10px}
.lyl-hero .lyl-line{background:var(--lyl-paper)}
.lyl-gauge{grid-column:10/span 3;grid-row:1;align-self:start;justify-self:end;width:100%;max-width:300px;margin-top:6px;padding:16px 16px 14px;background:var(--lyl-paper);box-shadow:0 0 0 1px var(--lyl-rule);cursor:auto}
.lyl-glabel{font-size:13px;color:var(--lyl-muted);display:flex;justify-content:space-between;gap:8px}
.lyl-gval{display:flex;align-items:flex-start;font-weight:700;font-size:clamp(64px,6vw,96px);line-height:.9;letter-spacing:-.06em;margin:10px 0 14px}
.lyl-gval small{font-size:.36em;letter-spacing:-.02em;margin:.12em 0 0 .08em}
.lyl-throw{width:100%;justify-content:space-between}
.lyl-hint{font-size:13px;color:var(--lyl-muted);margin-top:10px}
.lyl-marks{position:absolute;inset:0;pointer-events:none;z-index:0}
.lyl-reg{position:absolute;width:13px;height:13px;transform:translate(-50%,-50%)}
.lyl-reg::before,.lyl-reg::after{content:"";position:absolute;background:var(--lyl-ink);opacity:.55}
.lyl-reg::before{left:6px;top:0;width:1px;height:13px}
.lyl-reg::after{top:6px;left:0;height:1px;width:13px}
.lyl-vline{position:absolute;top:0;bottom:0;width:1px;background:var(--lyl-rule)}
.lyl-hline{position:absolute;left:0;right:0;height:1px;background:var(--lyl-rule)}

.lyl-sec{position:relative;padding-block:clamp(72px,9vw,136px);border-top:1px solid var(--lyl-rule)}
.lyl-sec::before,.lyl-sec::after,.lyl-foot::before{content:"";position:absolute;top:-7px;width:13px;height:13px;z-index:2;opacity:.6;background:linear-gradient(var(--lyl-ink),var(--lyl-ink)) center/1px 100% no-repeat,linear-gradient(var(--lyl-ink),var(--lyl-ink)) center/100% 1px no-repeat;pointer-events:none}
.lyl-sec::before,.lyl-foot::before{left:calc(var(--lyl-pad) - 6px)}
.lyl-sec::after{right:calc(var(--lyl-pad) - 6px)}
.lyl-h2{font-weight:700;font-size:clamp(40px,5.6vw,92px);line-height:.9;letter-spacing:-.052em;margin-left:-.04em;text-wrap:balance}
.lyl-intro{font-size:clamp(17px,1.2vw,19px);line-height:1.5;color:var(--lyl-soft);max-width:44ch}
.lyl-rv[data-armed]{opacity:0;transform:translateY(28px);transition:opacity .8s var(--lyl-ease),transform .9s var(--lyl-ease)}
.lyl-rv[data-armed][data-in]{opacity:1;transform:none}

.lyl-shead{grid-column:1/-1;display:grid;grid-template-columns:subgrid;row-gap:20px;margin-bottom:clamp(36px,4vw,56px)}
.lyl-shead .lyl-h2{grid-column:1/span 8}
.lyl-shead .lyl-intro{grid-column:9/span 4;align-self:end}
.lyl-tabs{grid-column:1/-1;display:flex;gap:0;border-top:1px solid var(--lyl-ink);overflow-x:auto;scrollbar-width:none}
.lyl-tabs::-webkit-scrollbar{display:none}
.lyl-tab{position:relative;flex:1 0 auto;min-width:88px;padding:16px 4px 14px;text-align:left;font-size:15px;color:var(--lyl-muted);cursor:pointer;transition:color .2s}
.lyl-tab::before{content:"";position:absolute;left:0;right:12px;top:-1px;height:5px;background:var(--lyl-accent);transform:scaleX(0);transform-origin:left;transition:transform .25s var(--lyl-ease)}
.lyl-tab:hover{color:var(--lyl-ink)}
.lyl-tab[aria-selected="true"]{color:var(--lyl-ink);font-weight:700}
.lyl-tab[aria-selected="true"]::before{transform:none}
.lyl-rows{grid-column:1/-1}
.lyl-row{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));column-gap:clamp(12px,1.6vw,24px);align-items:center;padding:20px 0;border-top:1px solid var(--lyl-rule);transition:background-color .3s}
.lyl-row:last-child{border-bottom:1px solid var(--lyl-rule)}
.lyl-row:hover{background:var(--lyl-faint)}
.lyl-time{grid-column:1/span 2;font-weight:700;font-size:clamp(30px,3vw,46px);letter-spacing:-.05em;line-height:1}
.lyl-sname{grid-column:3/span 4}
.lyl-sname b{display:block;font-size:19px;letter-spacing:-.015em;font-weight:700}
.lyl-sname span{font-size:14px;color:var(--lyl-muted)}
.lyl-mins{grid-column:7/span 1;font-size:14px;color:var(--lyl-muted)}
.lyl-spots{grid-column:8/span 2;display:flex;flex-direction:column;gap:8px}
.lyl-meter{display:flex;flex-wrap:nowrap;gap:3px}
.lyl-meter i{width:7px;height:7px;border-radius:50%;box-shadow:inset 0 0 0 1px var(--lyl-ink);opacity:.8}
.lyl-meter i[data-on]{background:var(--lyl-ink);box-shadow:none;opacity:1}
.lyl-meter i[data-me]{background:var(--lyl-accent);box-shadow:none;opacity:1}
.lyl-left{font-size:13px;color:var(--lyl-muted)}
.lyl-price{grid-column:10/span 1;font-size:19px;font-weight:700;letter-spacing:-.02em}
.lyl-act{grid-column:11/span 2;justify-self:end;text-align:right}
.lyl-act .lyl-btn{min-width:150px;justify-content:space-between}
.lyl-msg{font-size:13px;color:var(--lyl-muted);margin-top:6px;max-width:220px}
.lyl-msg[data-err]{color:var(--lyl-ink);font-weight:700}
.lyl-done{background:var(--lyl-accent);color:var(--lyl-on)}
.lyl-done::before{display:none}

.lyl-rooms{grid-column:1/-1;display:grid;grid-template-columns:1.35fr 1fr 1fr;gap:clamp(12px,1.6vw,24px)}
.lyl-room{display:flex;flex-direction:column;gap:18px}
.lyl-plate{position:relative;height:clamp(340px,34vw,520px);background:var(--lyl-sheet);overflow:hidden}
.lyl-plate .lyl-canvas{transition:transform 1.2s var(--lyl-ease)}
.lyl-room:hover .lyl-plate .lyl-canvas{transform:scale(1.04)}
.lyl-plate .lyl-temp{position:absolute;left:14px;top:8px;color:var(--lyl-ink);z-index:1;font-weight:700;font-size:clamp(72px,7.4vw,124px);line-height:.9;letter-spacing:-.065em;display:flex}
.lyl-plate .lyl-temp small{font-size:.32em;letter-spacing:-.02em;margin:.14em 0 0 .06em}
.lyl-room h3{font-size:clamp(22px,1.9vw,28px);letter-spacing:-.03em;line-height:1.1;font-weight:700;display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.lyl-room h3 span{font-size:14px;font-weight:400;letter-spacing:0;color:var(--lyl-muted);white-space:nowrap}
.lyl-room p{font-size:16px;color:var(--lyl-soft);max-width:40ch}

.lyl-ritual{grid-column:1/-1;display:grid;grid-template-columns:subgrid;row-gap:clamp(40px,5vw,72px)}
.lyl-rhead{grid-column:1/span 9}
.lyl-rhead .lyl-intro{margin-top:24px}
.lyl-bar{grid-column:1/-1}
.lyl-track{display:flex;height:clamp(72px,7vw,104px);gap:3px}
.lyl-seg{position:relative;min-width:3px;transition:opacity .3s var(--lyl-ease)}
.lyl-seg[data-k="heat"]{background:radial-gradient(circle,var(--lyl-accent) 0 2.7px,transparent 3px) 0 0/8px 8px,var(--lyl-paper)}
.lyl-seg[data-k="cold"]{background:var(--lyl-cold)}
.lyl-seg[data-k="rest"]{background:radial-gradient(circle,var(--lyl-cold) 0 1.1px,transparent 1.4px) 0 0/8px 8px}
.lyl-seg[data-k="extra"]{background:radial-gradient(circle,var(--lyl-muted) 0 .9px,transparent 1.2px) 0 0/4px 4px}
.lyl-seg em{position:absolute;left:8px;right:6px;bottom:8px;padding:3px 6px;font-style:normal;font-size:13px;line-height:1.2;color:var(--lyl-ink);background:var(--lyl-paper);width:fit-content;max-width:calc(100% - 14px)}
.lyl-bar[data-focus] .lyl-seg{opacity:.4}
.lyl-bar[data-focus="heat"] .lyl-seg[data-k="heat"],.lyl-bar[data-focus="cold"] .lyl-seg[data-k="cold"],.lyl-bar[data-focus="rest"] .lyl-seg[data-k="rest"]{opacity:1}
.lyl-ticks{display:flex;justify-content:space-between;font-size:13px;color:var(--lyl-muted);margin-top:12px}
.lyl-steps{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(12px,1.6vw,24px)}
.lyl-step{display:flex;flex-direction:column;gap:12px;padding-top:18px;border-top:1px solid var(--lyl-ink);cursor:default}
.lyl-step h3{display:flex;align-items:baseline;gap:14px;font-size:clamp(28px,2.6vw,40px);letter-spacing:-.045em;line-height:1;font-weight:700}
.lyl-step h3 em{font-style:normal;font-size:15px;letter-spacing:0;font-weight:400;color:var(--lyl-muted)}
.lyl-sw{width:18px;height:18px;flex:none;align-self:center}
.lyl-step p{font-size:16px;color:var(--lyl-soft);max-width:34ch}
.lyl-step{transition:opacity .25s var(--lyl-ease)}
.lyl-steps[data-focus] .lyl-step{opacity:.45}
.lyl-steps[data-focus] .lyl-step[data-on]{opacity:1}

.lyl-ptop{grid-column:1/-1;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:24px;margin-bottom:clamp(36px,4vw,56px)}
.lyl-ptop .lyl-h2{max-width:12ch}
.lyl-switch{display:inline-flex;box-shadow:inset 0 0 0 1px var(--lyl-ink);padding:3px}
.lyl-switch button{height:40px;padding:0 16px;font-size:14px;cursor:pointer;transition:background-color .25s var(--lyl-ease),color .25s}
.lyl-switch button[aria-pressed="true"]{background:var(--lyl-ink);color:var(--lyl-paper)}
.lyl-switch button[aria-pressed="false"]:hover{background:var(--lyl-faint)}
.lyl-plans{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid var(--lyl-ink)}
.lyl-plan{position:relative;display:flex;flex-direction:column;gap:22px;padding:28px clamp(16px,2vw,32px) 32px;border-left:1px solid var(--lyl-rule)}
.lyl-plan:first-child{border-left:0;padding-left:0}
.lyl-plan[data-feat]{background:var(--lyl-accent);color:var(--lyl-on);border-left-color:transparent;padding-left:clamp(16px,2vw,32px);padding-bottom:84px}
.lyl-plan .lyl-btn{z-index:1}
.lyl-plan[data-feat] .lyl-pnote,.lyl-plan[data-feat] li{color:var(--lyl-on)}
.lyl-plan h3{font-size:19px;font-weight:700;letter-spacing:-.015em;display:flex;justify-content:space-between;gap:12px}
.lyl-plan h3 span{font-weight:400;font-size:13px}
.lyl-pprice{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.lyl-pprice b{font-size:clamp(56px,5.4vw,88px);line-height:.9;letter-spacing:-.06em;font-weight:700}
.lyl-pprice span{font-size:15px}
.lyl-pnote{font-size:16px;color:var(--lyl-soft)}
.lyl-plan ul{display:flex;flex-direction:column;gap:10px;font-size:15px;color:var(--lyl-soft);margin-bottom:6px}
.lyl-plan li{display:flex;gap:10px;align-items:baseline}
.lyl-plan li::before{content:"";flex:none;width:6px;height:6px;border-radius:50%;background:currentColor;transform:translateY(-2px)}
.lyl-plan .lyl-btn{margin-top:auto;align-self:flex-start}
.lyl-plan[data-feat] .lyl-solid::before{background:var(--lyl-paper)}
.lyl-plan[data-feat] .lyl-solid:hover,.lyl-plan[data-feat] .lyl-solid:focus-visible{color:var(--lyl-ink)}
.lyl-dots{position:absolute;left:0;right:0;bottom:0;height:56px;background:radial-gradient(circle,var(--lyl-paper) 0 2.2px,transparent 2.6px) 0 0/8px 8px;-webkit-mask-image:linear-gradient(to top,#000,transparent);mask-image:linear-gradient(to top,#000,transparent);pointer-events:none;opacity:.9}

.lyl-qsec{overflow:hidden;padding-block:clamp(56px,6vw,96px) clamp(72px,8vw,120px)}
.lyl-qsec>.lyl-grid{position:relative;z-index:1}
.lyl-quote{grid-column:1/span 8;display:flex;flex-direction:column;gap:clamp(28px,3vw,44px)}
.lyl-quote blockquote{font-weight:700;font-size:clamp(30px,3.7vw,58px);line-height:1.04;letter-spacing:-.045em;text-wrap:pretty}
.lyl-qmark{display:block;height:.42em;overflow:hidden;font-weight:700;font-size:clamp(170px,17vw,280px);line-height:.92;letter-spacing:0;margin-left:-.04em;background:radial-gradient(circle,var(--lyl-accent) 0 2.7px,transparent 3.1px) 0 0/8px 8px;-webkit-background-clip:text;background-clip:text;color:transparent}
.lyl-quote blockquote[data-anim]{animation:lyl-in .6s var(--lyl-ease)}
@keyframes lyl-in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.lyl-qfoot{display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap}
.lyl-who b{display:block;font-size:17px}
.lyl-who span{font-size:14px;color:var(--lyl-muted)}
.lyl-qnav{display:flex;align-items:center;gap:6px}
.lyl-qbtn{width:48px;height:48px;display:grid;place-items:center;background:var(--lyl-paper);box-shadow:inset 0 0 0 1px var(--lyl-ink);cursor:pointer;font-size:18px;transition:background-color .25s,color .25s}
.lyl-qbtn:hover{background:var(--lyl-ink);color:var(--lyl-paper)}
.lyl-pips{display:flex;gap:6px;margin:0 10px}
.lyl-pips i{width:8px;height:8px;border-radius:50%;box-shadow:inset 0 0 0 1px var(--lyl-ink);transition:background-color .3s}
.lyl-pips i[data-on]{background:var(--lyl-accent);box-shadow:none}

.lyl-fsec{padding-top:clamp(56px,6vw,96px)}
.lyl-faqh{grid-column:1/span 4;position:sticky;top:calc(var(--lyl-nav) + 40px);align-self:start}
.lyl-faql{grid-column:6/span 7;border-top:1px solid var(--lyl-ink)}
.lyl-q{position:relative;border-bottom:1px solid var(--lyl-rule)}
.lyl-q::before{content:"";position:absolute;left:-24px;top:27px;width:8px;height:0;background:radial-gradient(circle,var(--lyl-accent) 0 2.4px,transparent 2.8px) 0 0/8px 8px;transition:height .25s var(--lyl-ease)}
.lyl-q[data-on]::before{height:calc(100% - 50px)}
.lyl-qh{width:100%;display:flex;justify-content:space-between;align-items:center;gap:24px;padding:22px 0;text-align:left;font-size:clamp(18px,1.4vw,21px);font-weight:700;letter-spacing:-.02em;cursor:pointer}
.lyl-plus{position:relative;flex:none;width:16px;height:16px}
.lyl-plus::before,.lyl-plus::after{content:"";position:absolute;background:currentColor;transition:transform .35s var(--lyl-ease)}
.lyl-plus::before{left:0;right:0;top:7.5px;height:1.5px}
.lyl-plus::after{top:0;bottom:0;left:7.25px;width:1.5px}
.lyl-qh[aria-expanded="true"] .lyl-plus::after{transform:scaleY(0)}
.lyl-qh:hover .lyl-plus{color:var(--lyl-accent)}
.lyl-qa{display:grid;grid-template-rows:0fr;transition:grid-template-rows .25s var(--lyl-ease)}
.lyl-qa[data-open]{grid-template-rows:1fr}
.lyl-qa>div{overflow:hidden}
.lyl-qa p{padding:0 48px 24px 0;font-size:16px;color:var(--lyl-soft);max-width:58ch}

.lyl-foot{position:relative;border-top:1px solid var(--lyl-rule);padding-top:clamp(72px,9vw,128px)}
.lyl-visit{grid-column:1/span 6;display:flex;flex-direction:column;gap:32px}
.lyl-vgrid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.lyl-vgrid h3,.lyl-news h3{font-size:13px;font-weight:400;color:var(--lyl-muted);margin-bottom:10px}
.lyl-vgrid p,.lyl-vgrid li{font-size:16px}
.lyl-hours li{display:flex;justify-content:space-between;gap:16px;padding:6px 0;border-bottom:1px solid var(--lyl-rule)}
.lyl-hours li span:last-child{font-variant-numeric:tabular-nums}
.lyl-contact a{text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px;transition:text-decoration-color .2s}
.lyl-contact a:hover{text-decoration-color:var(--lyl-accent)}
.lyl-news{grid-column:8/span 5;display:flex;flex-direction:column;gap:16px}
.lyl-news h4{font-size:clamp(26px,2.4vw,36px);font-weight:700;line-height:1.02;letter-spacing:-.04em}
.lyl-news p{font-size:16px;color:var(--lyl-soft);max-width:42ch}
.lyl-form{display:flex;flex-direction:column;gap:8px;margin-top:8px}
.lyl-form label{font-size:13px;color:var(--lyl-muted)}
.lyl-field{display:flex;box-shadow:inset 0 0 0 1px var(--lyl-ink)}
.lyl-field input{flex:1;min-width:0;height:52px;padding:0 16px;font-size:16px}
.lyl-field input::placeholder{color:var(--lyl-muted)}
.lyl-field .lyl-btn{height:52px}
.lyl-field:focus-within{box-shadow:inset 0 0 0 2px var(--lyl-ink)}
.lyl-field input:focus-visible{outline:none}
.lyl-field[data-err]{box-shadow:inset 0 0 0 2px var(--lyl-accent)}
.lyl-ferr{display:flex;align-items:baseline;gap:8px;font-size:14px;font-weight:700}
.lyl-ferr::before{content:"";flex:none;width:8px;height:8px;border-radius:50%;background:var(--lyl-accent)}
.lyl-fok{font-size:15px}
.lyl-band{position:relative;height:clamp(150px,16vw,240px);margin-top:clamp(64px,8vw,112px);overflow:hidden}
.lyl-legal{display:flex;flex-wrap:wrap;justify-content:space-between;gap:16px 28px;padding-block:22px;font-size:13px;color:var(--lyl-muted)}
.lyl-legal nav{display:flex;flex-wrap:wrap;gap:8px 22px}
.lyl-legal a{display:inline-block;padding:4px 0;transition:color .2s}
.lyl-legal a:hover{color:var(--lyl-ink)}
.lyl-legal b{color:var(--lyl-ink);font-size:15px;letter-spacing:-.03em}

.lyl-sheet{position:fixed;inset:0;z-index:40;background:var(--lyl-paper);display:flex;flex-direction:column;padding:0 var(--lyl-pad) 32px;animation:lyl-sheet .35s var(--lyl-ease)}
@keyframes lyl-sheet{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:none}}
.lyl-sheet header{height:var(--lyl-nav);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--lyl-rule)}
.lyl-sheet nav{display:flex;flex-direction:column;margin-top:16px}
.lyl-sheet nav a{font-size:44px;font-weight:700;letter-spacing:-.05em;line-height:1.1;padding:8px 0;border-bottom:1px solid var(--lyl-rule)}
.lyl-sheet .lyl-btn{margin-top:auto;justify-content:space-between}

@media (max-width:1100px){
.lyl-links{gap:18px}
.lyl-tag{display:none}
.lyl-gauge{grid-column:8/span 5}
.lyl-lead{grid-column:1/span 6}
.lyl-rooms{grid-template-columns:repeat(3,minmax(0,1fr))}
.lyl-plate{height:clamp(260px,34vw,420px)}
}
@media (max-width:860px){
.lyl-links,.lyl-navr .lyl-solid{display:none}
.lyl-menu{display:block}
.lyl-navr{margin-left:auto}
.lyl-menu{margin-left:0}
.lyl-marks{display:none}
.lyl-hero{grid-template-rows:auto auto auto minmax(280px,1fr);min-height:max(820px,calc(clamp(620px,var(--lyl-h),1000px) - var(--lyl-nav)))}
.lyl-q::before{left:0;top:72px}
.lyl-q[data-on]::before{height:calc(100% - 96px)}
.lyl-q[data-on] .lyl-qa p{padding-left:22px}
.lyl-faqh{position:static}
.lyl-h1{grid-column:1/-1;grid-row:1;font-size:clamp(60px,17.5vw,150px)}
.lyl-lead{grid-column:1/-1;grid-row:2;margin-top:30px}
.lyl-gauge{grid-column:1/-1;grid-row:3;justify-self:stretch;max-width:none;display:grid;grid-template-columns:auto 1fr;align-items:center;column-gap:16px;margin-top:32px;padding:16px 0 0;background:transparent;box-shadow:none;border-top:1px solid var(--lyl-rule)}
.lyl-glabel{grid-column:1/-1}
.lyl-gval{grid-column:1;grid-row:2;margin:6px 0 0;font-size:56px}
.lyl-throw{grid-column:2;grid-row:2;height:48px;padding:0 14px;font-size:14px;margin-top:6px;justify-self:start;width:auto;max-width:100%}
.lyl-hint{grid-column:1/-1;grid-row:3}
.lyl-shead .lyl-h2,.lyl-shead .lyl-intro{grid-column:1/-1}
.lyl-row{grid-template-columns:auto 1fr auto;row-gap:12px;padding:18px 0}
.lyl-time{grid-column:1;grid-row:1;font-size:30px}
.lyl-sname{grid-column:2/span 2;grid-row:1;padding-left:4px}
.lyl-mins{display:none}
.lyl-spots{grid-column:1/span 2;grid-row:2;flex-direction:row;align-items:center;flex-wrap:wrap;gap:6px 12px}
.lyl-price{grid-column:3;grid-row:2;justify-self:end}
.lyl-act{grid-column:1/-1;grid-row:3;justify-self:stretch;text-align:left}
.lyl-act .lyl-btn{width:100%}
.lyl-msg{max-width:none}
.lyl-plate{height:260px}
.lyl-room h3{flex-direction:column;gap:4px}
.lyl-rhead{grid-column:1/-1}
.lyl-track{height:64px;gap:2px}
.lyl-xname{display:none}
.lyl-seg em{left:3px;bottom:4px;padding:2px 3px;font-size:11px}
.lyl-tabs{-webkit-mask-image:linear-gradient(to right,#000 80%,transparent);mask-image:linear-gradient(to right,#000 80%,transparent)}
.lyl-plan{padding-inline:14px}
.lyl-plan:first-child{padding-left:0}
.lyl-pprice b{font-size:44px}
.lyl-quote{grid-column:1/-1}
.lyl-faqh,.lyl-faql{grid-column:1/-1}
.lyl-faqh{margin-bottom:32px}
.lyl-qa p{padding-right:0}
.lyl-visit,.lyl-news{grid-column:1/-1}
.lyl-news{margin-top:56px}
.lyl-vgrid{grid-template-columns:1fr}
}
@media (max-width:600px){
.lyl-rooms{grid-template-columns:1fr}
.lyl-plate{height:300px}
.lyl-room h3{flex-direction:row}
.lyl-steps{grid-template-columns:1fr;gap:28px}
.lyl-plans{grid-template-columns:1fr}
.lyl-plan,.lyl-plan:first-child{border-left:0;border-top:1px solid var(--lyl-rule);padding:28px 0 32px}
.lyl-plan:first-child{border-top:0}
.lyl-plan[data-feat]{margin-inline:calc(-1 * var(--lyl-pad));padding:28px var(--lyl-pad) 84px}
.lyl-throw{justify-self:stretch;width:100%}
}
@media (max-width:420px){
.lyl-field{flex-direction:column;box-shadow:none;gap:8px}
.lyl-field input{flex:none;box-shadow:inset 0 0 0 1px var(--lyl-ink)}
.lyl-field input:focus-visible{box-shadow:inset 0 0 0 2px var(--lyl-ink)}
.lyl-field .lyl-btn{justify-content:space-between}
}
@media (prefers-reduced-motion:reduce){
.lyl-root *,.lyl-root *::before,.lyl-root *::after{transition-duration:0s !important;animation-duration:0s !important}
.lyl-rv[data-armed]{opacity:1;transform:none}
}
`

type BookState = { [id: string]: { s: "busy" | "done" | "error"; wait: boolean } }

export default function LoylySaunaLanding({
  brand = "Kiuas",
  tagline = "Public sauna and cold plunge",
  links = DEFAULT_LINKS,
  hero,
  heat,
  sessions,
  rooms,
  ritual,
  plans,
  quotes = DEFAULT_QUOTES,
  faq,
  visit = DEFAULT_VISIT,
  newsletter,
  footer,
  currency = "€",
  ink = "safety",
  theme = "system",
  onBook,
  onSubscribe,
  onThrow,
  themeToggle = true,
  height = "100svh",
  className,
}: LoylySaunaLandingProps) {
  const rootRef = React.useRef(null as HTMLDivElement | null)
  const reduced = useReducedMotion()
  const [dark, setDark] = useTheme(theme)
  const inks = resolveInk(ink)
  const inkKey = inks.accent + (dark ? "d" : "l")
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "")

  const H = { ...DEFAULT_HERO, ...(hero || {}) }
  const HT = { ...DEFAULT_HEAT, ...(heat || {}) }
  const S = sessions === null ? null : { title: "This week at the pier.", text: "Every session runs on the hour you book and includes all three rooms. Towels and a locker are on us; bring a swimsuit.", days: DEFAULT_DAYS, ...(sessions || {}) }
  const R = rooms === null ? null : { title: "Three rooms, three temperatures.", items: DEFAULT_ROOMS, unit: "°C", ...(rooms || {}) }
  const RT = ritual === null ? null : { title: "One round is heat, cold, rest. Do three.", text: "A session is 90 minutes. Most people find their rhythm by the second round; the host on the deck will show you the first one.", steps: DEFAULT_STEPS, rounds: 3, extra: { name: "Showers and changing", minutes: 18 }, ...(ritual || {}) }
  const P = plans === null ? null : { title: "Come once, or every week.", items: DEFAULT_PLANS, yearlyNote: "", ...(plans || {}) }
  const F = faq === null ? null : { title: "Before your first visit.", items: DEFAULT_FAQ, ...(faq || {}) }
  const N = newsletter === null ? null : { ...DEFAULT_NEWSLETTER, ...(newsletter || {}) }
  const FT = footer === null ? null : { ...DEFAULT_FOOTER, ...(footer || {}) }

  useReveal(rootRef, reduced)

  const go = (href?: string) => (e: React.MouseEvent) => {
    if (!href || href.charAt(0) !== "#" || href.length < 2) return
    const el = rootRef.current && rootRef.current.querySelector('[data-sec="' + href.slice(1) + '"]')
    if (!el) return
    e.preventDefault()
    setMenu(false)
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" })
  }

  /* ---------- nav ---------- */
  const [menu, setMenu] = React.useState(false)
  const menuBtn = React.useRef(null as HTMLButtonElement | null)
  const sheetRef = React.useRef(null as HTMLDivElement | null)
  React.useEffect(() => {
    if (!menu) return
    const first = sheetRef.current && (sheetRef.current.querySelector("a,button") as HTMLElement | null)
    if (first) first.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false)
        if (menuBtn.current) menuBtn.current.focus()
      }
      if (e.key === "Tab" && sheetRef.current) {
        const f = Array.from(sheetRef.current.querySelectorAll("a,button")) as HTMLElement[]
        if (!f.length) return
        const a = f[0]
        const z = f[f.length - 1]
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault()
          z.focus()
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault()
          a.focus()
        }
      }
    }
    document.addEventListener("keydown", key)
    return () => document.removeEventListener("keydown", key)
  }, [menu])

  /* ---------- hero ---------- */
  const engine = React.useRef(null as HalftoneHandle | null)
  const gaugeRef = React.useRef(null as HTMLSpanElement | null)
  const [said, setSaid] = React.useState("")
  const onHeat = React.useCallback(
    (lv: number) => {
      if (gaugeRef.current) gaugeRef.current.textContent = String(Math.round(HT.base + HT.rise * lv))
    },
    [HT.base, HT.rise]
  )
  const throwWater = (x?: number, y?: number) => {
    if (engine.current) engine.current.kick(x, y)
    setSaid(HT.said.replace("{n}", String(Math.round(HT.base + HT.rise))))
    if (onThrow) onThrow()
  }
  const heroClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement
    if (t.closest("a,button,input,.lyl-gauge,.lyl-lead")) return
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    throwWater(e.clientX - r.left, e.clientY - r.top)
  }

  /* ---------- sessions ---------- */
  const days = (S && S.days) || []
  const [day, setDay] = React.useState(0)
  const [book, setBook] = React.useState({} as BookState)
  const tabRefs = React.useRef([] as (HTMLButtonElement | null)[])
  const alive = React.useRef(true)
  React.useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const doBook = async (s: LylSession, d: LylDay, wait: boolean) => {
    const cur = book[s.id]
    if (cur && (cur.s === "busy" || cur.s === "done")) return
    setBook((b) => ({ ...b, [s.id]: { s: "busy", wait } }))
    let ok = true
    try {
      if (onBook) {
        const res = await onBook(s, d, wait)
        if (res === false) ok = false
      } else {
        await new Promise((r) => setTimeout(r, 650))
      }
    } catch {
      ok = false
    }
    if (!alive.current) return
    setBook((b) => ({ ...b, [s.id]: { s: ok ? "done" : "error", wait } }))
  }

  /* ---------- ritual ---------- */
  const [focusKind, setFocusKind] = React.useState("" as "" | LylKind)
  const rit = RT ? ritualSegments(RT.steps, RT.rounds, RT.extra) : null

  /* ---------- plans ---------- */
  const [yearly, setYearly] = React.useState(false)
  const hasYearly = !!(P && P.items.some((p) => p.yearly != null))
  const free = P ? Math.max(0, ...P.items.map(monthsFree)) : 0

  /* ---------- quotes ---------- */
  const [qi, setQi] = React.useState(0)
  const [qAnim, setQAnim] = React.useState(false)
  const qs = quotes || []
  const moveQ = (d: number) => {
    setQAnim(true)
    setQi((i) => (i + d + qs.length) % qs.length)
  }

  /* ---------- faq ---------- */
  const [open, setOpen] = React.useState(0)

  /* ---------- newsletter ---------- */
  const [email, setEmail] = React.useState("")
  const [nState, setNState] = React.useState("idle" as "idle" | "busy" | "done" | "error" | "invalid")
  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isEmail(email)) return setNState("invalid")
    setNState("busy")
    let ok = true
    try {
      if (onSubscribe) {
        const res = await onSubscribe(email.trim())
        if (res === false) ok = false
      } else await new Promise((r) => setTimeout(r, 500))
    } catch {
      ok = false
    }
    if (alive.current) setNState(ok ? "done" : "error")
  }

  const navLinks = links || []

  return (
    <div
      ref={rootRef}
      className={"lyl-root " + (className || "")}
      data-theme={dark ? "dark" : "light"}
      style={{ "--lyl-h": height, "--lyl-accent": inks.accent, "--lyl-on": inks.onAccent } as React.CSSProperties}
    >
      <style>{LYL_CSS}</style>
      <a className="lyl-skip" href={"#" + uid + "-main"} onClick={go("#sessions")}>
        Saltar a las reservas
      </a>

      <header className="lyl-nav lyl-wrap">
        <div className="lyl-brand">
          <a href="#top" className="lyl-word" onClick={(e) => { e.preventDefault(); rootRef.current && rootRef.current.scrollIntoView({ behavior: reduced ? "auto" : "smooth" }) }}>
            {brand}
          </a>
          {tagline ? <span className="lyl-tag">{tagline}</span> : null}
        </div>
        <nav className="lyl-links" aria-label="Secciones">
          {navLinks.map((l) => (
            <a key={l.label} className="lyl-link" href={l.href || "#"} onClick={go(l.href)}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="lyl-navr">
          {themeToggle ? (
            <button type="button" className="lyl-stock" onClick={() => setDark(!dark)} aria-label={"Tema " + (dark ? "claro" : "oscuro")}>
              <span className="lyl-moon" aria-hidden="true" />
              {dark ? "Claro" : "Oscuro"}
            </button>
          ) : null}
          <a className="lyl-btn lyl-solid lyl-sm" href={H.ctaHref} onClick={go(H.ctaHref)}>
            {H.cta}
          </a>
        </div>
        <button ref={menuBtn} type="button" className="lyl-menu" aria-expanded={menu} aria-controls={uid + "-sheet"} onClick={() => setMenu(true)}>
          Menú
        </button>
      </header>

      {menu ? (
        <div className="lyl-sheet" id={uid + "-sheet"} ref={sheetRef} role="dialog" aria-modal="true" aria-label="Menú">
          <header>
            <span className="lyl-word">{brand}</span>
            <button type="button" className="lyl-stock" onClick={() => { setMenu(false); menuBtn.current && menuBtn.current.focus() }}>
              Cerrar
            </button>
          </header>
          <nav aria-label="Secciones">
            {navLinks.map((l) => (
              <a key={l.label} href={l.href || "#"} onClick={go(l.href)}>
                {l.label}
              </a>
            ))}
          </nav>
          <a className="lyl-btn lyl-solid" href={H.ctaHref} onClick={go(H.ctaHref)}>
            {H.cta} <span className="lyl-arr" aria-hidden="true">{"→"}</span>
          </a>
        </div>
      ) : null}

      <main id={uid + "-main"}>
        <section className="lyl-hero lyl-wrap" aria-labelledby={uid + "-h1"} onClick={heroClick}>
          <Halftone kind="hero" pitch={9} budget={15000} live reduced={reduced} inkKey={inkKey} handle={engine} onHeat={onHeat} quiet=".lyl-lead p, .lyl-gauge" calm=".lyl-h1 span, .lyl-ctas a" />
          <div className="lyl-marks" aria-hidden="true">
            <i className="lyl-vline" style={{ left: "calc(var(--lyl-pad) + (100% - 2 * var(--lyl-pad)) * .3333)" }} />
            <i className="lyl-vline" style={{ left: "calc(var(--lyl-pad) + (100% - 2 * var(--lyl-pad)) * .6667)" }} />
            <i className="lyl-hline" style={{ top: "62%" }} />
            <i className="lyl-reg" style={{ left: "calc(var(--lyl-pad) + (100% - 2 * var(--lyl-pad)) * .3333)", top: "62%" }} />
            <i className="lyl-reg" style={{ left: "calc(var(--lyl-pad) + (100% - 2 * var(--lyl-pad)) * .6667)", top: "62%" }} />
          </div>
          <h1 className="lyl-h1" id={uid + "-h1"}>
            {H.title.split(/(?<=\s)(?=\S+\.?$)/).map((part, i) => (
              <span key={i}>{part}</span>
            ))}
          </h1>
          <div className="lyl-lead">
            <p>{H.text}</p>
            <div className="lyl-ctas">
              <a className="lyl-btn lyl-solid" href={H.ctaHref} onClick={go(H.ctaHref)}>
                {H.cta} <span className="lyl-arr" aria-hidden="true">{"→"}</span>
              </a>
              {H.secondary ? (
                <a className="lyl-btn lyl-line" href={H.secondaryHref} onClick={go(H.secondaryHref)}>
                  {H.secondary}
                </a>
              ) : null}
            </div>
          </div>
          <div className="lyl-gauge">
            <p className="lyl-glabel">
              <span>{HT.label}</span>
            </p>
            <p className="lyl-gval lyl-num" aria-hidden="true">
              <span ref={gaugeRef}>{HT.base}</span>
              <small>{HT.unit}</small>
            </p>
            <button type="button" className="lyl-btn lyl-solid lyl-throw" onClick={() => throwWater()}>
              {HT.button} <span className="lyl-arr" aria-hidden="true">{"↑"}</span>
            </button>
            {HT.hint ? <p className="lyl-hint">{HT.hint}</p> : null}
            <p className="lyl-sr" aria-live="polite">
              {said}
            </p>
          </div>
        </section>

        {S ? (
          <section className="lyl-sec lyl-wrap" data-sec="sessions" aria-labelledby={uid + "-s"}>
            <div className="lyl-grid">
              <div className="lyl-shead">
                <h2 className="lyl-h2 lyl-rv" id={uid + "-s"}>
                  {S.title}
                </h2>
                {S.text ? <p className="lyl-intro">{S.text}</p> : null}
              </div>
              <div className="lyl-tabs" role="tablist" aria-label="Día">
                {days.map((d, i) => (
                  <button
                    key={d.label}
                    ref={(el) => {
                      tabRefs.current[i] = el
                    }}
                    type="button"
                    role="tab"
                    id={uid + "-t" + i}
                    aria-selected={day === i}
                    aria-controls={uid + "-p"}
                    aria-label={d.full || d.label}
                    tabIndex={day === i ? 0 : -1}
                    className="lyl-tab lyl-num"
                    onClick={() => setDay(i)}
                    onKeyDown={(e) => {
                      const n = nextIndex(i, e.key, days.length)
                      if (n !== i) {
                        e.preventDefault()
                        setDay(n)
                        const t = tabRefs.current[n]
                        if (t) t.focus()
                      }
                    }}
                  >
                    {i === 0 ? "Hoy" : d.label}
                  </button>
                ))}
              </div>
              <div className="lyl-rows" role="tabpanel" id={uid + "-p"} aria-labelledby={uid + "-t" + day}>
                {(days[day] ? days[day].sessions : []).map((s) => {
                  const st = book[s.id]
                  const mine = st && st.s === "done" && !st.wait ? 1 : 0
                  const left = spotsLeft(s, mine)
                  const full = s.capacity - s.booked <= 0
                  const wait = full
                  const dots = Math.min(s.capacity, 14)
                  const per = s.capacity / dots
                  return (
                    <div className="lyl-row" key={s.id}>
                      <p className="lyl-time lyl-num">{s.time}</p>
                      <div className="lyl-sname">
                        <b>{s.name}</b>
                        {s.note ? <span>{s.note}</span> : null}
                      </div>
                      <p className="lyl-mins lyl-num">{s.minutes} min</p>
                      <div className="lyl-spots">
                        <span className="lyl-meter" aria-hidden="true">
                          {Array.from({ length: dots }, (_, i) => {
                            const taken = i * per < s.booked
                            const me = mine && !taken && i * per < s.booked + 1
                            return <i key={i} data-on={taken ? "" : undefined} data-me={me ? "" : undefined} />
                          })}
                        </span>
                        <span className="lyl-left lyl-num">{full ? "Sin cupo" : left === 1 ? "1 lugar libre" : left + " de " + s.capacity + " lugares libres"}</span>
                      </div>
                      <p className="lyl-price lyl-num">{s.price > 0 ? formatPrice(s.price, currency) : ""}</p>
                      <div className="lyl-act">
                        {st && st.s === "done" ? (
                          <span className="lyl-btn lyl-sm lyl-done" role="status">
                            {st.wait ? "En lista de espera" : "Reservado"} <span aria-hidden="true">{"✓"}</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className={"lyl-btn lyl-sm " + (wait ? "lyl-line" : "lyl-solid")}
                            onClick={() => days[day] && doBook(s, days[day], wait)}
                            disabled={!!st && st.s === "busy"}
                            aria-label={(wait ? "Entrar a la lista de espera de " : "Reservar ") + s.name + " a las " + s.time + ", " + (days[day] ? days[day].full || days[day].label : "")}
                          >
                            {st && st.s === "busy" ? (wait ? "Entrando…" : "Reservando…") : wait ? "Lista de espera" : "Reservar"}
                            <span className="lyl-arr" aria-hidden="true">{"→"}</span>
                          </button>
                        )}
                        {st && st.s === "done" ? (
                          <p className="lyl-msg">{st.wait ? "Te avisamos si se libera un lugar." : "Te esperamos a las " + s.time + ". La confirmación llega a tu correo."}</p>
                        ) : st && st.s === "error" ? (
                          <p className="lyl-msg" data-err="">
                            No se pudo completar. Intenta de nuevo.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        ) : null}

        {R ? (
          <section className="lyl-sec lyl-wrap" data-sec="rooms" aria-labelledby={uid + "-r"}>
            <div className="lyl-grid">
              <div className="lyl-shead">
                <h2 className="lyl-h2 lyl-rv" id={uid + "-r"}>
                  {R.title}
                </h2>
              </div>
              <div className="lyl-rooms">
                {R.items.map((r) => (
                  <article className="lyl-room" key={r.name}>
                    <div className="lyl-plate">
                      <Halftone kind={r.kind} pitch={8} budget={6000} reduced={reduced} inkKey={inkKey} quiet=".lyl-temp" />
                      <p className="lyl-temp lyl-num" aria-hidden="true">
                        {r.temp}
                        <small>{R ? R.unit : "°C"}</small>
                      </p>
                    </div>
                    <h3>
                      {r.name}
                      <span className="lyl-sr">, {r.temp} degrees. Stay </span>
                      <span>{r.stay}</span>
                    </h3>
                    <p>{r.text}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {RT && rit ? (
          <section className="lyl-sec lyl-wrap" data-sec="ritual" aria-labelledby={uid + "-rt"}>
            <div className="lyl-grid">
              <div className="lyl-ritual">
                <div className="lyl-rhead">
                  <h2 className="lyl-h2 lyl-rv" id={uid + "-rt"}>
                    {RT.title}
                  </h2>
                  {RT.text ? <p className="lyl-intro">{RT.text}</p> : null}
                </div>
                <figure className="lyl-bar" data-focus={focusKind || undefined}>
                  <div className="lyl-track" role="img" aria-label={"A " + rit.total + "-minute session: " + rit.segs.map((s) => s.name + " " + s.minutes + " min").join(", ")}>
                    {rit.segs.map((s, i) => (
                      <span key={i} className="lyl-seg" data-k={s.kind} style={{ flexGrow: s.minutes, flexBasis: 0 }}>
                        {s.kind === "extra" ? (
                          <em aria-hidden="true">
                            <span className="lyl-xname">{s.name}, </span>
                            {s.minutes} min
                          </em>
                        ) : null}
                      </span>
                    ))}
                  </div>
                  <figcaption className="lyl-ticks lyl-num">
                    <span>0 min</span>
                    <span>{Math.round(rit.total / 2)} min</span>
                    <span>{rit.total} min</span>
                  </figcaption>
                </figure>
                <div className="lyl-steps" data-focus={focusKind || undefined}>
                  {RT.steps.map((s) => (
                    <article
                      key={s.name}
                      className="lyl-step"
                      data-on={focusKind === s.kind ? "" : undefined}
                      onMouseEnter={() => setFocusKind(s.kind)}
                      onMouseLeave={() => setFocusKind("")}
                    >
                      <h3>
                        <svg className="lyl-sw" viewBox="0 0 18 18" aria-hidden="true">
                          {s.kind === "cold" ? (
                            <rect width="18" height="18" fill="var(--lyl-cold)" />
                          ) : s.kind === "heat" ? (
                            [0, 6, 12].map((x) => [0, 6, 12].map((y) => <circle key={x + "-" + y} cx={x + 3} cy={y + 3} r="2.6" fill="var(--lyl-accent)" />))
                          ) : (
                            [0, 6, 12].map((x) => [0, 6, 12].map((y) => <circle key={x + "-" + y} cx={x + 3} cy={y + 3} r="1.1" fill="var(--lyl-cold)" />))
                          )}
                        </svg>
                        {s.name}
                        <em className="lyl-num">
                          {s.minutes} min, {RT.rounds}×
                        </em>
                      </h3>
                      <p>{s.text}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {P ? (
          <section className="lyl-sec lyl-wrap" data-sec="membership" aria-labelledby={uid + "-m"}>
            <div className="lyl-grid">
              <div className="lyl-ptop">
                <div>
                  <h2 className="lyl-h2 lyl-rv" id={uid + "-m"}>
                    {P.title}
                  </h2>
                  {P.text ? <p className="lyl-intro" style={{ marginTop: 20 }}>{P.text}</p> : null}
                </div>
                {hasYearly ? (
                  <div className="lyl-switch" role="group" aria-label="Periodo de cobro">
                    <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>
                      Mensual
                    </button>
                    <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>
                      Anual{free > 0 ? ", " + free + " meses gratis" : ""}
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="lyl-plans">
                {P.items.map((p) => (
                  <article className="lyl-plan" key={p.name} data-feat={p.featured ? "" : undefined}>
                    <h3>
                      {p.name}
                      {p.featured ? <span>{p.badge || "Más elegido"}</span> : null}
                    </h3>
                    <p className="lyl-pprice">
                      <b className="lyl-num">{p.price === 0 && p.yearly == null ? "A tu medida" : formatPrice(planPrice(p, yearly), currency)}</b>
                      <span>{planUnit(p, yearly)}</span>
                    </p>
                    <p className="lyl-pnote">{p.text}</p>
                    <ul>
                      {p.features.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                    <a
                      className={"lyl-btn " + (p.featured ? "lyl-solid" : "lyl-line")}
                      href={p.href || "#sessions"}
                      onClick={(e) => {
                        if (p.onSelect) p.onSelect(p, yearly)
                        go(p.href || "#sessions")(e)
                      }}
                    >
                      {p.cta} <span className="lyl-arr" aria-hidden="true">{"→"}</span>
                    </a>
                    {p.featured ? <span className="lyl-dots" aria-hidden="true" /> : null}
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {qs.length ? (
          <section className="lyl-sec lyl-wrap lyl-qsec" aria-label="Lo que dicen nuestros clientes">
            <Halftone kind="drift" pitch={9} budget={7000} reduced={reduced} inkKey={inkKey} quiet=".lyl-quote blockquote, .lyl-qfoot" />
            <div className="lyl-grid">
              <figure className="lyl-quote">
                <span className="lyl-qmark" aria-hidden="true">
                  {"“"}
                </span>
                <blockquote key={qi} data-anim={qAnim ? "" : undefined}>
                  {qs[qi].quote}
                </blockquote>
                <figcaption className="lyl-qfoot">
                  <span className="lyl-who">
                    <b>{qs[qi].name}</b>
                    <span>{qs[qi].role}</span>
                  </span>
                  {qs.length > 1 ? (
                    <span className="lyl-qnav">
                      <button type="button" className="lyl-qbtn" onClick={() => moveQ(-1)} aria-label="Cita anterior">
                        {"←"}
                      </button>
                      <span className="lyl-pips" aria-hidden="true">
                        {qs.map((_, i) => (
                          <i key={i} data-on={i === qi ? "" : undefined} />
                        ))}
                      </span>
                      <button type="button" className="lyl-qbtn" onClick={() => moveQ(1)} aria-label="Cita siguiente">
                        {"→"}
                      </button>
                    </span>
                  ) : null}
                </figcaption>
              </figure>
            </div>
          </section>
        ) : null}

        {F ? (
          <section className="lyl-sec lyl-wrap lyl-fsec" aria-labelledby={uid + "-f"}>
            <div className="lyl-grid">
              <h2 className="lyl-h2 lyl-faqh lyl-rv" id={uid + "-f"}>
                {F.title}
              </h2>
              <div className="lyl-faql">
                {F.items.map((it, i) => {
                  const on = open === i
                  return (
                    <div className="lyl-q" key={it.q} data-on={on ? "" : undefined}>
                      <h3>
                        <button type="button" className="lyl-qh" aria-expanded={on} aria-controls={uid + "-a" + i} id={uid + "-q" + i} onClick={() => setOpen(on ? -1 : i)}>
                          {it.q}
                          <span className="lyl-plus" aria-hidden="true" />
                        </button>
                      </h3>
                      <div className="lyl-qa" id={uid + "-a" + i} role="region" aria-labelledby={uid + "-q" + i} data-open={on ? "" : undefined}>
                        <div>
                          <p>{it.a}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        ) : null}
      </main>

      <footer className="lyl-foot" data-sec="visit">
        <div className="lyl-wrap lyl-grid">
          {visit ? (
            <div className="lyl-visit">
              <h2 className="lyl-h2 lyl-rv">{visit.title || DEFAULT_VISIT.title}</h2>
              <div className="lyl-vgrid">
                <div>
                  <h3>Dirección</h3>
                  <address style={{ fontStyle: "normal" }} className="lyl-contact">
                    {visit.address.map((l) => (
                      <p key={l}>{l}</p>
                    ))}
                    {visit.email ? (
                      <p style={{ marginTop: 12 }}>
                        <a href={"mailto:" + visit.email}>{visit.email}</a>
                      </p>
                    ) : null}
                    {visit.phone ? (
                      <p>
                        <a href={"tel:" + visit.phone.replace(/\s/g, "")}>{visit.phone}</a>
                      </p>
                    ) : null}
                  </address>
                </div>
                <div>
                  <h3>Horario</h3>
                  <ul className="lyl-hours">
                    {visit.hours.map((hh) => (
                      <li key={hh.days}>
                        <span>{hh.days}</span>
                        <span>{hh.time}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}
          {N ? (
            <div className="lyl-news">
              <h4>{N.title}</h4>
              <p>{N.text}</p>
              {nState === "done" ? (
                <p className="lyl-fok" role="status">
                  {N.done}
                </p>
              ) : (
                <form className="lyl-form" onSubmit={subscribe} noValidate>
                  <label htmlFor={uid + "-email"}>Correo electrónico</label>
                  <div className="lyl-field" data-err={nState === "invalid" || nState === "error" ? "" : undefined}>
                    <input
                      id={uid + "-email"}
                      type="email"
                      autoComplete="email"
                      placeholder="tu@correo.com"
                      value={email}
                      aria-invalid={nState === "invalid" || undefined}
                      aria-describedby={nState === "invalid" || nState === "error" ? uid + "-ferr" : undefined}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (nState === "invalid" || nState === "error") setNState("idle")
                      }}
                    />
                    <button type="submit" className="lyl-btn lyl-solid" disabled={nState === "busy"}>
                      {nState === "busy" ? "Enviando…" : N.button} <span className="lyl-arr" aria-hidden="true">{"→"}</span>
                    </button>
                  </div>
                  {nState === "invalid" ? (
                    <p className="lyl-ferr" id={uid + "-ferr"} role="alert">
                      Escribe un correo como nombre@ejemplo.com.
                    </p>
                  ) : nState === "error" ? (
                    <p className="lyl-ferr" id={uid + "-ferr"} role="alert">
                      No se pudo enviar. Intenta de nuevo en un minuto.
                    </p>
                  ) : null}
                </form>
              )}
            </div>
          ) : null}
        </div>
        <div className="lyl-band" aria-hidden="true">
          <Halftone kind="cool" pitch={9} budget={9000} reduced={reduced} inkKey={inkKey} />
        </div>
        {FT ? (
          <div className="lyl-legal lyl-wrap">
            <span>
              <b>{brand}</b>
              <span style={{ marginLeft: 12 }}>{FT.note}</span>
            </span>
            <nav aria-label="Footer">
              {(FT.links || []).map((l) => (
                <a key={l.label} href={l.href || "#"} onClick={go(l.href)}>
                  {l.label}
                </a>
              ))}
            </nav>
          </div>
        ) : null}
      </footer>
    </div>
  )
}
