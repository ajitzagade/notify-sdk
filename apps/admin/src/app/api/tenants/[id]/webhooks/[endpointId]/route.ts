import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { deleteWebhookEndpoint } from '@/lib/webhookEndpoints';
import { recordAuditEvent } from '@/lib/auditLog';

export const DELETE = withAdminSession(
  async (session, _req: NextRequest, ctx: { params: { id: string; endpointId: string } }) => {
    const tenant = await getTenant(ctx.params.id);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const deleted = await deleteWebhookEndpoint(tenant.id, ctx.params.endpointId);
    if (!deleted) return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });

    await recordAuditEvent({
      tenantId:    tenant.id,
      adminUserId: session.adminUserId,
      action:      'tenant.webhook.deleted',
      details:     { endpointId: ctx.params.endpointId },
    });

    return NextResponse.json({ ok: true });
  }
);
