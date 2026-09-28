// TEMPORARY — exists only to seed/clean up one throwaway partner-key row
// for a real end-to-end production smoke test (partner_api_keys has no
// self-serve issuance endpoint by design; DATABASE_URL is unreachable via
// CLI). Removed in the very next commit once the smoke test is done.
import express, { Router, Request, Response } from 'express';
import { getPool } from '../lib/db';

export const internalSmokeTestRouter = Router();
internalSmokeTestRouter.use(express.json());

internalSmokeTestRouter.post('/internal/smoke-test-seed', async (req: Request, res: Response) => {
  const secret = process.env.INTERNAL_MIGRATE_SECRET;
  if (!secret || req.headers['x-migrate-secret'] !== secret) {
    res.status(404).end();
    return;
  }
  const { keyPrefix, keyHash, keySalt } = req.body as { keyPrefix: string; keyHash: string; keySalt: string };
  await getPool().query(
    `INSERT INTO partner_api_keys (key_prefix, key_hash, key_salt, label) VALUES ($1, $2, $3, 'smoke-test-temporary')`,
    [keyPrefix, keyHash, keySalt]
  );
  res.json({ ok: true });
});

internalSmokeTestRouter.post('/internal/smoke-test-cleanup', async (req: Request, res: Response) => {
  const secret = process.env.INTERNAL_MIGRATE_SECRET;
  if (!secret || req.headers['x-migrate-secret'] !== secret) {
    res.status(404).end();
    return;
  }
  const pool = getPool();
  const { rows: tenantRows } = await pool.query(
    `SELECT id FROM tenants WHERE name = 'notify-sdk smoke test (delete me)'`
  );
  for (const row of tenantRows) {
    await pool.query(`DELETE FROM webhook_endpoints WHERE tenant_id = $1`, [row.id]);
    await pool.query(`DELETE FROM tenant_api_keys WHERE tenant_id = $1`, [row.id]);
    await pool.query(`DELETE FROM tenant_wa_credentials WHERE tenant_id = $1`, [row.id]);
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [row.id]);
  }
  await pool.query(`DELETE FROM partner_api_keys WHERE label = 'smoke-test-temporary'`);
  res.json({ ok: true, tenantsDeleted: tenantRows.length });
});
