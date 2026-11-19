import { crearDb } from "./cargar.mjs";
const { db } = await crearDb();
for (const n of process.argv.slice(2)) {
  const r = await db.query("select pg_get_functiondef(p.oid) d from pg_proc p where p.pronamespace='public'::regnamespace and p.proname=$1", [n]);
  console.log(`\n===== ${n} (${r.rows.length})\n` + r.rows.map((x) => x.d).join("\n"));
}
await db.close();
