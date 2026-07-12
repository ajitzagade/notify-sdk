import { Pool } from 'pg';

let pool: Pool | null = null;

/** Shared connection pool for the /v1/* multi-tenant routes. */
export function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('[api] DATABASE_URL is not set — required for /v1/* multi-tenant routes.');
  }
  pool = new Pool({ connectionString });
  return pool;
}
