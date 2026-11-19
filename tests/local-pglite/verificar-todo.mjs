// Ejecuta TODAS las pruebas locales de reglas de dinero, reservas y carriles. Sale con error si algo falla.
// Las pruebas «antes/después» reproducen el defecto sin la migración; aquí solo se exige que el «después» esté limpio.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const aqui = fileURLToPath(new URL(".", import.meta.url));
const MALO = /FALLA|PERMITIDA|DOBLE|REACTIVADA|por error|NO aparece|DUPLICADA|EXTENDIÓ|CONFIRMÓ la compra|ANULÓ el paquete|ERROR de prueba|SÍ, activo|NO: |NO \(|NUEVA reserva ya|PROMOVIDA con|DOBLE CONTEO|sin carril|PERMITIDO|SE ENVÍA|atascado para siempre|NO resta|INCORRECTO|ANULADA entera|cuenta la reserva futura|NO aparece/;
const pruebas = [
  ["humo.mjs", false], ["prueba_dinero1.mjs", true], ["prueba_reservas2.mjs", true],
  ["prueba_pagos3.mjs", true], ["prueba_choques4.mjs", true], ["prueba_carriles5.mjs", false], ["prueba_tanda5.mjs", true], ["prueba_cupo6.mjs", false], ["prueba_asistida7.mjs", false],
];
let fallos = 0;
for (const [archivo, conAntes] of pruebas) {
  const r = spawnSync("node", [archivo], { cwd: aqui, encoding: "utf8", timeout: 280_000 });
  let salida = (r.stdout || "") + (r.stderr || "");
  if (conAntes) salida = salida.split(/=== DESPU/)[1] ?? salida;   // solo la parte «después»
  // Pruebas «antes/después»: se buscan frases de defecto. Pruebas OK/FALLA: solo cuenta una línea que EMPIECE con FALLA.
  const lineas = salida.split("\n").filter((l) => (conAntes ? MALO.test(l) : /^\s*(FALLA|fallos de carga \(estricto\): (?!ninguno))/.test(l)) && !/^\s*\(avisos/.test(l));
  const bien = r.status === 0 && lineas.length === 0 && salida.length > 40;
  console.log(`${bien ? "OK   " : "FALLA"}  ${archivo}${bien ? "" : "\n      " + (lineas.slice(0, 4).join("\n      ") || salida.slice(-300))}`);
  if (!bien) fallos++;
}
console.log(fallos ? `\n${fallos} prueba(s) con fallos` : "\nTodas las pruebas locales pasan");
process.exit(fallos ? 1 : 0);
