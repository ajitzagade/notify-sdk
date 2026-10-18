import { NextRequest, NextResponse } from 'next/server';
import { withPortalSession } from '@/lib/tenantPortalAuth';
import { listApiKeys, createApiKey } from '@/lib/apiKeys';
import { recordPortalAuditEvent } from '@/lib/auditLog';

export const GET = withPortalSession(async (session) => {
  const keys = await listApiKeys(session.tenantId);
  return NextResponse.json({ keys });
});

// Self-serve issuance cap — plenty for real integrations, stops a compromised
// portal login from minting keys in bulk. Ops-side issuance has no cap.
const MAX_ACTIVE_KEYS = 20;

export const POST = withPortalSession(async (session, req: NextRequest) => {
  const body = (await req.json()) as { label?: string };

  const existing = await listApiKeys(session.tenantId);
  const activeCount = existing.filter((k) => !k.revokedAt).length;
  if (activeCount >= MAX_ACTIVE_KEYS) {
    return NextResponse.json(
      { error: `Active key limit reached (${MAX_ACTIVE_KEYS}). Revoke unused keys first.` },
      { status: 400 }
    );
  }

  const { record, fullKey } = await createApiKey(session.tenantId, body.label, {
    portalUserId: session.tenantUserId,
  });

  await recordPortalAuditEvent({
    tenantId:     session.tenantId,
    portalUserId: session.tenantUserId,
    portalEmail:  session.email,
    action:       'tenant.api_key.created',
    details:      { keyId: record.id, keyPrefix: record.keyPrefix, label: record.label },
  });

  return NextResponse.json({ key: record, fullKey }, { status: 201 });
});
