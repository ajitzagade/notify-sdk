import { decryptSecret, resolveKeyForVersion, deliverSignedWebhook } from '@orgname/notify';
import { getPool } from './db';
import { getMasterKeyRing } from './security';

export type WebhookEvent = 'sent' | 'delivered' | 'read' | 'failed' | 'reply';

/** After this many consecutive delivery failures, an endpoint auto-disables rather than retrying forever. */
const MAX_CONSECUTIVE_FAILURES = 10;

interface EndpointRow {
  id: string;
  url: string;
  secret_ciphertext: string;
  secret_iv: string;
  secret_tag: string;
  key_version: number;
  consecutive_failures: number;
}

/**
 * Fires a tenant's active webhook endpoints for one event. Never throws —
 * every delivery attempt is independently try/caught so one endpoint's
 * failure can't affect another's, or affect the caller (a message send /
 * webhook processing path that's already completed by the time this runs).
 *
 * Mirrors apps/admin/src/lib/webhookDispatch.ts — endpoints are configured
 * from the admin UI only, but sent/delivered/read/failed/reply events fire
 * from whichever client actually processed them, so both apps need their
 * own copy of the dispatch logic (unlike Phase 1's AI auto-reply, which
 * only ever fires from inbound webhook processing here in apps/api).
 */
export async function dispatchOutboundWebhooks(
  tenantId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const { rows } = await getPool().query<EndpointRow>(
      `SELECT id, url, secret_ciphertext, secret_iv, secret_tag, key_version, consecutive_failures
         FROM webhook_endpoints
        WHERE tenant_id = $1 AND is_active = true AND $2 = ANY(events)`,
      [tenantId, event]
    );
    if (rows.length === 0) return;

    await Promise.all(rows.map((row) => deliverToEndpoint(tenantId, event, payload, row)));
  } catch (err) {
    console.error(`[webhook-dispatch] failed to load endpoints for tenant ${tenantId}:`, err);
  }
}

async function deliverToEndpoint(
  tenantId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>,
  row: EndpointRow
): Promise<void> {
  try {
    const masterKey = resolveKeyForVersion(getMasterKeyRing(), row.key_version);
    const secret = decryptSecret(
      { ciphertext: row.secret_ciphertext, iv: row.secret_iv, tag: row.secret_tag },
      tenantId,
      masterKey,
      row.key_version
    );

    const result = await deliverSignedWebhook({ url: row.url, secret, event, payload });

    if (result.delivered) {
      if (row.consecutive_failures > 0) {
        await getPool().query(`UPDATE webhook_endpoints SET consecutive_failures = 0 WHERE id = $1`, [row.id]);
      }
      return;
    }

    const failures = row.consecutive_failures + 1;
    if (failures >= MAX_CONSECUTIVE_FAILURES) {
      await getPool().query(
        `UPDATE webhook_endpoints SET consecutive_failures = $2, is_active = false, disabled_at = NOW() WHERE id = $1`,
        [row.id, failures]
      );
    } else {
      await getPool().query(`UPDATE webhook_endpoints SET consecutive_failures = $2 WHERE id = $1`, [row.id, failures]);
    }
  } catch (err) {
    console.error(`[webhook-dispatch] delivery to endpoint ${row.id} threw unexpectedly:`, err);
  }
}
