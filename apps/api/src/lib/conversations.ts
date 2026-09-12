import { getPool } from './db';

/**
 * Upserts the (tenant, phone) conversation row on a fresh inbound reply —
 * additive, alongside the existing storage.logReply() call (which already
 * ran, and already completed, by the time the 'reply' event this listens on
 * fires). Own try/catch: a failure here must never affect reply persistence,
 * which has already happened, or STOP/START handling, which runs after this.
 *
 * Auto-assigns to the tenant's least-loaded active portal user when the
 * conversation is new or was never claimed — round-robin by open-conversation
 * count. Deliberately portal-only: ops admins aren't tenant-scoped (one admin
 * can work many tenants), so there's no well-defined pool to round-robin an
 * admin assignment over — that stays manual, as it always has. The subquery
 * evaluates once against committed state at statement start; truly
 * simultaneous inbound messages for two different new contacts could both
 * land on the same agent — fine for "distribute reasonably evenly", not a
 * hard allocation guarantee.
 */
export async function upsertConversationOnReply(tenantId: string, phone: string): Promise<void> {
  try {
    await getPool().query(
      `INSERT INTO conversations (tenant_id, contact_phone, last_message_at, has_unread, assigned_portal_user_id)
       VALUES ($1, $2, NOW(), true, (
         SELECT pu.id FROM tenant_portal_users pu
          WHERE pu.tenant_id = $1 AND pu.is_active = true
          ORDER BY (
            SELECT COUNT(*) FROM conversations c2
             WHERE c2.assigned_portal_user_id = pu.id AND c2.status = 'open'
          ) ASC, pu.created_at ASC
          LIMIT 1
       ))
       ON CONFLICT (tenant_id, contact_phone) DO UPDATE SET
         last_message_at = NOW(),
         has_unread = true,
         status = 'open',
         assigned_portal_user_id = COALESCE(conversations.assigned_portal_user_id, EXCLUDED.assigned_portal_user_id)`,
      [tenantId, phone]
    );
  } catch (err) {
    console.error(`[conversations] failed to upsert conversation for tenant ${tenantId}:`, err);
  }
}
