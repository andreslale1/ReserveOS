// Fija TÚ la contraseña de una cuenta, sin escribirla en ningún chat.
// Uso (en tu Terminal):  cd ~/Desktop/ReserveOS/web && node --env-file=.env.local scripts/fijar-contrasena.mjs andreslale1@gmail.com
import { createClient } from "@supabase/supabase-js";
import readline from "node:readline";

const email = process.argv[2];
if (!email) { console.error("Falta el correo. Ejemplo: node --env-file=.env.local scripts/fijar-contrasena.mjs tu@correo.com"); process.exit(1); }

function pedir(texto) {
  return new Promise((ok) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(texto)) process.stdout.write(s); else process.stdout.write("*".repeat(Math.max(s.length - 0, 0) > 1 ? 0 : 0)); };
    rl.question(texto, (r) => { rl.close(); process.stdout.write("\n"); ok(r); });
  });
}
const a = await pedir("Nueva contraseña (mínimo 8 caracteres): ");
const b = await pedir("Repítela: ");
if (a !== b) { console.error("No coinciden."); process.exit(1); }
if (a.length < 8) { console.error("Muy corta."); process.exit(1); }

const sv = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await sv.auth.admin.listUsers({ perPage: 1000 });
const u = data.users.find((x) => x.email === email);
if (!u) { console.error("No existe esa cuenta."); process.exit(1); }
const r = await sv.auth.admin.updateUserById(u.id, { password: a });
console.log(r.error ? "Error: " + r.error.message : "Listo: ya puedes entrar con tu nueva contraseña.");
