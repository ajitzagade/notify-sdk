import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { listPortalUsers, createPortalUser } from '@/lib/tenantPortalUsers';
import { recordAuditEvent } from '@/lib/auditLog';

export const GET = withAdminSession(async (_session, _req: NextRequest, ctx: { params: { id: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const users = await listPortalUsers(tenant.id);
  return NextResponse.json({ users });
});

export const POST = withAdminSession(async (session, req: NextRequest, ctx: { params: { id: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const body = (await req.json()) as { email?: string; password?: string };
  if (!body.email || !body.password) {
    return NextResponse.json({ error: 'email and password are required' }, { status: 400 });
  }
  if (body.password.length < 8) {
    return NextResponse.json({ error: 'password must be at least 8 characters' }, { status: 400 });
  }

  try {
    const user = await createPortalUser({
      tenantId:          tenant.id,
      email:             body.email,
      password:          body.password,
      createdByAdminId:  session.adminUserId,
    });

    await recordAuditEvent({
      tenantId:    tenant.id,
      adminUserId: session.adminUserId,
      action:      'tenant.portal_user.created',
      details:     { portalUserId: user.id, email: user.email },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (err: unknown) {
    // Unique-constraint violation on tenant_portal_users.email.
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('duplicate key') || message.includes('unique')) {
      return NextResponse.json({ error: 'That email already has a portal login' }, { status: 409 });
    }
    throw err;
  }
});
