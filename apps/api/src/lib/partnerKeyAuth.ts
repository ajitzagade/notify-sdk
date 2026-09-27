import { Request, Response, NextFunction } from 'express';
import { verifyPassword } from '@orgname/notify';
import { getPool } from './db';

export interface PartnerAuthenticatedRequest extends Request {
  partnerKeyId?: string;
}

const KEY_PREFIX_LENGTH = 8;

/**
 * Platform-level auth for /partner/* — entirely separate from tenant nsk_
 * keys (requireApiKey/apiKeyAuth.ts): a partner key can create tenants and
 * is never tenant-scoped, so it must never be interchangeable with a
 * tenant's own key. Same scrypt-hash-then-verify-by-prefix pattern.
 */
async function resolvePartnerKey(authHeader: string | undefined): Promise<{ keyId: string }> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing Authorization header (expected "Bearer <partner key>")');
  }
  const fullKey = authHeader.slice('Bearer '.length).trim();
  if (!fullKey.startsWith('psk_')) {
    throw new Error('Invalid partner key format');
  }
  const prefix = fullKey.slice(4, 4 + KEY_PREFIX_LENGTH);

  const { rows } = await getPool().query(
    `SELECT id, key_hash, key_salt FROM partner_api_keys WHERE key_prefix = $1 AND revoked_at IS NULL`,
    [prefix]
  );

  for (const row of rows) {
    if (await verifyPassword(fullKey, row.key_hash as string, row.key_salt as string)) {
      await getPool().query(`UPDATE partner_api_keys SET last_used_at = NOW() WHERE id = $1`, [row.id]);
      return { keyId: row.id as string };
    }
  }

  throw new Error('Invalid or revoked partner key');
}

/** Express middleware — 401s before the route handler runs if the key is missing/invalid/revoked. */
export async function requirePartnerKey(req: PartnerAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { keyId } = await resolvePartnerKey(req.headers.authorization);
    req.partnerKeyId = keyId;
    next();
  } catch (err) {
    res.status(401).json({ error: err instanceof Error ? err.message : 'Unauthorized' });
  }
}
