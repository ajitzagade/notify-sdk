// TEMPORARY — exists only to apply migrations 026-028 to production, where
// DATABASE_URL is a Vercel "Secret"-type var unreachable via `vercel env
// pull` by design (confirmed against the project's own rotate-master-key.ts
// procedure, which expects a human to source it from Neon directly rather
// than via Vercel). Removed in the very next commit once confirmed applied.
// Auth: a single-purpose secret (INTERNAL_MIGRATE_SECRET), set fresh for
// this operation and never reused for anything else.
import { Router, Request, Response } from 'express';
import { getPool } from '../lib/db';

export const internalMigrateRouter = Router();

internalMigrateRouter.post('/internal/migrate-026-028', async (req: Request, res: Response) => {
  const secret = process.env.INTERNAL_MIGRATE_SECRET;
  if (!secret || req.headers['x-migrate-secret'] !== secret) {
    res.status(404).end(); // 404, not 401 — don't advertise this route exists
    return;
  }

  const pool = getPool();
  const client = await pool.connect();
  const log: string[] = [];

  try {
    await client.query('BEGIN');

    // --- 026: tenants.auto_reply_enabled ---
    await client.query(
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS auto_reply_enabled BOOLEAN NOT NULL DEFAULT TRUE`
    );
    log.push('026: tenants.auto_reply_enabled ensured');

    // --- 027: message_replies list-type support ---
    // Look up the REAL constraint name rather than assume it matches local —
    // this is exactly the kind of drift that could silently leave two
    // constraints active if guessed wrong.
    const { rows: constraintRows } = await client.query(
      `SELECT conname FROM pg_constraint WHERE conrelid = 'message_replies'::regclass AND contype = 'c'`
    );
    for (const row of constraintRows) {
      await client.query(`ALTER TABLE message_replies DROP CONSTRAINT IF EXISTS ${client.escapeIdentifier(row.conname)}`);
      log.push(`027: dropped existing check constraint ${row.conname}`);
    }
    await client.query(
      `ALTER TABLE message_replies ADD CONSTRAINT message_replies_type_check CHECK (type IN ('button', 'text', 'list'))`
    );
    await client.query(`ALTER TABLE message_replies ADD COLUMN IF NOT EXISTS list_row_id VARCHAR(200)`);
    await client.query(`ALTER TABLE message_replies ADD COLUMN IF NOT EXISTS list_row_title VARCHAR(200)`);
    log.push('027: message_replies widened + columns ensured');

    // --- 028: partner_api_keys ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS partner_api_keys (
        id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        key_prefix    VARCHAR(16)  NOT NULL,
        key_hash      TEXT         NOT NULL,
        key_salt      TEXT         NOT NULL,
        label         VARCHAR(200),
        last_used_at  TIMESTAMPTZ,
        revoked_at    TIMESTAMPTZ,
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_partner_api_keys_prefix ON partner_api_keys (key_prefix)`);
    log.push('028: partner_api_keys ensured');

    await client.query('COMMIT');

    // Post-apply verification, returned in the response rather than trusted blind.
    const [{ rows: constraintCheck }, { rows: tenantCounts }, { rows: tableCheck }] = await Promise.all([
      client.query(`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'message_replies'::regclass AND contype = 'c'`),
      client.query(`SELECT count(*) AS total, count(*) FILTER (WHERE auto_reply_enabled) AS enabled FROM tenants`),
      client.query(`SELECT to_regclass('partner_api_keys') IS NOT NULL AS exists`),
    ]);

    res.json({ ok: true, log, verify: { constraintCheck, tenantCounts: tenantCounts[0], partnerTableExists: tableCheck[0].exists } });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ ok: false, log, error: err instanceof Error ? err.message : String(err) });
  } finally {
    client.release();
  }
});
