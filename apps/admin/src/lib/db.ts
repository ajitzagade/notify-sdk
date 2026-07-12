import { Pool } from 'pg';

let pool: Pool | null = null;

/** Shared connection pool for the whole admin app — never construct a Pool ad hoc. */
export function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('[admin] DATABASE_URL is not set.');
  }
  pool = new Pool({ connectionString });
  return pool;
}
