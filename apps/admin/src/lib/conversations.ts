import type { NotifyEvent } from '@orgname/notify';
import { getPool } from './db';
import { getTenantRegistry } from './tenantRegistry';

export type ConversationStatus = 'open' | 'closed';

export interface ConversationRecord {
  id: string;
  tenantId: string;
  contactPhone: string;
  contactName: string | null;
  status: ConversationStatus;
  assignedAdminId: string | null;
  assignedAdminEmail: string | null;
  assignedPortalUserId: string | null;
  assignedPortalUserEmail: string | null;
  hasUnread: boolean;
  lastMessageAt: string;
  createdAt: string;
}

function rowToConversation(row: Record<string, unknown>): ConversationRecord {
  return {
    id:                       row.id as string,
    tenantId:                 row.tenant_id as string,
    contactPhone:             row.contact_phone as string,
    contactName:              row.contact_name as string | null,
    status:                   row.status as ConversationStatus,
    assignedAdminId:          row.assigned_admin_id as string | null,
    assignedAdminEmail:       row.assigned_admin_email as string | null,
    assignedPortalUserId:     row.assigned_portal_user_id as string | null,
    assignedPortalUserEmail:  row.assigned_portal_user_email as string | null,
    hasUnread:                row.has_unread as boolean,
    lastMessageAt:            row.last_message_at as string,
    createdAt:                row.created_at as string,
  };
}

const CONVERSATION_SELECT = `
  SELECT c.*, ct.name AS contact_name,
         u.email AS assigned_admin_email,
         pu.email AS assigned_portal_user_email
    FROM conversations c
    LEFT JOIN contacts ct ON ct.tenant_id = c.tenant_id AND ct.phone = c.contact_phone
    LEFT JOIN admin_users u ON u.id = c.assigned_admin_id
    LEFT JOIN tenant_portal_users pu ON pu.id = c.assigned_portal_user_id
`;

export async function listConversations(tenantId: string): Promise<ConversationRecord[]> {
  const { rows } = await getPool().query(
    `${CONVERSATION_SELECT} WHERE c.tenant_id = $1 ORDER BY c.last_message_at DESC LIMIT 200`,
    [tenantId]
  );
  return rows.map(rowToConversation);
}

export async function getConversation(tenantId: string, conversationId: string): Promise<ConversationRecord | null> {
  const { rows } = await getPool().query(
    `${CONVERSATION_SELECT} WHERE c.tenant_id = $1 AND c.id = $2 LIMIT 1`,
    [tenantId, conversationId]
  );
  return rows[0] ? rowToConversation(rows[0]) : null;
}

export interface ThreadMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  kind: string;
  body: string | null;
  status?: string;
  waMessageId?: string;
  buttonTitle?: string;
  at: string;
}

/**
 * Merges notify_log (outbound) and message_replies (inbound) for one
 * (tenant, phone) thread into a single time-ordered timeline. Merged in
 * application code rather than a SQL UNION — the two tables' columns don't
 * line up cleanly (jsonb meta vs. plain text body, different status
 * vocabularies), and getting a UNION's type coercion right across both is
 * more fragile than sorting two already-simple result sets here.
 */
export async function getConversationThread(tenantId: string, phone: string): Promise<ThreadMessage[]> {
  const [outbound, inbound] = await Promise.all([
    getPool().query(
      `SELECT id, template, status, wa_message_id, body_preview, created_at
         FROM notify_log WHERE tenant_id = $1 AND to_phone = $2 ORDER BY created_at ASC`,
      [tenantId, phone]
    ),
    getPool().query(
      `SELECT id, type, body, button_title, received_at
         FROM message_replies WHERE tenant_id = $1 AND from_phone = $2 ORDER BY received_at ASC`,
      [tenantId, phone]
    ),
  ]);

  const outboundMessages: ThreadMessage[] = outbound.rows.map((r) => ({
    id:          r.id as string,
    direction:   'outbound' as const,
    kind:        r.template as string,
    body:        (r.body_preview as string | null) ?? null,
    status:      r.status as string,
    waMessageId: r.wa_message_id as string | undefined,
    at:          r.created_at as string,
  }));

  const inboundMessages: ThreadMessage[] = inbound.rows.map((r) => ({
    id:          r.id as string,
    direction:   'inbound' as const,
    kind:        r.type as string,
    body:        (r.body as string | null) ?? null,
    buttonTitle: r.button_title as string | undefined,
    at:          r.received_at as string,
  }));

  return [...outboundMessages, ...inboundMessages].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export async function markConversationRead(tenantId: string, conversationId: string): Promise<void> {
  await getPool().query(
    `UPDATE conversations SET has_unread = false WHERE tenant_id = $1 AND id = $2`,
    [tenantId, conversationId]
  );
}

export async function assignConversation(tenantId: string, conversationId: string, adminId: string | null): Promise<void> {
  await getPool().query(
    `UPDATE conversations SET assigned_admin_id = $3 WHERE tenant_id = $1 AND id = $2`,
    [tenantId, conversationId, adminId]
  );
}

/** The portal-side equivalent — a client's own team member, not an ops admin. */
export async function assignConversationToPortalUser(
  tenantId: string, conversationId: string, portalUserId: string | null
): Promise<void> {
  await getPool().query(
    `UPDATE conversations SET assigned_portal_user_id = $3 WHERE tenant_id = $1 AND id = $2`,
    [tenantId, conversationId, portalUserId]
  );
}

export async function setConversationStatus(
  tenantId: string,
  conversationId: string,
  status: ConversationStatus
): Promise<void> {
  await getPool().query(
    `UPDATE conversations SET status = $3 WHERE tenant_id = $1 AND id = $2`,
    [tenantId, conversationId, status]
  );
}

/** Sends a reply through the tenant's own WhatsApp number — the same client.send() path Test Send already uses, no new send logic. */
export async function sendReplyInThread(tenantId: string, phone: string, text: string): Promise<NotifyEvent> {
  const client = await getTenantRegistry().getClient(tenantId);
  try {
    return await client.send({ to: phone, template: 'text', text });
  } finally {
    // Touch the conversation regardless of outcome — an admin just acted on
    // this thread whether the send ultimately succeeded, was blocked by the
    // opt-in guard, or genuinely errored (client.send() throwing on a real
    // API error would otherwise skip this if it ran after, not in a finally).
    await getPool()
      .query(
        `UPDATE conversations SET last_message_at = NOW(), has_unread = false WHERE tenant_id = $1 AND contact_phone = $2`,
        [tenantId, phone]
      )
      .catch((err) => console.error(`[conversations] failed to touch conversation for tenant ${tenantId}:`, err));
  }
}

/** Just the open-conversation count — cheap enough to run in the portal layout on every render. */
export async function countOpenConversations(tenantId: string): Promise<number> {
  const { rows } = await getPool().query(
    `SELECT COUNT(*) AS count FROM conversations WHERE tenant_id = $1 AND status = 'open'`,
    [tenantId]
  );
  return Number(rows[0].count);
}
