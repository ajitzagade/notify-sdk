import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { setPortalUserActive, resetPortalUserPassword } from '@/lib/tenantPortalUsers';
import { recordAuditEvent } from '@/lib/auditLog';

export const PATCH = withAdminSession(
  async (session, req: NextRequest, ctx: { params: { id: string; userId: string } }) => {
    const tenant = await getTenant(ctx.params.id);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const body = (await req.json()) as { isActive?: boolean; password?: string };

    if (typeof body.password === 'string') {
      if (body.password.length < 8) {
        return NextResponse.json({ error: 'password must be at least 8 characters' }, { status: 400 });
      }
      const reset = await resetPortalUserPassword(tenant.id, ctx.params.userId, body.password);
      if (!reset) return NextResponse.json({ error: 'Portal user not found' }, { status: 404 });

      await recordAuditEvent({
        tenantId:    tenant.id,
        adminUserId: session.adminUserId,
        action:      'tenant.portal_user.password_reset',
        details:     { portalUserId: ctx.params.userId },
      });
      return NextResponse.json({ ok: true });
    }

    if (typeof body.isActive !== 'boolean') {
      return NextResponse.json({ error: 'isActive (boolean) or password is required' }, { status: 400 });
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
