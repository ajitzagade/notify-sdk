import crypto from 'crypto';
import { encryptSecret } from '@orgname/notify';
import { getPool } from './db';
import { getMasterKeyRing } from './security';

export type WebhookEvent = 'sent' | 'delivered' | 'read' | 'failed' | 'reply';
export const ALL_WEBHOOK_EVENTS: WebhookEvent[] = ['sent', 'delivered', 'read', 'failed', 'reply'];

export interface WebhookEndpointRecord {
  id: string;
  tenantId: string;
  url: string;
  events: WebhookEvent[];
  isActive: boolean;
  consecutiveFailures: number;
  disabledAt: string | null;
  createdAt: string;
}

function rowToEndpoint(row: Record<string, unknown>): WebhookEndpointRecord {
  return {
    id:                  row.id as string,
    tenantId:            row.tenant_id as string,
    url:                 row.url as string,
    events:              row.events as WebhookEvent[],
    isActive:            row.is_active as boolean,
    consecutiveFailures: row.consecutive_failures as number,
    disabledAt:          row.disabled_at as string | null,
    createdAt:           row.created_at as string,
  };
}

export async function listWebhookEndpoints(tenantId: string): Promise<WebhookEndpointRecord[]> {
  const { rows } = await getPool().query(
    `SELECT * FROM webhook_endpoints WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenantId]
  );
  return rows.map(rowToEndpoint);
}

/** Creates an endpoint and returns its signing secret exactly once — encrypted at rest, never displayed again after this call. */
export async function createWebhookEndpoint(input: {
  tenantId: string;
  url: string;
  events: WebhookEvent[];
  createdByAdminId: string;
}): Promise<{ record: WebhookEndpointRecord; secret: string }> {
  const secret = `whsec_${crypto.randomBytes(24).toString('base64url')}`;
  const ring   = getMasterKeyRing();
  const enc    = encryptSecret(secret, input.tenantId, ring.currentKey, ring.currentVersion);

  const { rows } = await getPool().query(
    `INSERT INTO webhook_endpoints
       (tenant_id, url, secret_ciphertext, secret_iv, secret_tag, key_version, events, created_by_admin_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [input.tenantId, input.url, enc.ciphertext, enc.iv, enc.tag, ring.currentVersion, input.events, input.createdByAdminId]
  );

  return { record: rowToEndpoint(rows[0]), secret };
}

export async function deleteWebhookEndpoint(tenantId: string, endpointId: string): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `DELETE FROM webhook_endpoints WHERE id = $1 AND tenant_id = $2`,
    [endpointId, tenantId]
  );
  return (rowCount ?? 0) > 0;
}

/** Brings a self-disabled (too many consecutive failures) endpoint back — resets the failure counter for a fresh start. */
export async function reactivateWebhookEndpoint(tenantId: string, endpointId: string): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `UPDATE webhook_endpoints SET is_active = true, disabled_at = NULL, consecutive_failures = 0
     WHERE id = $1 AND tenant_id = $2`,
    [endpointId, tenantId]
  );
  return (rowCount ?? 0) > 0;
}
