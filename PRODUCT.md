# ReserveOS — contexto de producto

**Qué es:** plataforma multi-tenant de reservas, membresías, pagos y operación para estudios de pilates y gimnasios (pilates, CrossFit, HYROX). Se vende desde LL Agency. Origen: Forma Pilates (caso real, en producción).

**Quién compra:** dueño/a o gerente de un estudio o gimnasio en Guatemala/LatAm (1 a varias sedes), no técnico. Quiere dejar de operar con chats, hojas de cálculo y cobros sueltos.

**Quién usa:** dueña, gerente regional, administrador de sede, recepción, coach/instructora, contadora, marketing, y la clienta/atleta desde el celular.

**Tres formas de entrega:** (A) link de reserva con cuentas de equipo y clientes; (B) widget que el gimnasio pega en su web actual; (C) web completa a la marca del estudio con reservas.

**Giros (regla del negocio):** cada cliente es UN solo tipo de negocio, nunca una mezcla con Pilates:
- **Estudio de Pilates** (cupo por clase, instructora, paquetes).
- **Gimnasio CrossFit** (WOD, coach, marcas personales, membresías).
- **Gimnasio HYROX** (sesiones por bloque, carriles/estaciones).
- **Gimnasio CrossFit + HYROX** (un mismo gimnasio con ambos programas).
Un estudio de Pilates NO tiene HYROX ni CrossFit. El giro se guarda por estudio (`tenants.giro`) y define vocabulario, pantallas y demostraciones. Nunca mostrar ejemplos que mezclen Pilates con CrossFit/HYROX.

**Tono visual (decidido):** sobrio y claro. Blanco hueso, grises cálidos, azul pizarra y azul pastel; marrón pastel solo como apoyo. Nada de negro con verde neón. Confiable, preciso, calmado. Sin imágenes generadas por IA; fotos de stock libres o el producto real.

**Vista del cliente final (decidido):** estructura y front de Forma Pilates (barra con menús agrupados Inicio / Clases / Comprar / Mi cuenta, tarjetas de inicio, reservar por semana, Mi paquete, familia, referidos), con el diseño nuevo de ReserveOS y el color de cada estudio.

**Principio de UX:** navegación fácil como Forma (barra superior con menús agrupados), pero el estilo (color, logo, tipografía) es de cada estudio.

**No prometer:** pasarela de pago en línea, correo/WhatsApp y app nativa mientras no estén conectados.
