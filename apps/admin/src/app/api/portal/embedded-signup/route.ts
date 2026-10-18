import { NextRequest, NextResponse } from 'next/server';
import { withPortalSession } from '@/lib/tenantPortalAuth';
import { completeEmbeddedSignup } from '@/lib/embeddedSignup';
import { recordPortalAuditEvent } from '@/lib/auditLog';

/**
 * Portal twin of POST /api/tenants/[id]/embedded-signup — the tenant connects
 * their own WhatsApp via Meta's "Continue with Facebook" popup. They never see
 * a raw token at any point; Meta exchanges the one-shot code server-side and
 * the credentials are encrypted at rest. Manual credential paste deliberately
 * has no portal equivalent — that path stays ops-assisted.
 */
export const POST = withPortalSession(async (session, req: NextRequest) => {
  const body = (await req.json()) as { code?: string; wabaId?: string; phoneNumberId?: string };
  if (!body.code || !body.wabaId || !body.phoneNumberId) {
    return NextResponse.json({ error: 'code, wabaId, and phoneNumberId are required' }, { status: 400 });
  }

  const result = await completeEmbeddedSignup(session.tenantId, {
    code:          body.code,
    wabaId:        body.wabaId,
    phoneNumberId: body.phoneNumberId,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.statusCode });

  await recordPortalAuditEvent({
    tenantId:     session.tenantId,
    portalUserId: session.tenantUserId,
    portalEmail:  session.email,
    action:       'tenant.credentials.updated',
    details:      { phoneNumberId: body.phoneNumberId, wabaId: body.wabaId, onboardingMethod: 'embedded_signup' },
  });

  return NextResponse.json({
    ok: true,
    verifiedName:       result.displayName,
    displayPhoneNumber: result.displayPhoneNumber,
  });
});
