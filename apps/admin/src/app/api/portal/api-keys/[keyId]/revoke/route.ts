import { NextRequest, NextResponse } from 'next/server';
import { withPortalSession } from '@/lib/tenantPortalAuth';
import { revokeApiKey } from '@/lib/apiKeys';
import { recordPortalAuditEvent } from '@/lib/auditLog';

export const POST = withPortalSession(
  async (session, _req: NextRequest, ctx: { params: { keyId: string } }) => {
    const revoked = await revokeApiKey(session.tenantId, ctx.params.keyId);
    if (!revoked) return NextResponse.json({ error: 'Key not found or already revoked' }, { status: 404 });

    await recordPortalAuditEvent({
      tenantId:     session.tenantId,
      portalUserId: session.tenantUserId,
      portalEmail:  session.email,
      action:       'tenant.api_key.revoked',
      details:      { keyId: ctx.params.keyId },
    });

    return NextResponse.json({ ok: true });
  }
);
