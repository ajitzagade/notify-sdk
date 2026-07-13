import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { listWebhookEndpoints, createWebhookEndpoint, ALL_WEBHOOK_EVENTS, type WebhookEvent } from '@/lib/webhookEndpoints';
import { recordAuditEvent } from '@/lib/auditLog';

export const GET = withAdminSession(async (_session, _req: NextRequest, ctx: { params: { id: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const endpoints = await listWebhookEndpoints(tenant.id);
  return NextResponse.json({ endpoints });
});

export const POST = withAdminSession(async (session, req: NextRequest, ctx: { params: { id: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const body = (await req.json()) as { url?: string; events?: WebhookEvent[] };
  if (!body.url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }
  try {
    new URL(body.url);
  } catch {
    return NextResponse.json({ error: 'url must be a valid absolute URL' }, { status: 400 });
  }
  const events = (body.events ?? []).filter((e) => ALL_WEBHOOK_EVENTS.includes(e));
  if (events.length === 0) {
    return NextResponse.json({ error: 'Select at least one event' }, { status: 400 });
  }

  const { record, secret } = await createWebhookEndpoint({
    tenantId:         tenant.id,
    url:              body.url,
    events,
    createdByAdminId: session.adminUserId,
  });

  await recordAuditEvent({
    tenantId:    tenant.id,
    adminUserId: session.adminUserId,
    action:      'tenant.webhook.created',
    details:     { endpointId: record.id, url: record.url, events: record.events },
  });

  return NextResponse.json({ endpoint: record, secret }, { status: 201 });
});
