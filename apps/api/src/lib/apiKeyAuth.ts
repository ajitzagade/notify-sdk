import { Request, Response, NextFunction } from 'express';
import { verifyPassword } from '@orgname/notify';
import { getPool } from './db';

export interface AuthenticatedRequest extends Request {
  tenantId?: string;
  apiKeyId?: string;
}

const KEY_PREFIX_LENGTH = 8;

async function resolveTenantFromApiKey(authHeader: string | undefined): Promise<{ tenantId: string; keyId: string }> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing Authorization header (expected "Bearer <api key>")');
  }
  const fullKey = authHeader.slice('Bearer '.length).trim();
  if (!fullKey.startsWith('nsk_')) {
    throw new Error('Invalid API key format');
  }
  const prefix = fullKey.slice(4, 4 + KEY_PREFIX_LENGTH);

  const { rows } = await getPool().query(
    `SELECT id, tenant_id, key_hash, key_salt FROM tenant_api_keys WHERE key_prefix = $1 AND revoked_at IS NULL`,
    [prefix]
  );

  for (const row of rows) {
    if (await verifyPassword(fullKey, row.key_hash as string, row.key_salt as string)) {
      await getPool().query(`UPDATE tenant_api_keys SET last_used_at = NOW() WHERE id = $1`, [row.id]);
      return { tenantId: row.tenant_id as string, keyId: row.id as string };
    }
  }

  throw new Error('Invalid or revoked API key');
}

/** Express middleware — 401s before the route handler runs if the key is missing/invalid/revoked. */
export async function requireApiKey(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { tenantId, keyId } = await resolveTenantFromApiKey(req.headers.authorization);
    req.tenantId = tenantId;
    req.apiKeyId = keyId;
    next();
  } catch (err) {
    res.status(401).json({ error: err instanceof Error ? err.message : 'Unauthorized' });
  }
}
