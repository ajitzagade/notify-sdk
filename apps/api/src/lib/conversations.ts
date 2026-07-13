import { getPool } from './db';

/**
 * Upserts the (tenant, phone) conversation row on a fresh inbound reply —
 * additive, alongside the existing storage.logReply() call (which already
 * ran, and already completed, by the time the 'reply' event this listens on
 * fires). Own try/catch: a failure here must never affect reply persistence,
 * which has already happened, or STOP/START handling, which runs after this.
 */
export async function upsertConversationOnReply(tenantId: string, phone: string): Promise<void> {
  try {
    await getPool().query(
      `INSERT INTO conversations (tenant_id, contact_phone, last_message_at, has_unread)
       VALUES ($1, $2, NOW(), true)
       ON CONFLICT (tenant_id, contact_phone) DO UPDATE SET
         last_message_at = NOW(),
         has_unread = true,
         status = 'open'`,
      [tenantId, phone]
    );
  } catch (err) {
    console.error(`[conversations] failed to upsert conversation for tenant ${tenantId}:`, err);
  }
}
