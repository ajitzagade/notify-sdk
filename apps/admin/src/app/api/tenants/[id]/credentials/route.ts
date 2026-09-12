import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { encryptSecret } from '@orgname/notify';
import { withAdminSession } from '@/lib/auth';
import { getPool } from '@/lib/db';
import { getMasterKeyRing } from '@/lib/security';
import { getTenant } from '@/lib/tenants';
import { verifyWhatsAppCredentials } from '@/lib/metaGraph';
import { getTenantRegistry } from '@/lib/tenantRegistry';
import { recordAuditEvent } from '@/lib/auditLog';

export const PUT = withAdminSession(async (session, req: NextRequest, ctx: { params: { id: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const body = (await req.json()) as {
    accessToken?: string;
    phoneNumberId?: string;
    wabaId?: string;
    appSecret?: string;
    verifyToken?: string;
  };

  if (!body.accessToken || !body.phoneNumberId) {
    return NextResponse.json({ error: 'accessToken and phoneNumberId are required' }, { status: 400 });
  }

  // Re-verify server-side before persisting — never trust a client-asserted "already verified".
  const verification = await verifyWhatsAppCredentials(body.accessToken, body.phoneNumberId);
  if (!verification.ok) {
    return NextResponse.json(
      { error: `Meta rejected these credentials: ${verification.error}` },
      { status: 422 }
    );
  }

  const ring          = getMasterKeyRing();
  const accessToken   = encryptSecret(body.accessToken, tenant.id, ring.currentKey, ring.currentVersion);
  const appSecretEnc  = body.appSecret ? encryptSecret(body.appSecret, tenant.id, ring.currentKey, ring.currentVersion) : null;
  const verifyToken   = body.verifyToken?.trim() || crypto.randomBytes(16).toString('hex');

  try {
    await getPool().query(
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
        tenant.id,
        body.phoneNumberId,
        body.wabaId ?? null,
        accessToken.ciphertext, accessToken.iv, accessToken.tag,
        appSecretEnc?.ciphertext ?? null, appSecretEnc?.iv ?? null, appSecretEnc?.tag ?? null,
        verifyToken,
        ring.currentVersion,
      ]
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('duplicate key') && msg.includes('phone_number_id')) {
      return NextResponse.json(
        { error: `Phone number ID ${body.phoneNumberId} is already in use by another tenant` },
        { status: 409 }
      );
    }
    throw err;
  }

  // Credentials just changed — drop any cached NotifyClient for this tenant so the
  // next send picks up the new token instead of a stale one.
  getTenantRegistry().invalidate(tenant.id);

  await recordAuditEvent({
    tenantId:    tenant.id,
    adminUserId: session.adminUserId,
    action:      'tenant.credentials.updated',
    details:     { phoneNumberId: body.phoneNumberId, wabaId: body.wabaId ?? null },
  });

  return NextResponse.json({
    ok: true,
    verifiedName:        verification.displayName,
    displayPhoneNumber:  verification.displayPhoneNumber,
    verifyToken,
  });
});
