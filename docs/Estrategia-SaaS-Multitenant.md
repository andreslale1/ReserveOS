# Estrategia: de Forma Pilates a SaaS multi-tenant

Fecha: 2026-09-28
Contexto: Andrés está evaluando convertir Forma Pilates en una plataforma SaaS para vender a otros gimnasios/estudios en Guatemala, empezando por VIM Pilates (3 sedes, ya interesados).

## 1. ¿Multi-tenant o uno por gimnasio?

**Recomendación: multi-tenant, por fases — no de golpe.**

Precedente propio: esto es el mismo ejercicio que ClubOs (CRM Municipal → multi-tenant para clubes de fútbol). Ya se hizo una vez, con éxito.

Por qué tiene sentido:
- El núcleo del negocio (reservas, paquetes con créditos, clientas, pagos, asistencia, lista de espera, cuentas familiares) es casi idéntico entre pilates, cycling, crossfit y gimnasios en general — igual que Mindbody, Glofox, Vagaro.
- Ese núcleo ya está construido y probado en producción real, con casos reales resueltos.
- El objetivo es ingreso recurrente (SaaS real), no una consultora que clona código por cliente — un modelo "uno por gimnasio" no escala así, y ya se vio en esta sesión lo caro que es mantener sincronizados solo 2 repos (Frontend + App nativa).

Lo que NO conviene hacer todavía: generalizar para crossfit/cycling. Es complejidad real (equipo, capacidad, métricas distintas) que no hay que resolver sin un cliente real de ese tipo enfrente.

### Fases recomendadas
1. **Ahora:** VIM como segundo tenant, mismo giro (pilates). Aquí se invierte en la arquitectura real: `tenant_id` en todo, RLS por tenant.
2. **Después:** 1-2 estudios de pilates más, para validar el modelo multi-tenant con clientes reales pagando.
3. **Más adelante (si aplica):** generalizar a otras disciplinas, con la plataforma ya probada.

## 2. Multi-sede (caso VIM: 3 sedes, mismo giro)

Tabla `sedes` (con `tenant_id`) + `sede_id` en `horarios` — cada clase pertenece a una sede. Decisión de negocio pendiente con VIM: ¿una clienta con paquete puede reservar en cualquiera de las 3 sedes, o cada sede tiene sus propias clientas? Lo normal en cadenas reales es la primera opción (una membresía, cualquier sede).

## 3. Multi-sede + multi-disciplina (gimnasio grande)

Complejidad real, para la Fase 3. Necesitaría un concepto de "disciplina" a nivel tenant, con capacidad/equipo configurable por tipo de clase (reformers vs. bicicletas vs. piso abierto) y KPIs distintos por disciplina. No vale la pena diseñarlo en abstracto sin un cliente real de ese perfil.

## 4. Tiempo de replicar para otro estudio de pilates

- **Clonar tal cual (plan original del brief de VIM):** 1-2 semanas — rebranding, reconfigurar precios/paquetes/políticas propias, nuevo proyecto Supabase, nuevo dominio, app nativa aparte (nueva subida a App Store).
- **Construir la base multi-tenant:** 3-4 semanas la primera vez (agregar `tenant_id` a cada tabla, reescribir políticas RLS, panel de super-admin). Cada tenant después de VIM: días, no semanas.

**Recomendación:** si el objetivo real es el negocio SaaS, pagar el costo de las 3-4 semanas ahora. Cada estudio que se clone mientras tanto hace la migración a multi-tenant más cara después, no más barata.

## 5. Agentes de trabajo (QA, redes, leads)

- **QA/auditoría de código automática — viable hoy.** Es lo que ya se hizo manualmente esta sesión (regression pass, bugs reales encontrados). Se puede automatizar con Claude Code programado (GitHub Actions) revisando PRs y corriendo regression pass periódico.
- **Publicar en redes automático — viable, con matices.** La parte técnica es fácil; lo difícil es la dirección creativa. Recomendado: el agente arma el borrador, un humano aprueba con un clic — no publicación 100% autónoma.
- **Generar leads y contactarlos automático — cuidado aquí.** Lo legítimo: formularios de leads de Meta/Google Ads + CRM con seguimiento automático (esto sí se puede construir). Lo que NO: scraping o mensajes masivos no solicitados — viola términos de servicio de las plataformas (riesgo de baneo de WhatsApp Business/cuentas) y en muchos casos es ilegal o gris.

**Orden recomendado:** cerrar VIM primero con la arquitectura multi-tenant (valida el negocio con un segundo cliente real pagando). En paralelo, el agente de QA automática es el más fácil y seguro de armar ya. Redes y leads, cuando ya haya 2-3 estudios pagando y ritmo de ventas que justifique automatizarlo.
