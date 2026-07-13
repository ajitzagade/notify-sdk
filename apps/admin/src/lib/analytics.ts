import { getPool } from './db';

export interface TenantRollup {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  replies: number;
  deliveryRate: number; // delivered / sent
  readRate: number;     // read / delivered
  replyRate: number;    // replies / sent
}

/** Live, always-current counts — never a cached snapshot. */
export async function getTenantRollup(tenantId: string): Promise<TenantRollup> {
  const [{ rows: msgRows }, { rows: replyRows }] = await Promise.all([
    getPool().query(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('sent','delivered','read')) AS sent,
         COUNT(*) FILTER (WHERE status IN ('delivered','read'))        AS delivered,
         COUNT(*) FILTER (WHERE status = 'read')                       AS read,
         COUNT(*) FILTER (WHERE status = 'failed')                     AS failed,
         COUNT(*)                                                      AS total
       FROM notify_log WHERE tenant_id = $1`,
      [tenantId]
    ),
    getPool().query(`SELECT COUNT(*) AS count FROM message_replies WHERE tenant_id = $1`, [tenantId]),
  ]);

  const row       = msgRows[0];
  const sent      = Number(row.sent);
  const delivered = Number(row.delivered);
  const read      = Number(row.read);
  const failed    = Number(row.failed);
  const total     = Number(row.total);
  const replies   = Number(replyRows[0].count);

  return {
    total, sent, delivered, read, failed, replies,
    deliveryRate: sent > 0 ? delivered / sent : 0,
    readRate:     delivered > 0 ? read / delivered : 0,
    replyRate:    sent > 0 ? replies / sent : 0,
  };
}

export interface CampaignLiveStats {
  campaignId: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  replies: number;
}

/**
 * Live per-campaign counts, correlated via campaigns.broadcast_id against
 * notify_log.meta->>'broadcastId' (send stats) and message_replies (reply
 * attribution). Two separate CTEs, each aggregated before the final join —
 * joining notify_log and message_replies directly in one query would fan out
 * and inflate the send counts by however many replies each message got.
 * Campaigns with no broadcast_id (never successfully run) simply get zeros.
 */
export async function getCampaignLiveStats(tenantId: string): Promise<Map<string, CampaignLiveStats>> {
  const { rows } = await getPool().query(
    `WITH send_stats AS (
       SELECT
         c.id AS campaign_id,
         COUNT(*) FILTER (WHERE nl.status IN ('sent','delivered','read')) AS sent,
         COUNT(*) FILTER (WHERE nl.status IN ('delivered','read'))        AS delivered,
         COUNT(*) FILTER (WHERE nl.status = 'read')                       AS read,
         COUNT(*) FILTER (WHERE nl.status = 'failed')                     AS failed
       FROM campaigns c
       JOIN notify_log nl ON nl.tenant_id = c.tenant_id AND nl.meta->>'broadcastId' = c.broadcast_id::text
       WHERE c.tenant_id = $1 AND c.broadcast_id IS NOT NULL
       GROUP BY c.id
     ),
     reply_stats AS (
       SELECT
         c.id AS campaign_id,
         COUNT(*) AS replies
       FROM campaigns c
       JOIN notify_log nl       ON nl.tenant_id = c.tenant_id AND nl.meta->>'broadcastId' = c.broadcast_id::text
       JOIN message_replies mr  ON mr.tenant_id = c.tenant_id AND mr.in_reply_to_wa_message_id = nl.wa_message_id
       WHERE c.tenant_id = $1 AND c.broadcast_id IS NOT NULL
       GROUP BY c.id
     )
     SELECT
       c.id AS campaign_id,
       COALESCE(s.sent, 0)      AS sent,
       COALESCE(s.delivered, 0) AS delivered,
       COALESCE(s.read, 0)      AS read,
       COALESCE(s.failed, 0)    AS failed,
       COALESCE(r.replies, 0)   AS replies
     FROM campaigns c
     LEFT JOIN send_stats s  ON s.campaign_id = c.id
     LEFT JOIN reply_stats r ON r.campaign_id = c.id
     WHERE c.tenant_id = $1`,
    [tenantId]
  );

  const map = new Map<string, CampaignLiveStats>();
  for (const row of rows) {
    map.set(row.campaign_id as string, {
      campaignId: row.campaign_id as string,
      sent:      Number(row.sent),
      delivered: Number(row.delivered),
      read:      Number(row.read),
      failed:    Number(row.failed),
      replies:   Number(row.replies),
    });
  }
  return map;
}
