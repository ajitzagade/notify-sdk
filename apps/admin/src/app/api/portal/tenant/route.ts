import { NextRequest, NextResponse } from 'next/server';
import { withPortalSession } from '@/lib/tenantPortalAuth';
import { updateTenantBranding } from '@/lib/tenants';
import { recordPortalAuditEvent } from '@/lib/auditLog';

/** Portal twin of PATCH /api/tenants/[id] — tenant comes from the session cookie only. */
export const PATCH = withPortalSession(async (session, req: NextRequest) => {
  const body = (await req.json()) as {
    name?: string; primaryColor?: string; secondaryColor?: string; businessDescription?: string; category?: string;
  };
  const tenant = await updateTenantBranding(session.tenantId, body);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  await recordPortalAuditEvent({
    tenantId:     session.tenantId,
    portalUserId: session.tenantUserId,
    portalEmail:  session.email,
    action:       'tenant.branding.updated',
    details:      body as Record<string, unknown>,
  });

  return NextResponse.json({ tenant });
});
