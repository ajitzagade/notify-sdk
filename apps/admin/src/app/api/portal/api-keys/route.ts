import { NextRequest, NextResponse } from 'next/server';
import { withPortalSession } from '@/lib/tenantPortalAuth';
import { listApiKeys, createApiKey } from '@/lib/apiKeys';
import { recordPortalAuditEvent } from '@/lib/auditLog';

export const GET = withPortalSession(async (session) => {
  const keys = await listApiKeys(session.tenantId);
  return NextResponse.json({ keys });
});

export const POST = withPortalSession(async (session, req: NextRequest) => {
  const body = (await req.json()) as { label?: string };
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
