import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { listApiKeys, createApiKey } from '@/lib/apiKeys';
import { recordAuditEvent } from '@/lib/auditLog';

export const GET = withAdminSession(async (_session, _req: NextRequest, ctx: { params: { id: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const keys = await listApiKeys(tenant.id);
  return NextResponse.json({ keys });
});

export const POST = withAdminSession(async (session, req: NextRequest, ctx: { params: { id: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const body = (await req.json()) as { label?: string };
  const { record, fullKey } = await createApiKey(tenant.id, body.label, session.adminUserId);

  await recordAuditEvent({
    tenantId:    tenant.id,
    adminUserId: session.adminUserId,
    action:      'tenant.api_key.created',
    details:     { keyId: record.id, keyPrefix: record.keyPrefix, label: record.label },
  });

  return NextResponse.json({ key: record, fullKey }, { status: 201 });
});
