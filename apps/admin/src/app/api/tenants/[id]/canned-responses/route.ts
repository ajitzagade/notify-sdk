import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { listCannedResponses, createCannedResponse } from '@/lib/cannedResponses';

export const GET = withAdminSession(async (_session, _req: NextRequest, ctx: { params: { id: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const responses = await listCannedResponses(tenant.id);
  return NextResponse.json({ responses });
});

export const POST = withAdminSession(async (_session, req: NextRequest, ctx: { params: { id: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const body = (await req.json()) as { label?: string; body?: string };
  if (!body.label?.trim() || !body.body?.trim()) {
    return NextResponse.json({ error: 'label and body are required' }, { status: 400 });
  }

  const response = await createCannedResponse(tenant.id, body.label.trim(), body.body.trim());
  return NextResponse.json({ response }, { status: 201 });
});
