// Catálogo de reportes exportables (CSV que abre en Excel). Cada reporte corre con la sesión de quien lo pide:
// el alcance por rol y sede lo pone la base de datos (RLS / funciones), no este archivo. `roles` solo decide quién ve el botón y quién puede pedirlo.
import type { SupabaseClient } from "@supabase/supabase-js";

export type Fila = (string | number | null)[];
export type Tabla = { cabeceras: string[]; filas: Fila[] };
export type Ctx = { tenantId: string; desde: string; hasta: string; sedeId: string | null };
export type Reporte = { id: string; titulo: string; descripcion: string; grupo: "Finanzas" | "Ventas" | "Clientas" | "Operación" | "Gestión"; roles: string[]; ejecutar: (db: SupabaseClient, c: Ctx) => Promise<Tabla> };

const G = ["duena", "gerente_general"];
const FIN = [...G, "contadora"];
const SEDE = [...FIN, "admin_sede", "gerente_regional"];

const ini = (f: string) => `${f}T00:00:00-06:00`;                        // Guatemala no tiene horario de verano: siempre UTC-6
const finExcl = (f: string) => `${new Date(Date.parse(`${f}T12:00:00Z`) + 86400000).toISOString().slice(0, 10)}T00:00:00-06:00`;
const nombreDe = (x: unknown) => (x as { nombre?: string; name?: string } | null)?.nombre ?? (x as { name?: string } | null)?.name ?? "";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Los constructores de consulta de supabase-js generan tipos enormes; aquí se trabaja con filas genéricas.
async function todo(q: (desde: number, hasta: number) => any): Promise<any[]> {
  const out: any[] = [];
  for (let d = 0; d < 20000; d += 1000) {
    const { data, error } = (await q(d, d + 999)) as { data: any[] | null; error: { message: string } | null };
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}
async function rpc<T = unknown>(db: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}
const clave = (o: Record<string, unknown> | null, etiquetas: Record<string, string>): Tabla => ({
  cabeceras: ["Concepto", "Valor"],
  filas: Object.entries(etiquetas).map(([k, l]) => [l, (o?.[k] as number | string | null) ?? null]),
});
const sedeFiltro = (q: any, col: string, c: Ctx): any => (c.sedeId ? q.eq(col, c.sedeId) : q);

export const REPORTES: Reporte[] = [
  {
    id: "ingresos", titulo: "Ingresos confirmados", grupo: "Finanzas", roles: FIN,
    descripcion: "Cada cobro confirmado del período (paquetes, tienda y cobros personalizados). La columna «Monto que cuenta» es 0 en lo anulado: suma esa columna y obtienes el ingreso confirmado.",
    async ejecutar(db, c) {
      const mem = await todo((a, b) => sedeFiltro(db.from("membresias").select("confirmado_at, precio_final, metodo_pago, estado, anulada_at, sede:sedes!sede_venta_id(name), clientes(nombre), paquetes(nombre)")
        .eq("tenant_id", c.tenantId).eq("pagada", true).gte("confirmado_at", ini(c.desde)).lt("confirmado_at", finExcl(c.hasta)), "sede_venta_id", c).order("confirmado_at").range(a, b));
      const ped = c.sedeId ? [] : await todo((a, b) => db.from("pedidos").select("pagado_at, total, metodo_pago, estado, sede:sedes!sede_entrega_id(name), clientes(nombre)")
        .eq("tenant_id", c.tenantId).in("estado", ["pagado", "entregado"]).gte("pagado_at", ini(c.desde)).lt("pagado_at", finExcl(c.hasta)).order("pagado_at").range(a, b));
      const ped2 = c.sedeId ? await todo((a, b) => db.from("pedidos").select("pagado_at, total, metodo_pago, estado, sede:sedes!sede_entrega_id(name), clientes(nombre)")
        .eq("tenant_id", c.tenantId).eq("sede_entrega_id", c.sedeId!).in("estado", ["pagado", "entregado"]).gte("pagado_at", ini(c.desde)).lt("pagado_at", finExcl(c.hasta)).order("pagado_at").range(a, b)) : ped;
      const otr = await todo((a, b) => sedeFiltro(db.from("cobros_personalizados").select("confirmado_at, concepto, monto, metodo_pago, sede:sedes!sede_id(name), clientes(nombre)")
        .eq("tenant_id", c.tenantId).gte("confirmado_at", ini(c.desde)).lt("confirmado_at", finExcl(c.hasta)), "sede_id", c).order("confirmado_at").range(a, b));
      const filas: Fila[] = [];
      for (const m of mem as unknown as Record<string, unknown>[]) { const anul = m.estado === "anulada"; filas.push(["Paquete", String(m.confirmado_at).slice(0, 10), nombreDe(m.sede), nombreDe(m.clientes), nombreDe(m.paquetes), String(m.metodo_pago ?? ""), Number(m.precio_final ?? 0), anul ? "Anulado" : "Confirmado", anul ? 0 : Number(m.precio_final ?? 0)]); }
      for (const p of ped2 as unknown as Record<string, unknown>[]) filas.push(["Tienda", String(p.pagado_at).slice(0, 10), nombreDe(p.sede), nombreDe(p.clientes), "Pedido de tienda", String(p.metodo_pago ?? ""), Number(p.total ?? 0), "Confirmado", Number(p.total ?? 0)]);
      for (const o of otr as unknown as Record<string, unknown>[]) filas.push(["Cobro personalizado", String(o.confirmado_at).slice(0, 10), nombreDe(o.sede), nombreDe(o.clientes), String(o.concepto ?? ""), String(o.metodo_pago ?? ""), Number(o.monto ?? 0), "Confirmado", Number(o.monto ?? 0)]);
      filas.sort((x, y) => String(x[1]).localeCompare(String(y[1])));
      return { cabeceras: ["Tipo", "Fecha", "Sede", "Clienta", "Concepto", "Método de pago", "Monto cobrado", "Estado", "Monto que cuenta"], filas };
    },
  },
  {
    id: "gastos", titulo: "Gastos", grupo: "Finanzas", roles: FIN, descripcion: "Gastos fijos y variables, operativos y de preinversión.",
    async ejecutar(db, c) {
      const g = await todo((a, b) => sedeFiltro(db.from("gastos").select("fecha, categoria, descripcion, tipo, etapa, monto, metodo_pago, sede:sedes!sede_id(name)")
        .eq("tenant_id", c.tenantId).gte("fecha", c.desde).lte("fecha", c.hasta), "sede_id", c).order("fecha").range(a, b));
      return { cabeceras: ["Fecha", "Sede", "Categoría", "Descripción", "Tipo", "Etapa", "Método de pago", "Monto"], filas: (g as unknown as Record<string, unknown>[]).map((x) => [String(x.fecha), nombreDe(x.sede), String(x.categoria), String(x.descripcion ?? ""), String(x.tipo), String(x.etapa), String(x.metodo_pago ?? ""), Number(x.monto)]) };
    },
  },
  {
    id: "iva", titulo: "IVA estimado", grupo: "Finanzas", roles: FIN, descripcion: "Débito, crédito e IVA por pagar sobre el ingreso confirmado y los gastos operativos.",
    async ejecutar(db, c) { return clave(await rpc(db, "kpi_iva_resumen", { p_tenant_id: c.tenantId, p_desde: c.desde, p_hasta: c.hasta }), { tasa: "Tasa", ingresos: "Ingreso confirmado", gastos_operativos: "Gastos operativos", debito_fiscal_estimado: "Débito fiscal", credito_fiscal_estimado: "Crédito fiscal", iva_por_pagar_estimado: "IVA por pagar" }); },
  },
  {
    id: "resumen-financiero", titulo: "Resumen financiero", grupo: "Finanzas", roles: FIN, descripcion: "Ingresos, gastos, márgenes, ocupación y punto de equilibrio del período.",
    async ejecutar(db, c) { return clave(await rpc(db, "kpi_finanzas_resumen", { p_tenant_id: c.tenantId, p_desde: c.desde, p_hasta: c.hasta }), { ingresos: "Ingreso confirmado", gastos_fijos: "Gastos fijos", gastos_variables: "Gastos variables", margen_contribucion: "Margen de contribución", margen_operativo: "Margen operativo", margen_operativo_pct: "Margen operativo (fracción)", ocupacion_pct: "Ocupación %", punto_equilibrio_q: "Punto de equilibrio (Q)", punto_equilibrio_clases: "Punto de equilibrio (clases)" }); },
  },
  {
    id: "serie-mensual", titulo: "Ingresos por mes (12 meses)", grupo: "Finanzas", roles: FIN, descripcion: "Cobrado, devoluciones, ingreso confirmado y gastos operativos por mes.",
    async ejecutar(db, c) {
      const s = await rpc<{ mes: string; bruto: number; devoluciones: number; neto: number; gastos: number }[]>(db, "finanzas_serie_confirmada", { p_tenant_id: c.tenantId, p_meses: 12, p_sede_id: c.sedeId });
      return { cabeceras: ["Mes", "Cobrado", "Devoluciones", "Ingreso confirmado", "Gastos operativos"], filas: s.map((x) => [x.mes.slice(0, 7), x.bruto, x.devoluciones, x.neto, x.gastos]) };
    },
  },
  {
    id: "ingresos-por-sede", titulo: "Ingresos por sede", grupo: "Finanzas", roles: [...FIN, "admin_sede", "gerente_regional"], descripcion: "Ingreso confirmado de cada sede, con la verificación de que suma el total del estudio.",
    async ejecutar(db, c) {
      const r = await rpc<{ sedes: { sede: string; paquetes: number; tienda: number; otros: number; devoluciones: number; neto: number }[] }>(db, "finanzas_atribucion", { p_tenant_id: c.tenantId, p_desde: c.desde, p_hasta: c.hasta });
      return { cabeceras: ["Sede", "Paquetes", "Tienda", "Otros cobros", "Devoluciones", "Ingreso confirmado"], filas: r.sedes.map((s) => [s.sede, s.paquetes, s.tienda, s.otros, s.devoluciones, s.neto]) };
    },
  },
  {
    id: "balance", titulo: "Balance general", grupo: "Finanzas", roles: FIN, descripcion: "Activos, pasivos, utilidad acumulada y patrimonio estimado.",
    async ejecutar(db, c) { return clave(await rpc(db, "kpi_balance_general", { p_tenant_id: c.tenantId }), { total_activos: "Activos", total_pasivos: "Pasivos", utilidad_acumulada: "Utilidad acumulada", patrimonio_estimado: "Patrimonio estimado" }); },
  },
  {
    id: "cuentas-por-cobrar", titulo: "Cuentas por cobrar", grupo: "Finanzas", roles: FIN, descripcion: "Lo pendiente de cobrar, con antigüedad.",
    async ejecutar(db, c) { return clave(await rpc(db, "kpi_cuentas_por_cobrar", { p_tenant_id: c.tenantId }), { total: "Total", bucket_0_30: "0 a 30 días", bucket_31_60: "31 a 60 días", bucket_61_90: "61 a 90 días", bucket_90_mas: "Más de 90 días" }); },
  },
  {
    id: "cuentas-por-pagar", titulo: "Cuentas por pagar", grupo: "Finanzas", roles: FIN, descripcion: "Pasivos pendientes, con antigüedad.",
    async ejecutar(db, c) { return clave(await rpc(db, "kpi_cuentas_por_pagar", { p_tenant_id: c.tenantId }), { total: "Total", bucket_0_30: "0 a 30 días", bucket_31_60: "31 a 60 días", bucket_61_90: "61 a 90 días", bucket_90_mas: "Más de 90 días" }); },
  },
  {
    id: "cierre-de-caja", titulo: "Cierres de caja", grupo: "Finanzas", roles: SEDE, descripcion: "Lo esperado contra lo contado por método y por día.",
    async ejecutar(db, c) {
      const r = await todo((a, b) => sedeFiltro(db.from("cierre_caja").select("fecha, notas, efectivo_sistema, efectivo_contado, tarjeta_sistema, tarjeta_contado, transferencia_sistema, transferencia_contado, sede:sedes!sede_id(name)")
        .eq("tenant_id", c.tenantId).gte("fecha", c.desde).lte("fecha", c.hasta), "sede_id", c).order("fecha").range(a, b));
      return { cabeceras: ["Fecha", "Sede", "Efectivo sistema", "Efectivo contado", "Tarjeta sistema", "Tarjeta contada", "Transferencia sistema", "Transferencia contada", "Notas"],
        filas: (r as unknown as Record<string, unknown>[]).map((x) => [String(x.fecha), nombreDe(x.sede), Number(x.efectivo_sistema ?? 0), Number(x.efectivo_contado ?? 0), Number(x.tarjeta_sistema ?? 0), Number(x.tarjeta_contado ?? 0), Number(x.transferencia_sistema ?? 0), Number(x.transferencia_contado ?? 0), String(x.notas ?? "")]) };
    },
  },
  {
    id: "ventas-tienda", titulo: "Ventas de tienda", grupo: "Ventas", roles: SEDE, descripcion: "Pedidos pagados o entregados, sin datos de la clienta.",
    async ejecutar(db, c) {
      const r = await todo((a, b) => sedeFiltro(db.from("pedidos").select("pagado_at, entregado_at, estado, total, metodo_pago, descuento_pct, sede:sedes!sede_entrega_id(name)")
        .eq("tenant_id", c.tenantId).in("estado", ["pagado", "entregado"]).gte("pagado_at", ini(c.desde)).lt("pagado_at", finExcl(c.hasta)), "sede_entrega_id", c).order("pagado_at").range(a, b));
      return { cabeceras: ["Pagado", "Entregado", "Sede", "Estado", "Método de pago", "Descuento %", "Total"], filas: (r as unknown as Record<string, unknown>[]).map((x) => [String(x.pagado_at).slice(0, 10), x.entregado_at ? String(x.entregado_at).slice(0, 10) : "", nombreDe(x.sede), String(x.estado), String(x.metodo_pago ?? ""), Number(x.descuento_pct ?? 0), Number(x.total)]) };
    },
  },
  {
    id: "rotacion-productos", titulo: "Rotación de productos", grupo: "Ventas", roles: FIN, descripcion: "Unidades e ingreso por producto vendido en el período.",
    async ejecutar(db, c) {
      const r = await todo((a, b) => db.from("pedido_items").select("nombre, variante_nombre, cantidad, precio_unitario, pedidos!inner(estado, pagado_at)")
        .eq("tenant_id", c.tenantId).eq("tipo", "producto").in("pedidos.estado", ["pagado", "entregado"]).gte("pedidos.pagado_at", ini(c.desde)).lt("pedidos.pagado_at", finExcl(c.hasta)).range(a, b));
      const m = new Map<string, { u: number; q: number }>();
      for (const x of r as unknown as { nombre: string; variante_nombre: string | null; cantidad: number; precio_unitario: number }[]) { const k = `${x.nombre}${x.variante_nombre ? ` (${x.variante_nombre})` : ""}`; const v = m.get(k) ?? { u: 0, q: 0 }; v.u += x.cantidad; v.q += x.cantidad * Number(x.precio_unitario); m.set(k, v); }
      return { cabeceras: ["Producto", "Unidades", "Ingreso"], filas: [...m.entries()].sort((a, b) => b[1].u - a[1].u).map(([k, v]) => [k, v.u, v.q]) };
    },
  },
  {
    id: "cobros-personalizados", titulo: "Cobros personalizados", grupo: "Ventas", roles: SEDE, descripcion: "Cobros fuera de paquetes y tienda, sin datos de la clienta.",
    async ejecutar(db, c) {
      const r = await todo((a, b) => sedeFiltro(db.from("cobros_personalizados").select("confirmado_at, concepto, monto, metodo_pago, sede:sedes!sede_id(name)")
        .eq("tenant_id", c.tenantId).gte("confirmado_at", ini(c.desde)).lt("confirmado_at", finExcl(c.hasta)), "sede_id", c).order("confirmado_at").range(a, b));
      return { cabeceras: ["Fecha", "Sede", "Concepto", "Método de pago", "Monto"], filas: (r as unknown as Record<string, unknown>[]).map((x) => [String(x.confirmado_at).slice(0, 10), nombreDe(x.sede), String(x.concepto), String(x.metodo_pago ?? ""), Number(x.monto)]) };
    },
  },
  {
    id: "gift-cards", titulo: "Gift cards", grupo: "Ventas", roles: FIN, descripcion: "Gift cards creadas, canjeadas y vigentes.",
    async ejecutar(db, c) {
      const r = await todo((a, b) => db.from("gift_cards").select("codigo, estado, comprador_nombre, destinatario_nombre, metodo_pago, created_at, canjeada_at, vence, paquetes(nombre)").eq("tenant_id", c.tenantId).order("created_at").range(a, b));
      return { cabeceras: ["Código", "Paquete", "Estado", "Comprador", "Destinatario", "Método de pago", "Creada", "Canjeada", "Vence"], filas: (r as unknown as Record<string, unknown>[]).map((x) => [String(x.codigo), nombreDe(x.paquetes), String(x.estado), String(x.comprador_nombre ?? ""), String(x.destinatario_nombre ?? ""), String(x.metodo_pago ?? ""), String(x.created_at).slice(0, 10), x.canjeada_at ? String(x.canjeada_at).slice(0, 10) : "", String(x.vence ?? "")]) };
    },
  },
  {
    id: "codigos-descuento", titulo: "Códigos de descuento", grupo: "Ventas", roles: FIN, descripcion: "Códigos, porcentaje y usos.",
    async ejecutar(db, c) {
      const r = await todo((a, b) => db.from("codigos_descuento").select("codigo, descuento_pct, aplica_a, activo, usos_maximos, usos_actuales, vigente_hasta").eq("tenant_id", c.tenantId).order("codigo").range(a, b));
      return { cabeceras: ["Código", "Descuento %", "Aplica a", "Activo", "Usos máximos", "Usos", "Vigente hasta"], filas: (r as unknown as Record<string, unknown>[]).map((x) => [String(x.codigo), Number(x.descuento_pct), String(x.aplica_a ?? ""), x.activo ? "Sí" : "No", (x.usos_maximos as number | null) ?? "Sin límite", Number(x.usos_actuales ?? 0), String(x.vigente_hasta ?? "")]) };
    },
  },
  {
    id: "privatizaciones", titulo: "Privatizaciones de fechas", grupo: "Ventas", roles: FIN, descripcion: "Fechas reservadas completas para una o varias personas, con su precio.",
    async ejecutar(db, c) {
      const r = await todo((a, b) => db.from("horario_fechas_privadas").select("fecha, cupo, horarios(nombre_clase, sede:sedes!sede_id(name)), horario_fechas_privadas_personas(precio, pagada, metodo_pago, clientes(nombre))")
        .eq("tenant_id", c.tenantId).gte("fecha", c.desde).lte("fecha", c.hasta).order("fecha").range(a, b));
      const filas: Fila[] = [];
      for (const x of r as unknown as { fecha: string; cupo: number; horarios: { nombre_clase: string; sede: { name: string } | null } | null; horario_fechas_privadas_personas: { precio: number; pagada: boolean; metodo_pago: string | null; clientes: { nombre: string } | null }[] }[])
        for (const p of x.horario_fechas_privadas_personas.length ? x.horario_fechas_privadas_personas : [null]) filas.push([x.fecha, x.horarios?.sede?.name ?? "", x.horarios?.nombre_clase ?? "", x.cupo, p?.clientes?.nombre ?? "", p ? Number(p.precio) : null, p ? (p.pagada ? "Pagada" : "Pendiente") : "", p?.metodo_pago ?? ""]);
      return { cabeceras: ["Fecha", "Sede", "Clase", "Cupo", "Persona", "Precio", "Pago", "Método"], filas };
    },
  },
  {
    id: "clientas", titulo: "Clientas", grupo: "Clientas", roles: G, descripcion: "Listado nominal de clientas con sede habitual y consentimiento. Solo dueña y gerencia general.",
    async ejecutar(db, c) {
      const r = await todo((a, b) => db.from("clientes").select("nombre, telefono, email, como_se_entero, created_at, consentimiento_completado_at, user_id, sede:sedes!sede_habitual_id(name)").eq("tenant_id", c.tenantId).is("tutor_id", null).eq("es_mostrador", false).order("nombre").range(a, b));
      return { cabeceras: ["Nombre", "Teléfono", "Correo", "Sede habitual", "Cómo se enteró", "Cliente desde", "Tiene acceso", "Consentimiento"], filas: (r as unknown as Record<string, unknown>[]).map((x) => [String(x.nombre), String(x.telefono ?? ""), String(x.email ?? ""), nombreDe(x.sede), String(x.como_se_entero ?? ""), String(x.created_at).slice(0, 10), x.user_id ? "Sí" : "No", x.consentimiento_completado_at ? "Firmado" : "Pendiente"]) };
    },
  },
  {
    id: "vencimientos", titulo: "Paquetes por vencer", grupo: "Clientas", roles: G, descripcion: "Paquetes activos que vencen en los próximos 30 días.",
    async ejecutar(db, c) {
      const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guatemala" }).format(new Date());
      const lim = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guatemala" }).format(new Date(Date.now() + 30 * 86400000));
      const r = await todo((a, b) => sedeFiltro(db.from("membresias").select("fecha_vencimiento, clases_totales, clases_usadas, clientes(nombre, telefono), paquetes(nombre), sede:sedes!sede_venta_id(name)")
        .eq("tenant_id", c.tenantId).eq("estado", "activa").eq("pagada", true).gte("fecha_vencimiento", hoy).lte("fecha_vencimiento", lim), "sede_venta_id", c).order("fecha_vencimiento").range(a, b));
      return { cabeceras: ["Vence", "Clienta", "Teléfono", "Paquete", "Sede", "Clases restantes"], filas: (r as unknown as Record<string, unknown>[]).map((x) => [String(x.fecha_vencimiento), nombreDe(x.clientes), String((x.clientes as { telefono?: string } | null)?.telefono ?? ""), nombreDe(x.paquetes), nombreDe(x.sede), x.clases_totales === null ? "Ilimitado" : Number(x.clases_totales) - Number(x.clases_usadas ?? 0)]) };
    },
  },
  {
    id: "riesgo-de-fuga", titulo: "Riesgo de fuga", grupo: "Clientas", roles: G, descripcion: "Clientas con paquete vigente que llevan 14 días o más sin venir.",
    async ejecutar(db, c) {
      const r = await rpc<{ nombre: string; telefono: string | null; email: string | null; ultima_visita: string | null; dias_sin_venir: number; membresia_vence: string; sede: string | null }[]>(db, "clientas_riesgo_fuga_lista", { p_tenant_id: c.tenantId, p_dias: 14, p_sede_id: c.sedeId });
      return { cabeceras: ["Clienta", "Teléfono", "Correo", "Sede", "Última visita", "Días sin venir", "Paquete vence"], filas: r.map((x) => [x.nombre, x.telefono ?? "", x.email ?? "", x.sede ?? "", x.ultima_visita ?? "Nunca", x.dias_sin_venir, x.membresia_vence]) };
    },
  },
  {
    id: "ranking-clientas", titulo: "Ranking de clientas", grupo: "Clientas", roles: G, descripcion: "Clientas ordenadas por lo que han pagado (paquetes sin anular).",
    async ejecutar(db, c) {
      const r = await todo((a, b) => db.from("membresias").select("precio_final, cliente_id, clientes(nombre)").eq("tenant_id", c.tenantId).eq("pagada", true).neq("estado", "anulada").range(a, b));
      const m = new Map<string, { n: string; q: number; k: number }>();
      for (const x of r as unknown as { precio_final: number | null; cliente_id: string; clientes: { nombre: string } | null }[]) { const v = m.get(x.cliente_id) ?? { n: x.clientes?.nombre ?? "", q: 0, k: 0 }; v.q += Number(x.precio_final ?? 0); v.k += 1; m.set(x.cliente_id, v); }
      return { cabeceras: ["Clienta", "Paquetes comprados", "Total pagado"], filas: [...m.values()].sort((a, b) => b.q - a.q).map((v) => [v.n, v.k, v.q]) };
    },
  },
  {
    id: "leads", titulo: "Leads (clase de prueba sin compra)", grupo: "Clientas", roles: G, descripcion: "Personas que tomaron o agendaron una clase de prueba y no han comprado.",
    async ejecutar(db, c) {
      const r = await todo((a, b) => db.from("reservas").select("fecha, estado, asistio, estado_lead, clientes(nombre, telefono, email, como_se_entero)").eq("tenant_id", c.tenantId).eq("tipo", "prueba").gte("fecha", c.desde).lte("fecha", c.hasta).order("fecha").range(a, b));
      return { cabeceras: ["Fecha de la prueba", "Clienta", "Teléfono", "Correo", "Cómo se enteró", "Estado de la reserva", "Asistió", "Seguimiento"], filas: (r as unknown as Record<string, unknown>[]).map((x) => { const cl = x.clientes as { nombre: string; telefono: string | null; email: string | null; como_se_entero: string | null } | null; return [String(x.fecha), cl?.nombre ?? "", cl?.telefono ?? "", cl?.email ?? "", cl?.como_se_entero ?? "", String(x.estado), x.asistio === null ? "Sin marcar" : x.asistio ? "Sí" : "No", String(x.estado_lead ?? "")]; }) };
    },
  },
  {
    id: "seguimiento-pruebas", titulo: "Seguimiento de pruebas", grupo: "Clientas", roles: G, descripcion: "Resumen: no asistieron, cancelaron, reagendaron y no tienen clase.",
    async ejecutar(db, c) { return clave(await rpc(db, "kpi_seguimiento_prueba", { p_tenant_id: c.tenantId }), { total_no_asistio: "No asistieron", total_cancelada: "Cancelaron", total_reagendaron: "Reagendaron", total_sin_clase: "Sin clase agendada" }); },
  },
  {
    id: "reservas", titulo: "Historial de reservas", grupo: "Operación", roles: [...G, "admin_sede", "gerente_regional"], descripcion: "Reservas del período por día y clase, con asistencia. Cada rol recibe las de sus sedes.",
    async ejecutar(db, c) {
      const r = await todo((a, b) => sedeFiltro(db.from("reservas").select("fecha, tipo, estado, asistio, sede:sedes!sede_id(name), clientes(nombre), horarios(nombre_clase, hora_inicio)")
        .eq("tenant_id", c.tenantId).gte("fecha", c.desde).lte("fecha", c.hasta), "sede_id", c).order("fecha").range(a, b));
      return { cabeceras: ["Fecha", "Hora", "Clase", "Sede", "Clienta", "Tipo", "Estado", "Asistió"], filas: (r as unknown as Record<string, unknown>[]).map((x) => { const h = x.horarios as { nombre_clase: string; hora_inicio: string } | null; return [String(x.fecha), h?.hora_inicio?.slice(0, 5) ?? "", h?.nombre_clase ?? "", nombreDe(x.sede), nombreDe(x.clientes), String(x.tipo), String(x.estado), x.asistio === null ? "Sin marcar" : x.asistio ? "Sí" : "No"]; }) };
    },
  },
  {
    id: "encuestas", titulo: "Encuestas de satisfacción", grupo: "Gestión", roles: G, descripcion: "Respuestas y comentarios de las clientas.",
    async ejecutar(db, c) {
      const r = await todo((a, b) => db.from("encuestas_satisfaccion").select("created_at, disparador, satisfaccion, recomendaria, comentario, clientes(nombre)").eq("tenant_id", c.tenantId).gte("created_at", ini(c.desde)).lt("created_at", finExcl(c.hasta)).order("created_at").range(a, b));
      return { cabeceras: ["Fecha", "Clienta", "Disparador", "Satisfacción", "La recomendaría", "Comentario"], filas: (r as unknown as Record<string, unknown>[]).map((x) => [String(x.created_at).slice(0, 10), nombreDe(x.clientes), String(x.disparador ?? ""), Number(x.satisfaccion), x.recomendaria === null ? "" : x.recomendaria ? "Sí" : "No", String(x.comentario ?? "")]) };
    },
  },
  {
    id: "actividad", titulo: "Actividad del personal", grupo: "Gestión", roles: G, descripcion: "Quién hizo qué y cuándo (auditoría).",
    async ejecutar(db, c) {
      const r = await todo((a, b) => db.from("admin_acciones_log").select("created_at, actor_nombre, tabla, operacion, registro_id").eq("tenant_id", c.tenantId).gte("created_at", ini(c.desde)).lt("created_at", finExcl(c.hasta)).order("created_at").range(a, b));
      return { cabeceras: ["Fecha y hora (Guatemala)", "Persona", "Tabla", "Operación", "Registro"], filas: (r as unknown as Record<string, unknown>[]).map((x) => [new Date(String(x.created_at)).toLocaleString("es-GT", { timeZone: "America/Guatemala" }), String(x.actor_nombre ?? "Sistema"), String(x.tabla), String(x.operacion), String(x.registro_id ?? "")]) };
    },
  },
];

export const reportePorId = (id: string) => REPORTES.find((r) => r.id === id) ?? null;

const esc = (v: string | number | null) => { const s = v === null || v === undefined ? "" : String(v); return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
/** CSV con BOM UTF-8 para que Excel respete acentos. Neutraliza fórmulas (=, +, -, @) en celdas de texto. */
export function aCsv(t: Tabla): string {
  const celda = (v: string | number | null) => (typeof v === "string" && /^[=+\-@\t\r]/.test(v) && !/^-?\d+([.,]\d+)?$/.test(v) ? `'${v}` : v);
  return "﻿" + [t.cabeceras, ...t.filas].map((f) => f.map((v) => esc(celda(v))).join(",")).join("\r\n");
}
