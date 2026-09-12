import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { completeEmbeddedSignup } from '@/lib/embeddedSignup';
import { recordAuditEvent } from '@/lib/auditLog';

export const POST = withAdminSession(async (session, req: NextRequest, ctx: { params: { id: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const body = (await req.json()) as { code?: string; wabaId?: string; phoneNumberId?: string };
  if (!body.code || !body.wabaId || !body.phoneNumberId) {
    return NextResponse.json({ error: 'code, wabaId, and phoneNumberId are required' }, { status: 400 });
  }

  const result = await completeEmbeddedSignup(tenant.id, {
    code:          body.code,
    wabaId:        body.wabaId,
    phoneNumberId: body.phoneNumberId,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.statusCode });

  await recordAuditEvent({
    tenantId:    tenant.id,
    adminUserId: session.adminUserId,
    action:      'tenant.credentials.updated',
    details:     { phoneNumberId: body.phoneNumberId, wabaId: body.wabaId, onboardingMethod: 'embedded_signup' },
  });

  return NextResponse.json({
    ok: true,
    verifiedName:       result.displayName,
    displayPhoneNumber: result.displayPhoneNumber,
  });
});
