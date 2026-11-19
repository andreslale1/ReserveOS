import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readdirSync, readFileSync } from "node:fs";
const MIG = fileURLToPath(new URL("../../supabase/migrations", import.meta.url));
export async function crearDb(extra = [], omitir = []) {
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin; create role authenticator nologin;
  create schema extensions; create extension if not exists pgcrypto with schema extensions;
  alter database postgres set search_path = public, extensions;
  set search_path = public, extensions;
  create schema auth;
  create table auth.users(id uuid primary key default gen_random_uuid(), email text unique, encrypted_password text, raw_user_meta_data jsonb default '{}'::jsonb, raw_app_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now(), last_sign_in_at timestamptz, email_confirmed_at timestamptz default now(), phone text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('sub', auth.uid(), 'role', auth.role()) $$;
  create schema storage; create table storage.buckets(id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb, created_at timestamptz default now());
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
  create schema vault; create table vault.secrets(id uuid primary key default gen_random_uuid(), name text unique, secret text, description text);
  create view vault.decrypted_secrets as select id, name, secret as decrypted_secret from vault.secrets;
  create function vault.create_secret(s text, n text default null, d text default null) returns uuid language sql as $$ insert into vault.secrets(name, secret, description) values (n, s, d) returning id $$;
  create schema cron; create table cron.job(jobid serial primary key, schedule text, command text, jobname text unique, active boolean default true);
  create table cron.job_run_details(jobid int, status text, start_time timestamptz, end_time timestamptz, return_message text);
  create function cron.schedule(a text, b text, c text default null) returns bigint language sql as $$ select 1::bigint $$;
  create function cron.schedule(a text, b text) returns bigint language sql as $$ select 1::bigint $$;
  create function cron.unschedule(a text) returns boolean language sql as $$ select true $$;
  create function cron.unschedule(a bigint) returns boolean language sql as $$ select true $$;
  grant usage on schema public, extensions, auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`);
await db.exec("set check_function_bodies = off");
const seed = readFileSync(fileURLToPath(new URL("../../supabase/seed.sql", import.meta.url)), "utf8");
const catalogo = (seed.match(/insert into public\.module_catalog[\s\S]*?;\s*\n/) || [""])[0];
const archivos = readdirSync(MIG).filter((f) => f.endsWith(".sql") && !omitir.some((o) => f.startsWith(o))).sort().concat(extra.map((e) => e.ruta));
const fallos = [];
for (const f of archivos) {
  if (f.startsWith("20261005180000")) await db.exec(catalogo).catch((e) => fallos.push("catalogo: " + e.message.slice(0, 100)));
  const ruta = f.startsWith("/") ? f : `${MIG}/${f}`;
  // Las migraciones nuevas (20261018*) se validan como en Supabase: con la sintaxis de las funciones comprobada.
  await db.exec(f.includes("20261018") ? "set check_function_bodies = on" : "set check_function_bodies = off");
  try {
    let sql = readFileSync(ruta, "utf8").replace(/create extension if not exists pg_cron[^;]*;/gi, "").replace(/create extension if not exists pg_net[^;]*;/gi, "");
    await db.exec("set search_path = public, extensions;\n" + sql);
  } catch (e) { fallos.push(`${f.split("/").pop()}: ${String(e.message).slice(0, 160)}`); }
  if (f.includes("hito_c_nucleo_tablas")) await db.exec("alter table public.reservas add column if not exists estado_lead text;");
}
return { db, fallos, total: archivos.length };
}
if (process.argv[1].endsWith("cargar.mjs")) {
  const { db, fallos, total } = await crearDb();
  console.log(`aplicadas ${total - fallos.length}/${total}`); fallos.forEach((x) => console.log("  FALLO", x));
  await db.close();
}
