import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { submitStarterTemplate } from '@/lib/starterTemplateSubmit';
import { recordAuditEvent } from '@/lib/auditLog';

export const POST = withAdminSession(async (session, req: NextRequest, ctx: { params: { id: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const body = (await req.json()) as { key?: string };
  if (!body.key) return NextResponse.json({ error: 'key is required' }, { status: 400 });

  const result = await submitStarterTemplate(tenant.id, body.key);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.statusCode });

  await recordAuditEvent({
    tenantId:    tenant.id,
    adminUserId: session.adminUserId,
    action:      'tenant.template.submitted',
    details:     { name: result.name, status: result.status },
  });

  return NextResponse.json({ name: result.name, status: result.status });
});
