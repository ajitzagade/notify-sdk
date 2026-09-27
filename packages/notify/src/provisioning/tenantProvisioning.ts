import crypto from 'crypto';
import { encryptSecret, decryptSecret, resolveKeyForVersion } from '../security/CredentialCipher';
import { hashPassword } from '../security/PasswordHash';
import { MasterKeyRing } from '../security/CredentialCipher';
import {
  verifyWhatsAppCredentials,
  exchangeEmbeddedSignupCode,
  subscribeAppToWaba,
  registerPhoneNumber,
} from './metaGraphClient';

/**
 * A minimal query-capable pool — matches the shape PostgresAdapter already
 * expects (pg.Pool is structurally compatible, nothing pg-specific is used).
 */
export interface ProvisioningPool {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
}

export interface ProvisioningContext {
  pool: ProvisioningPool;
  masterKeyRing: MasterKeyRing;
}

/**
 * Parameterized (no local getPool()/getMasterKeyRing() imports) so both
 * apps/admin and apps/api's partner routes can call the exact same
 * tenant-creation, webhook-endpoint, API-key, and Embedded-Signup writes
 * against tenant_wa_credentials without hand-duplicating the SQL — the
 * duplication risk the Cliniqly integration brief called out by name.
 * apps/admin's existing lib files are untouched; this is new code, not a
 * relocation of theirs (see docs/cliniqly-integration-brief.md item 1).
 */

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && slug.length >= 2 && slug.length <= 100;
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
  return base.length >= 2 ? base : `tenant-${crypto.randomBytes(3).toString('hex')}`;
}

export interface ProvisionedTenant {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  createdAt: string;
}

/**
 * Creates a tenant. If `slug` isn't supplied, one is derived from `name`
 * with a numeric suffix on collision — a partner platform shouldn't need
 * to replicate the admin console's slug-uniqueness UX to onboard a client.
 */
export async function createTenant(
  ctx: ProvisioningContext,
  input: { name: string; slug?: string; category?: string; businessDescription?: string }
): Promise<ProvisionedTenant> {
  const baseSlug = input.slug?.trim().toLowerCase() || slugify(input.name);
  if (input.slug && !isValidSlug(baseSlug)) {
    throw new Error('slug must be lowercase alphanumeric with hyphens, 2-100 chars');
  }

  let slug = baseSlug;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const { rows } = await ctx.pool.query(
        `INSERT INTO tenants (name, slug, business_description, category)
         VALUES ($1, $2, $3, $4) RETURNING id, name, slug, category, created_at`,
        [input.name, slug, input.businessDescription ?? null, input.category ?? null]
      );
      const row = rows[0];
      return {
        id: row.id as string,
        name: row.name as string,
        slug: row.slug as string,
        category: row.category as string | null,
        createdAt: row.created_at as string,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('duplicate key') && msg.includes('slug') && !input.slug) {
        slug = `${baseSlug}-${attempt + 2}`; // caller-supplied slugs fail fast instead of silently changing
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Could not derive a unique slug from "${input.name}" after 20 attempts`);
}

export interface ProvisionedApiKey {
  id: string;
  tenantId: string;
  keyPrefix: string;
  fullKey: string;
}

const KEY_PREFIX_LENGTH = 8;

/** Issues (or rotates, by calling again) a tenant's nsk_ API key. Plaintext is returned only here, once. */
export async function issueApiKey(
  ctx: ProvisioningContext,
  tenantId: string,
  label?: string
): Promise<ProvisionedApiKey> {
  const secret    = crypto.randomBytes(24).toString('base64url');
  const keyPrefix = secret.slice(0, KEY_PREFIX_LENGTH);
  const fullKey   = `nsk_${secret}`;
  const { hash, salt } = await hashPassword(fullKey);

  const { rows } = await ctx.pool.query(
    `INSERT INTO tenant_api_keys (tenant_id, key_prefix, key_hash, key_salt, label)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [tenantId, keyPrefix, hash, salt, label ?? null]
  );

  return { id: rows[0].id as string, tenantId, keyPrefix, fullKey };
}

export type ProvisioningWebhookEvent = 'sent' | 'delivered' | 'read' | 'failed' | 'reply';

export interface ProvisionedWebhookEndpoint {
  id: string;
  tenantId: string;
  url: string;
  events: ProvisioningWebhookEvent[];
  secret: string;
}

/**
 * Registers an outbound webhook endpoint, mirroring apps/admin's
 * createWebhookEndpoint — but unlike that one, retry-safe: a caller that
 * times out waiting for the response and re-POSTs the identical
 * {url, events} gets back the SAME endpoint id and secret rather than a
 * second row with a different secret. Without this, a retry would leave
 * two active endpoints receiving duplicate deliveries, one signed with a
 * secret the caller no longer has on file (if they only kept the latest
 * response) — a genuinely silent failure mode, not just wasted rows.
 * Only matches an ACTIVE endpoint with the exact same event set
 * (order-independent) — a deliberate second registration with a different
 * events subset for the same URL still creates a new row, as intended.
 */
export async function createWebhookEndpoint(
  ctx: ProvisioningContext,
  input: { tenantId: string; url: string; events: ProvisioningWebhookEvent[] }
): Promise<ProvisionedWebhookEndpoint> {
  const requestedEvents = [...input.events].sort();

  const { rows: existingRows } = await ctx.pool.query(
    `SELECT id, url, events, secret_ciphertext, secret_iv, secret_tag, key_version
       FROM webhook_endpoints WHERE tenant_id = $1 AND url = $2 AND is_active = true`,
    [input.tenantId, input.url]
  );
  const existing = existingRows.find((row) => {
    const rowEvents = [...(row.events as string[])].sort();
    return rowEvents.length === requestedEvents.length && rowEvents.every((e, i) => e === requestedEvents[i]);
  });

  if (existing) {
    const masterKey = resolveKeyForVersion(ctx.masterKeyRing, existing.key_version as number);
    const secret = decryptSecret(
      { ciphertext: existing.secret_ciphertext as string, iv: existing.secret_iv as string, tag: existing.secret_tag as string },
      input.tenantId,
      masterKey,
      existing.key_version as number
    );
    return { id: existing.id as string, tenantId: input.tenantId, url: input.url, events: input.events, secret };
  }

  const secret = `whsec_${crypto.randomBytes(24).toString('base64url')}`;
  const enc = encryptSecret(secret, input.tenantId, ctx.masterKeyRing.currentKey, ctx.masterKeyRing.currentVersion);

  const { rows } = await ctx.pool.query(
    `INSERT INTO webhook_endpoints
       (tenant_id, url, secret_ciphertext, secret_iv, secret_tag, key_version, events, created_by_admin_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NULL) RETURNING id`,
    [input.tenantId, input.url, enc.ciphertext, enc.iv, enc.tag, ctx.masterKeyRing.currentVersion, input.events]
  );

  return { id: rows[0].id as string, tenantId: input.tenantId, url: input.url, events: input.events, secret };
}

export type EmbeddedSignupResult =
  | { ok: true; displayName?: string; displayPhoneNumber?: string }
  | { ok: false; error: string; statusCode: number };

/**
 * Completes an Embedded Signup — parameterized port of apps/admin's
 * completeEmbeddedSignup(). Writes the exact same tenant_wa_credentials
 * row shape the manual credential path writes; onboarding_method is the
 * only difference, and nothing downstream reads it for behavior.
 */
export async function completeEmbeddedSignup(
  ctx: ProvisioningContext,
  tenantId: string,
  input: { code: string; wabaId: string; phoneNumberId: string },
  metaConfig: { appId: string; appSecret: string }
): Promise<EmbeddedSignupResult> {
  const exchange = await exchangeEmbeddedSignupCode(metaConfig.appId, metaConfig.appSecret, input.code);
  if (!exchange.ok || !exchange.accessToken) {
    return { ok: false, error: `Token exchange failed: ${exchange.error}`, statusCode: 502 };
  }
  const businessToken = exchange.accessToken;
  const expiresAt = new Date(Date.now() + (exchange.expiresInSeconds ?? 60 * 24 * 60 * 60) * 1000);

  const subscribed = await subscribeAppToWaba(businessToken, input.wabaId);
  if (!subscribed.ok) {
    return { ok: false, error: `Webhook subscription failed: ${subscribed.error}`, statusCode: 502 };
  }

  const pin = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await registerPhoneNumber(businessToken, input.phoneNumberId, pin);

  const verification = await verifyWhatsAppCredentials(businessToken, input.phoneNumberId);
  if (!verification.ok) {
    return { ok: false, error: `Meta rejected the new credentials: ${verification.error}`, statusCode: 422 };
  }

  const ring = ctx.masterKeyRing;
  const tokenEnc = encryptSecret(businessToken, tenantId, ring.currentKey, ring.currentVersion);
  const appSecretEnc = encryptSecret(metaConfig.appSecret, tenantId, ring.currentKey, ring.currentVersion);
  const verifyToken = crypto.randomBytes(16).toString('hex');

  try {
    await ctx.pool.query(
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

  return {
    ok: true,
    displayName: verification.displayName,
    displayPhoneNumber: verification.displayPhoneNumber,
  };
}

/** Same shape as apps/admin's manual-credential PUT — reused rather than reimplemented per the brief. */
export async function saveManualCredentials(
  ctx: ProvisioningContext,
  tenantId: string,
  input: { accessToken: string; phoneNumberId: string; wabaId?: string; appSecret?: string; verifyToken?: string }
): Promise<
  | { ok: true; displayName?: string; displayPhoneNumber?: string; verifyToken: string; webhookWarning?: string }
  | { ok: false; error: string; statusCode: number }
> {
  const verification = await verifyWhatsAppCredentials(input.accessToken, input.phoneNumberId);
  if (!verification.ok) {
    return { ok: false, error: `Meta rejected these credentials: ${verification.error}`, statusCode: 422 };
  }

  let webhookWarning: string | undefined;
  if (input.wabaId) {
    const subscribed = await subscribeAppToWaba(input.accessToken, input.wabaId);
    if (!subscribed.ok) {
      webhookWarning = `Credentials saved, but webhook subscription failed (${subscribed.error}) — inbound replies/status updates won't arrive until this is fixed.`;
    }
  } else {
    webhookWarning = 'No WABA ID provided — webhook subscription was skipped, so inbound replies/status updates won\'t arrive.';
  }

  const ring = ctx.masterKeyRing;
  const accessToken  = encryptSecret(input.accessToken, tenantId, ring.currentKey, ring.currentVersion);
  const appSecretEnc = input.appSecret ? encryptSecret(input.appSecret, tenantId, ring.currentKey, ring.currentVersion) : null;
  const verifyToken  = input.verifyToken?.trim() || crypto.randomBytes(16).toString('hex');

  try {
    await ctx.pool.query(
      `INSERT INTO tenant_wa_credentials
         (tenant_id, phone_number_id, waba_id,
          access_token_ciphertext, access_token_iv, access_token_tag,
          app_secret_ciphertext, app_secret_iv, app_secret_tag,
          verify_token, key_version, last_verified_at, last_verified_status, onboarding_method)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), 'ok', 'manual')
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
         onboarding_method        = 'manual',
         updated_at               = NOW()`,
      [
        tenantId,
        input.phoneNumberId,
        input.wabaId ?? null,
        accessToken.ciphertext, accessToken.iv, accessToken.tag,
        appSecretEnc?.ciphertext ?? null, appSecretEnc?.iv ?? null, appSecretEnc?.tag ?? null,
        verifyToken,
        ring.currentVersion,
      ]
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('duplicate key') && msg.includes('phone_number_id')) {
      return { ok: false, error: `Phone number ID ${input.phoneNumberId} is already in use by another tenant`, statusCode: 409 };
    }
    throw err;
  }

  return {
    ok: true,
    displayName: verification.displayName,
    displayPhoneNumber: verification.displayPhoneNumber,
    verifyToken,
    webhookWarning,
  };
}
