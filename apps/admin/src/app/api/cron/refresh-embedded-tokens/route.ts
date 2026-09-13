import { NextRequest, NextResponse } from 'next/server';
import { decryptSecret, encryptSecret, resolveKeyForVersion } from '@orgname/notify';
import { getPool } from '@/lib/db';
import { getMasterKeyRing } from '@/lib/security';
import { getEmbeddedSignupServerConfig } from '@/lib/embeddedSignup';
import { refreshLongLivedAccessToken } from '@/lib/metaGraph';
import { getTenantRegistry } from '@/lib/tenantRegistry';

export const maxDuration = 60;

interface DueTokenRow {
  tenant_id: string;
  access_token_ciphertext: string;
  access_token_iv: string;
  access_token_tag: string;
  key_version: number;
}

/**
 * Runs once/day (apps/admin/vercel.json). The Embedded Signup "System-user
 * access token, 60 days" configuration expires — unlike the manual path's
 * permanent System User token — so this refreshes it via Meta's standard
 * fb_exchange_token grant well before that happens (30-day window comfortably
 * clears Meta's own "token must be ≥24h old" refresh requirement). Manual-path
 * tenants have access_token_expires_at = NULL and are never selected here.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = getEmbeddedSignupServerConfig();
  if (!config) {
    return NextResponse.json({ ok: true, skipped: 'Embedded Signup not configured on this deployment' });
  }

  const pool = getPool();
  const { rows: due } = await pool.query<DueTokenRow>(
    `SELECT tenant_id, access_token_ciphertext, access_token_iv, access_token_tag, key_version
       FROM tenant_wa_credentials
      WHERE onboarding_method = 'embedded_signup'
        AND access_token_expires_at IS NOT NULL
        AND access_token_expires_at <= NOW() + INTERVAL '30 days'`
  );

  const results: Array<{ tenantId: string; ok: boolean; error?: string }> = [];
  const ring = getMasterKeyRing();

  for (const row of due) {
    try {
      const oldKey = resolveKeyForVersion(ring, row.key_version);
      const currentToken = decryptSecret(
        { ciphertext: row.access_token_ciphertext, iv: row.access_token_iv, tag: row.access_token_tag },
        row.tenant_id,
        oldKey,
        row.key_version
      );

      const refreshed = await refreshLongLivedAccessToken(config.appId, config.appSecret, currentToken);
      if (!refreshed.ok || !refreshed.accessToken) {
        throw new Error(refreshed.error ?? 'refresh returned no token');
      }

      const expiresAt = new Date(Date.now() + (refreshed.expiresInSeconds ?? 60 * 24 * 60 * 60) * 1000);
      const tokenEnc = encryptSecret(refreshed.accessToken, row.tenant_id, ring.currentKey, ring.currentVersion);

      await pool.query(
        `UPDATE tenant_wa_credentials
            SET access_token_ciphertext = $2, access_token_iv = $3, access_token_tag = $4,
                key_version = $5, access_token_expires_at = $6, updated_at = NOW()
          WHERE tenant_id = $1`,
        [row.tenant_id, tokenEnc.ciphertext, tokenEnc.iv, tokenEnc.tag, ring.currentVersion, expiresAt]
      );

      // The cached NotifyClient holds the old (soon-to-be-stale) token in memory.
      getTenantRegistry().invalidate(row.tenant_id);

      results.push({ tenantId: row.tenant_id, ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron/refresh-embedded-tokens] tenant ${row.tenant_id} failed:`, err);
      results.push({ tenantId: row.tenant_id, ok: false, error: msg });
    }
  }

  return NextResponse.json({ ok: true, tenantsChecked: due.length, results });
}
