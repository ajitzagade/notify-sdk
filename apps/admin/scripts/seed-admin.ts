/**
 * One-time bootstrap: creates the first admin_users row from env vars.
 * There is no signup flow by design (internal admin panel only) — run this
 * once after migrations, then log in and (optionally) create more admins
 * by inserting additional rows the same way.
 *
 * Usage: pnpm seed:admin   (reads apps/admin/.env.local)
 */
import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { Pool } from 'pg';
import { hashPassword } from '@orgname/notify';

async function main(): Promise<void> {
  const email    = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  const dbUrl    = process.env.DATABASE_URL;

  if (!email || !password) {
    throw new Error('ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD must be set in .env.local');
  }
  if (!dbUrl) {
    throw new Error('DATABASE_URL must be set in .env.local');
  }

  const pool = new Pool({ connectionString: dbUrl });

  const { rows: existing } = await pool.query(
    `SELECT id FROM admin_users WHERE email = $1 LIMIT 1`,
    [email]
  );
  if (existing[0]) {
    console.log(`[seed-admin] Admin user ${email} already exists (id=${existing[0].id}). Skipping.`);
    await pool.end();
    return;
  }

  const { hash, salt } = await hashPassword(password);
  const { rows } = await pool.query(
    `INSERT INTO admin_users (email, password_hash, password_salt, role)
     VALUES ($1, $2, $3, 'super_admin')
     RETURNING id`,
    [email, hash, salt]
  );

  console.log(`[seed-admin] Created admin user ${email} (id=${rows[0].id})`);
  await pool.end();
}

main().catch((err) => {
  console.error('[seed-admin] Failed:', err);
  process.exit(1);
});
