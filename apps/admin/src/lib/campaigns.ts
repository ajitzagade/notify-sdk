import { getPool } from './db';

export type HeaderMediaType = 'image' | 'video' | 'document';

export interface CampaignRecord {
  id: string;
  tenantId: string;
  name: string;
  broadcastListId: string;
  hsmTemplateName: string;
  hsmLanguage: string;
  hsmParams: string[];
  headerMediaType: HeaderMediaType | null;
  headerMediaUrl: string | null;
  status: 'draft' | 'running' | 'completed' | 'failed';
  stats: Record<string, unknown> | null;
  broadcastId: string | null;
  createdAt: string;
  completedAt: string | null;
}

function rowToCampaign(row: Record<string, unknown>): CampaignRecord {
  return {
    id:               row.id as string,
    tenantId:         row.tenant_id as string,
    name:             row.name as string,
    broadcastListId:  row.broadcast_list_id as string,
    hsmTemplateName:  row.hsm_template_name as string,
    hsmLanguage:      row.hsm_language as string,
    hsmParams:        (row.hsm_params as string[]) ?? [],
    headerMediaType:  row.header_media_type as HeaderMediaType | null,
    headerMediaUrl:   row.header_media_url as string | null,
    status:           row.status as CampaignRecord['status'],
    stats:            row.stats as Record<string, unknown> | null,
    broadcastId:      row.broadcast_id as string | null,
    createdAt:        row.created_at as string,
    completedAt:      row.completed_at as string | null,
  };
}

export async function listCampaigns(tenantId: string): Promise<CampaignRecord[]> {
  const { rows } = await getPool().query(
    `SELECT * FROM campaigns WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenantId]
  );
  return rows.map(rowToCampaign);
}

export async function getCampaign(tenantId: string, campaignId: string): Promise<CampaignRecord | null> {
  const { rows } = await getPool().query(
    `SELECT * FROM campaigns WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
    [tenantId, campaignId]
  );
  return rows[0] ? rowToCampaign(rows[0]) : null;
}

export async function createCampaign(input: {
  tenantId: string;
  name: string;
  broadcastListId: string;
  hsmTemplateName: string;
  hsmLanguage: string;
  hsmParams: string[];
  headerMediaType?: HeaderMediaType | null;
  headerMediaUrl?: string | null;
  /** Exactly one of these two should be set — attributes the campaign to who created it. */
  createdByAdminId?: string;
  createdByTenantUserId?: string;
}): Promise<CampaignRecord> {
  const { rows } = await getPool().query(
    `INSERT INTO campaigns (tenant_id, name, broadcast_list_id, hsm_template_name, hsm_language, hsm_params, header_media_type, header_media_url, created_by_admin_id, created_by_tenant_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [
      input.tenantId, input.name, input.broadcastListId,
      input.hsmTemplateName, input.hsmLanguage, JSON.stringify(input.hsmParams),
      input.headerMediaType ?? null, input.headerMediaUrl ?? null,
      input.createdByAdminId ?? null, input.createdByTenantUserId ?? null,
    ]
  );
  return rowToCampaign(rows[0]);
}

export interface CampaignRecipientRow {
  phone: string;
  name: string | null;
  status: string;
  errorMessage: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
}

export interface CampaignReplyRow {
  phone: string;
  name: string | null;
  type: string;
  body: string | null;
  buttonTitle: string | null;
  receivedAt: string;
}

export interface CampaignDetail {
  campaign: CampaignRecord;
  listName: string | null;
  createdBy: string | null;
  /** The rendered message text, as captured from the actual send (notify_log.body_preview). */
  messagePreview: string | null;
  recipients: CampaignRecipientRow[];
  replies: CampaignReplyRow[];
}

/**
 * Full history of one campaign run: what was sent, to whom, and what came
 * back. Per-recipient rows come live from notify_log via the same
 * meta->>'broadcastId' correlation analytics uses — never campaigns.stats.
 */
export async function getCampaignDetail(tenantId: string, campaignId: string): Promise<CampaignDetail | null> {
  const campaign = await getCampaign(tenantId, campaignId);
  if (!campaign) return null;

  const pool = getPool();
  const [metaRes, recipientsRes, repliesRes] = await Promise.all([
    pool.query(
      `SELECT l.name AS list_name, au.email AS admin_email, tpu.email AS portal_email
         FROM campaigns c
         LEFT JOIN broadcast_lists l      ON l.id = c.broadcast_list_id
         LEFT JOIN admin_users au         ON au.id = c.created_by_admin_id
         LEFT JOIN tenant_portal_users tpu ON tpu.id = c.created_by_tenant_user_id
        WHERE c.id = $1`,
      [campaign.id]
    ),
    campaign.broadcastId
      ? pool.query(
          `SELECT nl.to_phone, ct.name, nl.status, nl.error_message, nl.sent_at, nl.delivered_at, nl.read_at, nl.body_preview
             FROM notify_log nl
             LEFT JOIN contacts ct ON ct.tenant_id = nl.tenant_id AND ct.phone = nl.to_phone
            WHERE nl.tenant_id = $1 AND nl.meta->>'broadcastId' = $2
            ORDER BY nl.to_phone`,
          [tenantId, campaign.broadcastId]
        )
      : Promise.resolve({ rows: [] as Record<string, unknown>[] }),
    campaign.broadcastId
      ? pool.query(
          `SELECT mr.from_phone, ct.name, mr.type, mr.body, mr.button_title, mr.received_at
             FROM message_replies mr
             LEFT JOIN contacts ct ON ct.tenant_id = mr.tenant_id AND ct.phone = mr.from_phone
            WHERE mr.tenant_id = $1
              AND mr.in_reply_to_wa_message_id IN (
                SELECT wa_message_id FROM notify_log
                 WHERE tenant_id = $1 AND meta->>'broadcastId' = $2 AND wa_message_id IS NOT NULL
              )
            ORDER BY mr.received_at`,
          [tenantId, campaign.broadcastId]
        )
      : Promise.resolve({ rows: [] as Record<string, unknown>[] }),
  ]);

  const meta = metaRes.rows[0] ?? {};
  return {
    campaign,
    listName:       (meta.list_name as string) ?? null,
    createdBy:      (meta.admin_email as string) ?? (meta.portal_email as string) ?? null,
    messagePreview: (recipientsRes.rows.find((r) => r.body_preview)?.body_preview as string) ?? null,
    recipients: recipientsRes.rows.map((r) => ({
      phone:        r.to_phone as string,
      name:         r.name as string | null,
      status:       r.status as string,
      errorMessage: r.error_message as string | null,
      sentAt:       r.sent_at as string | null,
      deliveredAt:  r.delivered_at as string | null,
      readAt:       r.read_at as string | null,
    })),
    replies: repliesRes.rows.map((r) => ({
      phone:       r.from_phone as string,
      name:        r.name as string | null,
      type:        r.type as string,
      body:        r.body as string | null,
      buttonTitle: r.button_title as string | null,
      receivedAt:  r.received_at as string,
    })),
  };
}

export async function markCampaignRunning(campaignId: string): Promise<void> {
  await getPool().query(`UPDATE campaigns SET status = 'running' WHERE id = $1`, [campaignId]);
}

export async function completeCampaign(
  campaignId: string,
  status: 'completed' | 'failed',
  stats: Record<string, unknown>
): Promise<void> {
  const broadcastId = typeof stats.broadcastId === 'string' ? stats.broadcastId : null;
  await getPool().query(
    `UPDATE campaigns SET status = $1, stats = $2, broadcast_id = $3, completed_at = NOW() WHERE id = $4`,
    [status, JSON.stringify(stats), broadcastId, campaignId]
  );
}
