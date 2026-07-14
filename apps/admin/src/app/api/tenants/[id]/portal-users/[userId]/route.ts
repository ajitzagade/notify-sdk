import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { setPortalUserActive } from '@/lib/tenantPortalUsers';
import { recordAuditEvent } from '@/lib/auditLog';

export const PATCH = withAdminSession(
  async (session, req: NextRequest, ctx: { params: { id: string; userId: string } }) => {
    const tenant = await getTenant(ctx.params.id);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const body = (await req.json()) as { isActive?: boolean };
    if (typeof body.isActive !== 'boolean') {
      return NextResponse.json({ error: 'isActive (boolean) is required' }, { status: 400 });
    }

    const updated = await setPortalUserActive(tenant.id, ctx.params.userId, body.isActive);
    if (!updated) return NextResponse.json({ error: 'Portal user not found' }, { status: 404 });

    await recordAuditEvent({
      tenantId:    tenant.id,
      adminUserId: session.adminUserId,
      action:      body.isActive ? 'tenant.portal_user.reactivated' : 'tenant.portal_user.deactivated',
      details:     { portalUserId: ctx.params.userId },
    });

    return NextResponse.json({ ok: true });
  }
);
