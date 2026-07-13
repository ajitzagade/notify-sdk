import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { reactivateWebhookEndpoint } from '@/lib/webhookEndpoints';
import { recordAuditEvent } from '@/lib/auditLog';

export const POST = withAdminSession(
  async (session, _req: NextRequest, ctx: { params: { id: string; endpointId: string } }) => {
    const tenant = await getTenant(ctx.params.id);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const reactivated = await reactivateWebhookEndpoint(tenant.id, ctx.params.endpointId);
    if (!reactivated) return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });

    await recordAuditEvent({
      tenantId:    tenant.id,
      adminUserId: session.adminUserId,
      action:      'tenant.webhook.reactivated',
      details:     { endpointId: ctx.params.endpointId },
    });

    return NextResponse.json({ ok: true });
  }
);
