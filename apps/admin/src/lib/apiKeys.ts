import crypto from 'crypto';
import { hashPassword } from '@orgname/notify';
import { getPool } from './db';

const KEY_PREFIX_LENGTH = 8;

export interface ApiKeyRecord {
  id: string;
  tenantId: string;
  keyPrefix: string;
  label: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

function rowToKey(row: Record<string, unknown>): ApiKeyRecord {
  return {
    id:           row.id as string,
    tenantId:     row.tenant_id as string,
    keyPrefix:    row.key_prefix as string,
    label:        row.label as string | null,
    lastUsedAt:   row.last_used_at as string | null,
    revokedAt:    row.revoked_at as string | null,
    createdAt:    row.created_at as string,
  };
}

export async function listApiKeys(tenantId: string): Promise<ApiKeyRecord[]> {
  const { rows } = await getPool().query(
    `SELECT * FROM tenant_api_keys WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenantId]
  );
  return rows.map(rowToKey);
}

/**
 * Creates a new key and returns the full secret exactly once — it's hashed
 * (via the same scrypt primitive as admin passwords) before storage and can
 * never be retrieved again, only rotated.
 */
export async function createApiKey(
  tenantId: string,
  label: string | undefined,
  createdByAdminId: string
): Promise<{ record: ApiKeyRecord; fullKey: string }> {
  const secret    = crypto.randomBytes(24).toString('base64url');
  const keyPrefix = secret.slice(0, KEY_PREFIX_LENGTH);
  const fullKey   = `nsk_${secret}`;

  const { hash, salt } = await hashPassword(fullKey);

  const { rows } = await getPool().query(
    `INSERT INTO tenant_api_keys (tenant_id, key_prefix, key_hash, key_salt, label, created_by_admin_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [tenantId, keyPrefix, hash, salt, label ?? null, createdByAdminId]
  );

  return { record: rowToKey(rows[0]), fullKey };
}

export async function revokeApiKey(tenantId: string, keyId: string): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `UPDATE tenant_api_keys SET revoked_at = NOW() WHERE id = $1 AND tenant_id = $2 AND revoked_at IS NULL`,
    [keyId, tenantId]
  );
  return (rowCount ?? 0) > 0;
}
