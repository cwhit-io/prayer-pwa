import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const migrationsDir = path.resolve("db/migrations");
const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
const client = new pg.Client({ connectionString });
await client.connect();

try {
  await client.query(`
    create table if not exists schema_migrations (
      version text primary key,
      checksum text null,
      applied_at timestamptz not null default now()
    )
  `);
  await client.query("alter table schema_migrations add column if not exists checksum text null");

  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const applied = await client.query("select checksum from schema_migrations where version = $1", [version]);
    if (applied.rows[0]) {
      if (applied.rows[0].checksum && applied.rows[0].checksum !== checksum) {
        throw new Error(`Migration checksum changed after apply: ${file}`);
      }
      continue;
    }

    await client.query("begin");
    try {
      await client.query("select pg_advisory_xact_lock(hashtext('prayer-pwa-schema-migrations'))");
      await client.query(sql);
      await client.query(
        `insert into schema_migrations (version, checksum)
         values ($1, $2)
         on conflict (version) do update set checksum = excluded.checksum`,
        [version, checksum]
      );
      await client.query("commit");
      console.log(`Applied ${file}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
} finally {
  await client.end();
}
