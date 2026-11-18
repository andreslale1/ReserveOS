import Link from "next/link";
import { puedeVer, rutaHabilitada } from "@/lib/panel-context";

type Accion = { href: string; titulo: string; detalle: string };

const POR_ROL: Record<string, { saludo: string; acciones: Accion[] }> = {
  duena: { saludo: "Tu día en el estudio", acciones: [
    { href: "/panel/negocio", titulo: "Ver cómo va el negocio", detalle: "Ingresos, clientas y ocupación." },
    { href: "/panel/pagos-pendientes", titulo: "Aprobar pagos pendientes", detalle: "Transferencias por confirmar." },
    { href: "/panel/cuentas", titulo: "Revisar cuentas del equipo", detalle: "Quién entra y quién no." },
    { href: "/panel/configuracion", titulo: "Marca y configuración", detalle: "Logo, colores y reglas." } ] },
  gerente_general: { saludo: "Tu día en el estudio", acciones: [
    { href: "/panel/negocio", titulo: "Ver cómo va el negocio", detalle: "Ingresos, clientas y ocupación." },
    { href: "/panel/pagos-pendientes", titulo: "Aprobar pagos pendientes", detalle: "Transferencias por confirmar." },
    { href: "/panel/personal", titulo: "Equipo", detalle: "Altas, bajas y sedes." } ] },
  gerente_regional: { saludo: "Tus sedes hoy", acciones: [
    { href: "/panel/negocio", titulo: "Resultados de tus sedes", detalle: "Comparativo y ocupación." },
    { href: "/panel/pagos-pendientes", titulo: "Pagos por confirmar", detalle: "Transferencias de tus sedes." },
    { href: "/panel/instructoras", titulo: "Clases por instructora", detalle: "Sustituciones y asistencia." } ] },
  admin_sede: { saludo: "Tu sede hoy", acciones: [
    { href: "/panel/cobrar", titulo: "Cobrar en mostrador", detalle: "Paquete o producto a una clienta." },
    { href: "/panel/pagos-pendientes", titulo: "Pagos por confirmar", detalle: "Transferencias de tu sede." },
    { href: "/panel/caja", titulo: "Caja del día", detalle: "Cierre y movimientos." },
    { href: "/panel/personal", titulo: "Recepción e instructoras", detalle: "Tu equipo de sede." } ] },
  recepcion: { saludo: "Mostrador", acciones: [
    { href: "/panel/checkin", titulo: "Check-in de clientas", detalle: "Escanea el QR o busca por nombre." },
    { href: "/panel/cobrar", titulo: "Cobrar", detalle: "Vender un paquete o producto." },
    { href: "/panel/clientes", titulo: "Buscar una clienta", detalle: "Ficha, paquetes y reservas." },
    { href: "/panel/calendario", titulo: "Reservar por una clienta", detalle: "Desde el calendario." } ] },
  instructora: { saludo: "Tus clases", acciones: [
    { href: "/panel/instructoras", titulo: "Mis clases y asistencia", detalle: "Pasa lista de tu clase." },
    { href: "/panel/checkin", titulo: "Check-in", detalle: "Quién llegó." },
    { href: "/panel/privadas", titulo: "Clases privadas", detalle: "Tus sesiones 1 a 1." } ] },
  contadora: { saludo: "Finanzas", acciones: [
    { href: "/panel/finanzas", titulo: "Ingresos y gastos", detalle: "Por sede y por mes." },
    { href: "/panel/finanzas/registro", titulo: "Registrar gastos", detalle: "Gastos y balance." },
    { href: "/panel/facturacion", titulo: "Facturación", detalle: "IVA y documentos." },
    { href: "/panel/reportes", titulo: "Reportes", detalle: "Exportar a Excel." } ] },
  marketing: { saludo: "Marketing", acciones: [
    { href: "/panel/campanas", titulo: "Campañas", detalle: "Crear y revisar envíos." },
    { href: "/panel/seguimiento", titulo: "Seguimiento de clientas", detalle: "Segmentos y reactivación." } ] },
};

export default function QueHagoHoy({ rol, modulos }: { rol: string; modulos: string[] }) {
  const cfg = POR_ROL[rol];
  if (!cfg) return null;
  const acciones = cfg.acciones.filter((a) => puedeVer(rol, a.href) && rutaHabilitada(modulos, a.href));
  if (acciones.length === 0) return null;
  return (
    <section aria-label="Qué hago hoy" className="mx-auto max-w-5xl px-6 pt-6 md:px-10">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink/50">{cfg.saludo}</h2>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {acciones.map((a) => (
          <Link key={a.href} href={a.href} className="rounded-2xl border border-white/10 bg-card p-4 transition-colors hover:border-peach">
            <p className="text-sm font-semibold text-ink">{a.titulo}</p>
            <p className="mt-0.5 text-xs text-ink/60">{a.detalle}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
