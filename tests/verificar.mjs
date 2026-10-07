// Verificación completa y trazable: siembra los fixtures, corre las pruebas por API (Vitest), los escenarios de punta a punta y la
// concurrencia, limpia lo temporal, comprueba que las migraciones locales coinciden con las desplegadas y GUARDA todo en tests/RESULTADOS.md.
//   SUPABASE_ACCESS_TOKEN=sbp_… npm run verificar        (el token no se guarda en ningún archivo)
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { consulta } from "./escenarios/concurrencia.mjs";

const dir = dirname(fileURLToPath(import.meta.url)), raiz = join(dir, "..");
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN, REF = process.env.SUPABASE_PROJECT_REF ?? "agkqppuhyltirrhngybq";
if (!TOKEN) { console.error("Falta SUPABASE_ACCESS_TOKEN"); process.exit(2); }
const ejecutar = (cmd, args, extra = {}) => spawnSync(cmd, args, { cwd: raiz, encoding: "utf8", maxBuffer: 50_000_000, env: process.env, ...extra });

console.log("1/5 Sembrando fixtures…");
const sem = ejecutar("node", ["tests/fixtures/sembrar.mjs"]); if (sem.status !== 0) { console.error(sem.stdout, sem.stderr); process.exit(1); }

console.log("2/5 Pruebas por API directa (Vitest)…");
const vi = ejecutar("npx", ["vitest", "run", "--reporter=json", "--outputFile=/tmp/vitest-resultados.json"]);
let json = { testResults: [], numPassedTests: 0, numFailedTests: 0, numTotalTests: 0 };
try { json = JSON.parse(readFileSync("/tmp/vitest-resultados.json", "utf8")); } catch { console.error(vi.stdout, vi.stderr); }

console.log("3/5 Escenarios de punta a punta y concurrencia…");
const esc = ejecutar("node", ["tests/escenarios/run.mjs"]);
const lineasEsc = esc.stdout.split("\n").filter((l) => /^[✔✘]/.test(l) || /TODOS|FALLARON/.test(l));

console.log("4/5 Limpiando datos temporales…");
for (const q of [
  "delete from invitaciones_personal where email like 'tmp-%@vim-prueba.test'",
  "delete from clientes where nombre like 'TMP %'",
  "delete from horarios where nombre_clase like 'FX tmp%'",
]) consulta(TOKEN, REF, q);

console.log("5/5 Comparando migraciones locales con las desplegadas…");
const locales = readdirSync(join(raiz, "supabase/migrations")).filter((f) => f.endsWith(".sql")).map((f) => f.split("_")[0]).sort();
const remotas = (consulta(TOKEN, REF, "select version from supabase_migrations.schema_migrations order by 1") ?? []).map((r) => r.version);
const faltan = locales.filter((v) => !remotas.includes(v));
const anon = consulta(TOKEN, REF, "select string_agg(proname, ', ' order by proname) n from pg_proc where pronamespace='public'::regnamespace and prokind='f' and has_function_privilege('anon', oid, 'execute')")[0]?.n;
const stats = consulta(TOKEN, REF, "select (select count(*) from pg_tables where schemaname='public') tablas, (select count(*) from pg_tables where schemaname='public' and rowsecurity) rls, (select count(*) from pg_proc where pronamespace='public'::regnamespace and prokind='f') funciones, (select count(*) from pg_policies where schemaname='public') politicas")[0];

const ahora = new Date().toLocaleString("es-GT", { timeZone: "America/Guatemala", dateStyle: "long", timeStyle: "short" });
let md = `# Resultados de verificación — ReserveOS\n\nGenerado: **${ahora}** (hora de Guatemala) · Base verificada: staging \`${REF}\`\n\n`;
md += `## Resumen\n\n| Qué | Resultado |\n|---|---|\n`;
md += `| Pruebas por API directa (Vitest) | **${json.numPassedTests} de ${json.numTotalTests} pasan**${json.numFailedTests ? ` — ${json.numFailedTests} FALLAN` : ""} |\n`;
md += `| Escenarios de punta a punta + concurrencia | ${lineasEsc.some((l) => /FALLARON/.test(l)) ? "**FALLAN**" : "todos pasan"} |\n`;
md += `| Migraciones locales / desplegadas | ${locales.length} locales · ${remotas.length} desplegadas · ${faltan.length === 0 ? "**coinciden**" : `**FALTAN por desplegar: ${faltan.join(", ")}**`} |\n`;
md += `| Funciones que un visitante sin cuenta puede ejecutar | ${anon} |\n`;
md += `| Base | ${stats.tablas} tablas (${stats.rls} con RLS) · ${stats.funciones} funciones · ${stats.politicas} políticas |\n\n`;
md += `## Pruebas por API directa, con sesión real de cada rol\n\n`;
for (const f of json.testResults) {
  const nombre = f.name.split("/").pop();
  const grupos = {};
  for (const a of f.assertionResults) (grupos[a.ancestorTitles.join(" › ") || "(sin grupo)"] ??= []).push(a);
  md += `### ${nombre}\n\n`;
  for (const [g, lista] of Object.entries(grupos)) { md += `**${g}**\n\n`; for (const a of lista) md += `- ${a.status === "passed" ? "✔" : "✘"} ${a.title}\n`; md += "\n"; }
}
md += `## Escenarios de punta a punta\n\n${lineasEsc.map((l) => `- ${l}`).join("\n")}\n`;
writeFileSync(join(dir, "RESULTADOS.md"), md);
const ok = json.numFailedTests === 0 && !lineasEsc.some((l) => /FALLARON|✘/.test(l)) && faltan.length === 0;
console.log(`\n${ok ? "✔ TODO VERIFICADO" : "✘ HAY FALLOS"} — ${json.numPassedTests}/${json.numTotalTests} pruebas, migraciones ${faltan.length === 0 ? "al día" : "pendientes"}. Resultados en tests/RESULTADOS.md`);
process.exit(ok ? 0 : 1);
