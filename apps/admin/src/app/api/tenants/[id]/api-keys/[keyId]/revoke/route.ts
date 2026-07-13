import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { revokeApiKey } from '@/lib/apiKeys';
import { recordAuditEvent } from '@/lib/auditLog';

export const POST = withAdminSession(async (session, _req: NextRequest, ctx: { params: { id: string; keyId: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const revoked = await revokeApiKey(tenant.id, ctx.params.keyId);
  if (!revoked) return NextResponse.json({ error: 'Key not found or already revoked' }, { status: 404 });

  await recordAuditEvent({
    tenantId:    tenant.id,
    adminUserId: session.adminUserId,
    action:      'tenant.api_key.revoked',
    details:     { keyId: ctx.params.keyId },
  });

  return NextResponse.json({ ok: true });
});
