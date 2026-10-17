// Pre-flight checks shared by the admin and portal campaign run routes.
// Runs after the recipient list is loaded but before the campaign is marked
// running, so a blocked campaign stays in `draft` and can be re-run after the
// operator fixes the cause.

import { getPool } from './db';
import { getSendingHealth } from './sendingHealth';
import { MAX_CAMPAIGN_RECIPIENTS } from './bulkSendConfig';

export type PrecheckResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export async function precheckCampaignSend(tenantId: string, phones: string[]): Promise<PrecheckResult> {
  const unique = [...new Set(phones.filter(Boolean))];

  if (unique.length > MAX_CAMPAIGN_RECIPIENTS) {
    return {
      ok: false,
      status: 400,
      error:
        `Campaign too large: ${unique.length} unique recipients (max ${MAX_CAMPAIGN_RECIPIENTS} per campaign). ` +
        `Split the audience into smaller broadcast lists and run them as separate campaigns.`,
    };
  }

  // Meta caps each number at N *unique* recipients per rolling 24h (tier-based;
  // unverified businesses start at 250). Recipients already messaged in the
  // window don't consume new quota, so project the post-send unique count and
  // block only a genuine overage — those sends would all fail at Meta and drag
  // the number's quality rating down. Fail open when the tier is unknown
  // (Meta outage / expired token): same best-effort stance as the dashboard.
  const health = await getSendingHealth(tenantId);
  if (health.dailyLimit !== null) {
    const overlapResult = await getPool().query(
      `SELECT COUNT(DISTINCT to_phone) AS n
         FROM notify_log
        WHERE tenant_id = $1
          AND created_at > NOW() - INTERVAL '24 hours'
          AND to_phone = ANY($2)`,
      [tenantId, unique]
    );
    const alreadyMessaged = Number(overlapResult.rows[0]?.n ?? 0);
    const projected = health.uniqueRecipients24h + (unique.length - alreadyMessaged);

    if (projected > health.dailyLimit) {
      return {
        ok: false,
        status: 400,
        error:
          `Campaign blocked: it would reach ~${projected} unique recipients in 24h, above this WhatsApp ` +
          `number's current messaging limit of ${health.dailyLimit}/24h (tier ${health.tier}; ` +
          `~${health.uniqueRecipients24h} already used). Shrink the list, wait for the 24h window to roll ` +
          `over, or complete Meta business verification to raise the limit.`,
      };
    }
  }

  return { ok: true };
}
