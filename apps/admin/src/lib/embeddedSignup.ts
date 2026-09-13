// Phase 2 of docs/whatsapp-platform-roadmap.md: server side of Embedded Signup.
// DORMANT until the platform's Meta app clears App Review — activation is
// purely environmental (see docs/phase2-launch-checklist.md):
//
//   META_APP_ID / META_APP_SECRET              server: code exchange, webhook signatures
//   NEXT_PUBLIC_META_APP_ID                    client: FB.init
//   NEXT_PUBLIC_META_ES_CONFIG_ID              client: the Embedded Signup configuration
//
// With none of those set, isEmbeddedSignupEnabled() is false, the chooser keeps
// its disabled "Coming soon" door, and the route below 503s. No code changes
// needed on launch day.

import crypto from 'crypto';
import { encryptSecret } from '@orgname/notify';
import { getPool } from './db';
import { getMasterKeyRing } from './security';
import {
  exchangeEmbeddedSignupCode,
  subscribeAppToWaba,
  registerPhoneNumber,
  verifyWhatsAppCredentials,
} from './metaGraph';
import { getTenantRegistry } from './tenantRegistry';

export function getEmbeddedSignupServerConfig(): { appId: string; appSecret: string } | null {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

export type EmbeddedSignupResult =
  | { ok: true; displayName?: string; displayPhoneNumber?: string }
  | { ok: false; error: string; statusCode: number };

/**
 * Completes an Embedded Signup: the browser hands us the one-shot OAuth code
 * plus the WABA/phone ids Meta posted to the opener window. Everything after
 * the exchange funnels into the exact same credential row the manual path
 * writes — onboarding_method is the only difference, and nothing downstream
 * reads it for behavior.
 */
export async function completeEmbeddedSignup(
  tenantId: string,
  input: { code: string; wabaId: string; phoneNumberId: string }
): Promise<EmbeddedSignupResult> {
  const config = getEmbeddedSignupServerConfig();
  if (!config) {
    return { ok: false, error: 'Embedded Signup is not enabled on this deployment', statusCode: 503 };
  }

  const exchange = await exchangeEmbeddedSignupCode(config.appId, config.appSecret, input.code);
  if (!exchange.ok || !exchange.accessToken) {
    return { ok: false, error: `Token exchange failed: ${exchange.error}`, statusCode: 502 };
  }
  const businessToken = exchange.accessToken;
  // Fall back to 60 days if Meta ever omits expires_in — the configuration is
  // fixed to a 60-day System-user token, so this should always be present,
  // but never leave the refresh cron with nothing to schedule against.
  const expiresAt = new Date(Date.now() + (exchange.expiresInSeconds ?? 60 * 24 * 60 * 60) * 1000);

  // Without this subscription, the tenant's inbound messages never reach us.
  const subscribed = await subscribeAppToWaba(businessToken, input.wabaId);
  if (!subscribed.ok) {
    return { ok: false, error: `Webhook subscription failed: ${subscribed.error}`, statusCode: 502 };
  }

  // Best-effort: registration fails benignly when the number is already
  // registered (e.g. a retry after a partial failure). The verify below is
  // what decides whether the credentials actually work.
  const pin = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await registerPhoneNumber(businessToken, input.phoneNumberId, pin);

  const verification = await verifyWhatsAppCredentials(businessToken, input.phoneNumberId);
  if (!verification.ok) {
    return { ok: false, error: `Meta rejected the new credentials: ${verification.error}`, statusCode: 422 };
  }

  const ring = getMasterKeyRing();
  const tokenEnc = encryptSecret(businessToken, tenantId, ring.currentKey, ring.currentVersion);
  // Inbound webhooks for Embedded-Signup tenants are signed by the PLATFORM
  // app's secret (they arrive via our Meta app), so that's what we store as
  // this tenant's appSecret — TenantWebhookRouter verifies per-tenant exactly
  // as it does for manual tenants, no special-casing.
  const appSecretEnc = encryptSecret(config.appSecret, tenantId, ring.currentKey, ring.currentVersion);
  const verifyToken = crypto.randomBytes(16).toString('hex');

  try {
    await getPool().query(
      `INSERT INTO tenant_wa_credentials
         (tenant_id, phone_number_id, waba_id,
          access_token_ciphertext, access_token_iv, access_token_tag,
          app_secret_ciphertext, app_secret_iv, app_secret_tag,
          verify_token, key_version, last_verified_at, last_verified_status, onboarding_method,
          access_token_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), 'ok', 'embedded_signup', $12)
       ON CONFLICT (tenant_id) DO UPDATE SET
         phone_number_id         = EXCLUDED.phone_number_id,
         waba_id                 = EXCLUDED.waba_id,
         access_token_ciphertext = EXCLUDED.access_token_ciphertext,
         access_token_iv         = EXCLUDED.access_token_iv,
         access_token_tag        = EXCLUDED.access_token_tag,
         app_secret_ciphertext   = EXCLUDED.app_secret_ciphertext,
         app_secret_iv           = EXCLUDED.app_secret_iv,
         app_secret_tag          = EXCLUDED.app_secret_tag,
         verify_token             = EXCLUDED.verify_token,
         key_version              = EXCLUDED.key_version,
         last_verified_at        = NOW(),
         last_verified_status    = 'ok',
         onboarding_method        = 'embedded_signup',
         access_token_expires_at  = EXCLUDED.access_token_expires_at,
         updated_at               = NOW()`,
      [
        tenantId,
        input.phoneNumberId,
        input.wabaId,
        tokenEnc.ciphertext, tokenEnc.iv, tokenEnc.tag,
        appSecretEnc.ciphertext, appSecretEnc.iv, appSecretEnc.tag,
        verifyToken,
        ring.currentVersion,
        expiresAt,
      ]
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('duplicate key') && msg.includes('phone_number_id')) {
      return {
        ok: false,
        error: `Phone number ID ${input.phoneNumberId} is already connected to another tenant`,
        statusCode: 409,
      };
    }
    throw err;
  }

  getTenantRegistry().invalidate(tenantId);

  return {
    ok: true,
    displayName: verification.displayName,
    displayPhoneNumber: verification.displayPhoneNumber,
  };
}
