import { Pool, type QueryResultRow } from "pg";

declare global {
  var __prayerPool: Pool | undefined;
}

function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  if (!globalThis.__prayerPool) {
    globalThis.__prayerPool = new Pool({ connectionString });
  }

  return globalThis.__prayerPool;
}

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  return getPool().query<T>(text, values);
}

export function closePool() {
  return globalThis.__prayerPool?.end();
}
