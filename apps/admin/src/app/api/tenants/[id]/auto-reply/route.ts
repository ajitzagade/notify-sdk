import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { getTenant, setAutoReplyEnabled } from '@/lib/tenants';
import { getTenantRegistry } from '@/lib/tenantRegistry';
import { recordAuditEvent } from '@/lib/auditLog';

export const PATCH = withAdminSession(async (session, req: NextRequest, ctx: { params: { id: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const body = (await req.json()) as { enabled?: boolean };
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
  }

  const updated = await setAutoReplyEnabled(tenant.id, body.enabled);

  // Keeps this app's own cached client (used by Test Send) consistent,
  // mirroring credentials/route.ts. apps/api runs as a separate deployment
  // with its own registry singleton this process can't reach directly, so
  // its dispatch picks up the new flag within its own cache ttlMs (default
  // 5 min) — the same existing eventual-consistency window credential
  // rotation already has for that app, not something new to this feature.
  getTenantRegistry().invalidate(tenant.id);

  await recordAuditEvent({
    tenantId:    tenant.id,
    adminUserId: session.adminUserId,
    action:      'tenant.auto_reply.updated',
    details:     { enabled: body.enabled },
  });

  return NextResponse.json({ tenant: updated });
});
