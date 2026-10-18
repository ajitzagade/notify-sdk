import { NextRequest, NextResponse } from 'next/server';
import { withPortalSession } from '@/lib/tenantPortalAuth';
import { updateTenantBranding } from '@/lib/tenants';
import { recordPortalAuditEvent } from '@/lib/auditLog';
import { TENANT_CATEGORIES } from '@/lib/categories';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * Portal twin of PATCH /api/tenants/[id] — tenant comes from the session
 * cookie only. Unlike the admin route, input is strictly validated: this is
 * the first write surface exposed to non-ops users.
 */
export const PATCH = withPortalSession(async (session, req: NextRequest) => {
  const body = (await req.json()) as {
    name?: string; primaryColor?: string; secondaryColor?: string; businessDescription?: string; category?: string;
  };

  if (body.name !== undefined && (!body.name.trim() || body.name.length > 120)) {
    return NextResponse.json({ error: 'name must be 1–120 characters' }, { status: 400 });
  }
  if (body.primaryColor !== undefined && !HEX_COLOR.test(body.primaryColor)) {
    return NextResponse.json({ error: 'primaryColor must be a #rrggbb hex color' }, { status: 400 });
  }
  if (body.secondaryColor !== undefined && !HEX_COLOR.test(body.secondaryColor)) {
    return NextResponse.json({ error: 'secondaryColor must be a #rrggbb hex color' }, { status: 400 });
  }
  if (body.businessDescription !== undefined && body.businessDescription.length > 2000) {
    return NextResponse.json({ error: 'businessDescription must be at most 2000 characters' }, { status: 400 });
  }
  if (body.category !== undefined && !TENANT_CATEGORIES.some((c) => c.value === body.category)) {
    return NextResponse.json({ error: 'unknown category' }, { status: 400 });
  }

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
