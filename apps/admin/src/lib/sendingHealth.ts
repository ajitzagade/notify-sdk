// Sending health (Phase 1 of docs/whatsapp-platform-roadmap.md): every WABA
// has a messaging-limit tier (unverified businesses start at 250 unique
// customers per rolling 24h) and a quality rating, both invisible in-product
// until sends start failing. This surfaces them next to a live local count of
// unique recipients so a tenant sees the ceiling before hitting it.

import { getPool } from './db';
import { getCredentialStatus } from './tenants';
import { getDecryptedTenantCredentials } from './tenantRegistry';
import { fetchPhoneNumberHealth } from './metaGraph';

export interface SendingHealth {
  configured: boolean;
  /** Distinct recipients this tenant messaged in the last rolling 24h (local count). */
  uniqueRecipients24h: number;
  /** Daily unique-customer ceiling for the current tier; null = unlimited or unknown. */
  dailyLimit: number | null;
  /** Meta's raw tier value (TIER_250, TIER_1K, …); null if unavailable. */
  tier: string | null;
  /** Meta's quality rating (GREEN / YELLOW / RED); null if unavailable. */
  qualityRating: string | null;
}

const TIER_LIMITS: Record<string, number | null> = {
  TIER_50:        50,
  TIER_250:       250,
  TIER_1K:        1_000,
  TIER_10K:       10_000,
  TIER_100K:      100_000,
  TIER_UNLIMITED: null,
};

export async function getSendingHealth(tenantId: string): Promise<SendingHealth> {
  const [countResult, status] = await Promise.all([
    getPool().query(
      `SELECT COUNT(DISTINCT to_phone) AS n
         FROM notify_log
        WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [tenantId]
    ),
    getCredentialStatus(tenantId),
  ]);
  const uniqueRecipients24h = Number(countResult.rows[0]?.n ?? 0);

  if (!status.configured) {
    return { configured: false, uniqueRecipients24h, dailyLimit: null, tier: null, qualityRating: null };
  }

  // Best-effort: a Meta outage or expired token must never break the dashboard.
  let tier: string | null = null;
  let qualityRating: string | null = null;
  try {
    const creds = await getDecryptedTenantCredentials(tenantId);
    const health = await fetchPhoneNumberHealth(creds.accessToken, creds.phoneNumberId);
    if (health.ok) {
      tier = health.messagingLimitTier ?? null;
      qualityRating = health.qualityRating ?? null;
    }
  } catch {
    // leave nulls — UI renders "unavailable"
  }

  return {
    configured: true,
    uniqueRecipients24h,
    dailyLimit: tier ? (TIER_LIMITS[tier] ?? null) : null,
    tier,
    qualityRating,
  };
}
