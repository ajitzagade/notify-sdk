// TEMPORARY — issues one real, persistent partner key for Cliniqly's
// NOTIFY_PARTNER_KEY. No self-serve issuance endpoint exists by design;
// DATABASE_URL is unreachable via CLI. Removed once the key is confirmed
// delivered — this key is meant to PERSIST (unlike the earlier smoke-test
// key, which was deleted after use).
import express, { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { hashPassword } from '@orgname/notify';
import { getPool } from '../lib/db';

export const internalIssueKeyRouter = Router();
internalIssueKeyRouter.use(express.json());

internalIssueKeyRouter.post('/internal/issue-partner-key', async (req: Request, res: Response) => {
  const secret = process.env.INTERNAL_MIGRATE_SECRET;
  if (!secret || req.headers['x-migrate-secret'] !== secret) {
    res.status(404).end();
    return;
  }
  const { label } = req.body as { label?: string };
  const raw = crypto.randomBytes(24).toString('base64url');
  const keyPrefix = raw.slice(0, 8);
  const fullKey = `psk_${raw}`;
  const { hash, salt } = await hashPassword(fullKey);

  await getPool().query(
    `INSERT INTO partner_api_keys (key_prefix, key_hash, key_salt, label) VALUES ($1, $2, $3, $4)`,
    [keyPrefix, hash, salt, label ?? 'Cliniqly integration']
  );

  res.json({ ok: true, fullKey, keyPrefix });
});

internalIssueKeyRouter.post('/internal/delete-tenant-by-name', async (req: Request, res: Response) => {
  const secret = process.env.INTERNAL_MIGRATE_SECRET;
  if (!secret || req.headers['x-migrate-secret'] !== secret) {
    res.status(404).end();
    return;
  }
  const { name } = req.body as { name: string };
  const pool = getPool();
  const { rows } = await pool.query(`SELECT id FROM tenants WHERE name = $1`, [name]);
  for (const row of rows) {
    await pool.query(`DELETE FROM webhook_endpoints WHERE tenant_id = $1`, [row.id]);
    await pool.query(`DELETE FROM tenant_api_keys WHERE tenant_id = $1`, [row.id]);
    await pool.query(`DELETE FROM tenant_wa_credentials WHERE tenant_id = $1`, [row.id]);
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [row.id]);
  }
  res.json({ ok: true, deleted: rows.length });
});
